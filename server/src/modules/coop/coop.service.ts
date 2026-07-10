import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { TenantContext } from '../../common/decorators/current-tenant.decorator';

@Injectable()
export class CoopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
    private readonly config: ConfigService,
  ) {}

  // ── 城市运营中心 ────────────────────────────

  async cityCenterList(region?: string) {
    const rows = await this.prisma.cityCenter.findMany({
      where: region ? { cityName: { contains: region, mode: 'insensitive' } } : {},
      orderBy: { createdAt: 'desc' },
    });
    return { items: rows.map(r => ({ id: r.id, city_name: r.cityName, address: r.address, contact_name: r.contactName, contact_phone: r.contactPhone })) };
  }

  async joinCircle(tenant: TenantContext, centerId: number): Promise<{ relation_id: number }> {
    if (!tenant.userId || !tenant.bId) throw new BadRequestException({ code: 'TENANT_002', message: '无租户上下文' });
    const fav = await this.tenantCtx.runInTenant(tenant, (tx) =>
      tx.userFavorite.upsert({
        where: { userId_targetType_targetId: { userId: tenant.userId!, targetType: 'city_center', targetId: centerId } },
        update: {},
        create: { userId: tenant.userId!, bId: tenant.bId!, targetType: 'city_center', targetId: centerId },
      }),
    );
    return { relation_id: fav.id };
  }

  async favCenter(tenant: TenantContext, centerId: number): Promise<{ favorite_id: number }> {
    if (!tenant.userId || !tenant.bId) throw new BadRequestException({ code: 'TENANT_002', message: '无租户上下文' });
    const fav = await this.tenantCtx.runInTenant(tenant, (tx) =>
      tx.userFavorite.upsert({
        where: { userId_targetType_targetId: { userId: tenant.userId!, targetType: 'city_center', targetId: centerId } },
        update: {},
        create: { userId: tenant.userId!, bId: tenant.bId!, targetType: 'city_center', targetId: centerId },
      }),
    );
    return { favorite_id: fav.id };
  }

  // ── 合伙人申请 ────────────────────────────────

  async partnerApply(tenant: TenantContext, centerId: number, info: { name: string; phone: string; info?: string }) {
    if (!tenant.userId || !tenant.bId) throw new BadRequestException({ code: 'TENANT_002', message: '无租户上下文' });
    const center = await this.prisma.cityCenter.findUnique({ where: { id: centerId } });
    if (!center) throw new NotFoundException({ code: 'BIZ_001', message: '运营中心不存在' });

    // 创建待支付订单(partner类型)，实际支付由 pay 模块处理
    const order = await this.tenantCtx.runInTenant(tenant, (tx) =>
      tx.cOrder.create({
        data: { userId: tenant.userId!, bId: tenant.bId!, type: 'partner', amount: 0, status: 'pending' },
      }),
    );
    return { order_id: order.id, center_id: centerId, status: 'pending' };
  }

  // ── 千人千面 Scene 签名 ───────────────────────

  generateScene(bId: number): { scene: string; sig: string; link: string } {
    const sig = crypto.createHmac('sha256', this.config.get('JWT_SECRET') ?? 'dev-secret').update(String(bId)).digest('hex').slice(0, 16);
    const scene = `b=${bId}&sig=${sig}`;
    const appId = this.config.get('WX_APPID') ?? '';
    const link = `https://mp.weixin.qq.com/a/~${appId}#pages/home/home?scene=${encodeURIComponent(scene)}`;
    return { scene, sig, link };
  }
}
