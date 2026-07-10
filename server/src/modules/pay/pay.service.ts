import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { TenantContext } from '../../common/decorators/current-tenant.decorator';
import { CommissionService } from '../commission/commission.service';

interface WxPayOrderResult {
  prepayId: string;
  payParams: {
    appId: string;
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: string;
    paySign: string;
  };
}

@Injectable()
export class PayService {
  private readonly logger = new Logger(PayService.name);
  private readonly mchId: string;
  private readonly apiV3Key: string;
  private readonly appId: string;
  private readonly certPath: string;
  private readonly keyPath: string;
  private readonly notifyUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
    private readonly commission: CommissionService,
    private readonly config: ConfigService,
  ) {
    this.mchId = config.get('WX_PAY_MCH_ID') ?? '';
    this.apiV3Key = config.get('WX_PAY_MCH_KEY') ?? '';
    this.appId = config.get('WX_APPID') ?? '';
    this.certPath = config.get('WX_PAY_CERT_PATH') ?? '';
    this.keyPath = config.get('WX_PAY_KEY_PATH') ?? '';
    this.notifyUrl = config.get('WX_PAY_NOTIFY_URL') ?? 'https://example.com/api/c/pay/notify/wx';
  }

  /** 创建订单并发起微信预支付 */
  async createOrder(
    tenant: TenantContext,
    type: 'bp_unlock' | 'join_project' | 'partner',
    projectId?: number,
  ): Promise<{ orderId: number; payParams: WxPayOrderResult['payParams'] }> {
    if (!tenant.userId || !tenant.bId) throw new BadRequestException({ code: 'TENANT_002', message: '无租户上下文' });

    const project = projectId
      ? await this.tenantCtx.runInTenant(tenant, (tx) => tx.project.findUnique({ where: { id: projectId } }))
      : null;

    const amount = this.calcAmount(type, project);
    if (amount <= 0) throw new BadRequestException({ code: 'BIZ_062', message: '金额不合法' });

    // 防重: bp_unlock 和 join_project 同一用户同一项目只能一个待支付
    if (projectId) {
      const dup = await this.prisma.cOrder.findFirst({
        where: { userId: tenant.userId, projectId, type, status: { in: ['created', 'pending', 'paid', 'delivered'] } },
      });
      if (dup) throw new ConflictException({ code: 'BIZ_061', message: '已有相同订单' });
    }

    const order = await this.tenantCtx.runInTenant(tenant, (tx) =>
      tx.cOrder.create({
        data: { userId: tenant.userId!, bId: tenant.bId!, projectId, type, amount, status: 'created' },
      }),
    );

    const outTradeNo = `SC${order.id}_${Date.now()}`;
    const body = type === 'bp_unlock' ? 'BP解锁' : type === 'join_project' ? '加入项目' : '合伙人';

    const prepayResult = await this.unifiedOrder(outTradeNo, amount, body);

    await this.tenantCtx.runInTenant(tenant, (tx) =>
      tx.cOrder.update({ where: { id: order.id }, data: { status: 'pending', wxTradeNo: outTradeNo } }),
    );

    return { orderId: order.id, payParams: prepayResult };
  }

  /** 微信支付回调处理 */
  async handleNotify(rawBody: string, signature: string, timestamp: string, nonce: string): Promise<void> {
    // 验证签名
    if (!this.verifySignature(rawBody, signature, timestamp, nonce)) {
      this.logger.warn('WeChat Pay callback signature mismatch');
      return;
    }

    const data = JSON.parse(rawBody) as { resource?: { ciphertext?: string } };
    if (!data.resource?.ciphertext) return;

    const decrypted = this.decryptNotify(data.resource.ciphertext);
    const { out_trade_no, transaction_id, trade_state } = decrypted as { out_trade_no: string; transaction_id: string; trade_state: string };

    if (trade_state !== 'SUCCESS') return;

    const order = await this.prisma.cOrder.findFirst({ where: { wxTradeNo: out_trade_no } });
    if (!order || order.status !== 'pending') return; // 幂等

    // paid → delivered
    await this.prisma.$transaction(async (tx) => {
      await tx.cOrder.update({ where: { id: order.id }, data: { status: 'paid', paidAt: new Date(), wxTradeNo: transaction_id } });
      await this.deliver(tx, order.id, order);
    });
  }

  async queryOrder(tenant: TenantContext, orderId: number) {
    const order = await this.tenantCtx.runInTenant(tenant, (tx) => tx.cOrder.findUnique({ where: { id: orderId } }));
    if (!order || order.userId !== tenant.userId) throw new BadRequestException({ code: 'BIZ_001', message: '订单不存在' });
    return { order_id: order.id, type: order.type, amount: order.amount, status: order.status, paid_at: order.paidAt, delivered_at: order.deliveredAt };
  }

  async refund(tenant: TenantContext, orderId: number, reason: string): Promise<void> {
    const order = await this.tenantCtx.runInTenant(tenant, (tx) => tx.cOrder.findUnique({ where: { id: orderId } }));
    if (!order || order.userId !== tenant.userId) throw new BadRequestException({ code: 'BIZ_001', message: '订单不存在' });
    if (order.status !== 'delivered') throw new BadRequestException({ code: 'BIZ_070', message: '订单不可退款' });

    await this.wxRefund(order.wxTradeNo ?? '', order.amount, reason);

    await this.prisma.$transaction(async (tx) => {
      await tx.cOrder.update({ where: { id: orderId }, data: { status: 'refunded', refundAmount: order.amount } });
      // 冲正分佣
      await tx.commission.updateMany({ where: { orderId, status: 'pending' }, data: { status: 'reversed' } });
      await tx.commission.updateMany({ where: { orderId, status: 'settled' }, data: { status: 'reversed' } });
    });
  }

  // ── 内部方法 ──

  private calcAmount(type: string, project: { bpPrice: number; joinPrice: number } | null): number {
    if (type === 'bp_unlock') return project?.bpPrice ?? 0;
    if (type === 'join_project') return project?.joinPrice ?? 0;
    return 0;
  }

  private async deliver(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    orderId: number,
    order: { id: number; userId: number; bId: number; projectId: number | null; type: string; amount: number },
  ): Promise<void> {
    await tx.cOrder.update({ where: { id: orderId }, data: { status: 'delivered', deliveredAt: new Date() } });

    if (order.projectId) {
      if (order.type === 'join_project') {
        await tx.userJoin.upsert({
          where: { userId_projectId: { userId: order.userId, projectId: order.projectId } },
          update: { unlockContact: true },
          create: { userId: order.userId, bId: order.bId, projectId: order.projectId, unlockContact: true },
        });
      }
    }

    // 触发分佣
    await this.commission.createFromOrder(tx, orderId, order.userId, order.bId, order.amount);
  }

  private async unifiedOrder(outTradeNo: string, amount: number, description: string): Promise<WxPayOrderResult['payParams']> {
    const url = 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi';
    const body = {
      appid: this.appId,
      mchid: this.mchId,
      description,
      out_trade_no: outTradeNo,
      notify_url: this.notifyUrl,
      amount: { total: amount, currency: 'CNY' },
    };

    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = crypto.randomBytes(16).toString('hex');
    const signature = this.sign('POST', '/v3/pay/transactions/jsapi', timestamp, nonce, JSON.stringify(body));

    const resp = await axios.post(url, body, {
      headers: {
        Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${this.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="SERIAL",signature="${signature}"`,
        'Content-Type': 'application/json',
      },
    });

    const prepayId: string = (resp.data as { prepay_id: string }).prepay_id;
    return this.buildPayParams(prepayId, timestamp, nonce);
  }

  private buildPayParams(prepayId: string, timestamp: string, nonce: string): WxPayOrderResult['payParams'] {
    const pkg = `prepay_id=${prepayId}`;
    const message = `${this.appId}\n${timestamp}\n${nonce}\n${pkg}\n`;
    const paySign = this.rsaSign(message);
    return { appId: this.appId, timeStamp: timestamp, nonceStr: nonce, package: pkg, signType: 'RSA', paySign };
  }

  private sign(method: string, path: string, timestamp: string, nonce: string, body: string): string {
    const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;
    return this.rsaSign(message);
  }

  private rsaSign(message: string): string {
    if (!this.keyPath || !fs.existsSync(this.keyPath)) return 'mock-signature';
    const key = fs.readFileSync(this.keyPath, 'utf-8');
    return crypto.createSign('RSA-SHA256').update(message).sign(key, 'base64');
  }

  private verifySignature(body: string, signature: string, timestamp: string, nonce: string): boolean {
    if (!this.certPath || !fs.existsSync(this.certPath)) {
      this.logger.warn('WeChat cert not configured, skipping signature verification (dev mode)');
      return true; // dev 模式跳过
    }
    const message = `${timestamp}\n${nonce}\n${body}\n`;
    const cert = fs.readFileSync(this.certPath, 'utf-8');
    return crypto.createVerify('RSA-SHA256').update(message).verify(cert, signature, 'base64');
  }

  private decryptNotify(ciphertext: string): unknown {
    const key = Buffer.from(this.apiV3Key, 'utf-8');
    const raw = Buffer.from(ciphertext, 'base64');
    const nonce = raw.slice(0, 12);
    const authTag = raw.slice(-16);
    const data = raw.slice(12, -16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(authTag);
    const result = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(result.toString('utf-8'));
  }

  private async wxRefund(outTradeNo: string, amount: number, reason: string): Promise<void> {
    if (!outTradeNo) return;
    this.logger.log(`Refund request: ${outTradeNo} ${amount} ${reason}`);
    // TODO: 实际调用微信退款 API
  }
}
