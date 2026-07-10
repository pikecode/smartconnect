import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 订单 delivered 时立即创建 commission:pending */
  async createFromOrder(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    orderId: number,
    userId: number,
    bId: number,
    amount: number,
  ): Promise<void> {
    // 查推荐人
    const referral = await tx.userReferral.findFirst({ where: { referredId: userId, bId } });
    if (!referral) return;

    // 查 B 端分佣比例
    const bTenant = await tx.bTenant.findUnique({ where: { id: bId }, select: { commissionRate: true } });
    const rate = bTenant?.commissionRate ?? 10;
    const commissionAmount = Math.floor((amount * rate) / 100);
    if (commissionAmount <= 0) return;

    await tx.commission.create({
      data: { orderId, referrerId: referral.referrerId, bId, amount: commissionAmount, rate, status: 'pending' },
    });
    this.logger.log(`Commission created: order=${orderId} referrer=${referral.referrerId} amount=${commissionAmount}`);
  }

  /** 查询用户佣金列表 */
  async getUserCommissions(userId: number, status?: string) {
    const where = { referrerId: userId, ...(status ? { status } : {}) };
    const [items, pending, settled] = await Promise.all([
      this.prisma.commission.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.commission.aggregate({ where: { referrerId: userId, status: 'pending' }, _sum: { amount: true } }),
      this.prisma.commission.aggregate({ where: { referrerId: userId, status: 'settled' }, _sum: { amount: true } }),
    ]);
    return {
      items: items.map((c) => ({ id: c.id, order_id: c.orderId, amount: c.amount, rate: c.rate, status: c.status, created_at: c.createdAt })),
      summary: { pending: pending._sum.amount ?? 0, settled: settled._sum.amount ?? 0, withdrawable: settled._sum.amount ?? 0 },
    };
  }

  /** 总后台: 手动批量结算(将 pending → settled) */
  async settle(bId?: number): Promise<{ count: number; batch: string }> {
    const batch = `batch_${Date.now()}`;
    const where = { status: 'pending', ...(bId ? { bId } : {}) };
    const result = await this.prisma.commission.updateMany({
      where,
      data: { status: 'settled', settleBatch: batch, settledAt: new Date() },
    });
    this.logger.log(`Settled ${result.count} commissions, batch=${batch}`);
    return { count: result.count, batch };
  }

  /** 总后台: 查看分佣列表 */
  async adminList(bId?: number, status?: string) {
    const items = await this.prisma.commission.findMany({
      where: { ...(bId ? { bId } : {}), ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { items: items.map((c) => ({ id: c.id, order_id: c.orderId, referrer_id: c.referrerId, b_id: c.bId, amount: c.amount, rate: c.rate, status: c.status, created_at: c.createdAt })) };
  }
}
