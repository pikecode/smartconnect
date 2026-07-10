import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { TenantContext } from '../../common/decorators/current-tenant.decorator';

@Injectable()
export class SwapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  /** 资源广场用户列表(公开白名单字段) */
  async resourceList(tenant: TenantContext, keyword?: string) {
    const users = await this.prisma.cUser.findMany({
      where: { status: 'active', ...(keyword ? { nickname: { contains: keyword, mode: 'insensitive' } } : {}) },
      take: 50,
      select: { id: true, nickname: true },
    });

    const resources = await this.prisma.userResource.findMany({
      where: { userId: { in: users.map(u => u.id) }, visibility: { not: 'hidden' } },
    });

    const resMap = new Map<number, typeof resources>();
    for (const r of resources) {
      if (!resMap.has(r.userId)) resMap.set(r.userId, []);
      resMap.get(r.userId)!.push(r);
    }

    return {
      items: users.map(u => ({
        user_id: u.id,
        nickname: u.nickname,
        resources: (resMap.get(u.id) ?? []).map(r => ({ id: r.id, type: r.type, content: r.content })),
      })),
    };
  }

  /** 申请微信互换 */
  async requestSwap(fromUserId: number, toUserId: number) {
    if (fromUserId === toUserId) throw new BadRequestException({ code: 'BIZ_031', message: '不能向自己申请' });

    const toUser = await this.prisma.cUser.findUnique({ where: { id: toUserId } });
    if (!toUser || toUser.status !== 'active') throw new NotFoundException({ code: 'BIZ_030', message: '用户不存在' });

    const existing = await this.prisma.wechatSwap.findFirst({
      where: { fromUserId, toUserId, status: { in: ['pending', 'approved'] } },
    });
    if (existing) throw new ConflictException({ code: 'BIZ_031', message: '已申请待处理' });

    // 查对方设置
    const toRel = await this.prisma.userTenantRelation.findFirst({ where: { userId: toUserId } });
    const autoApprove = toRel?.swapSetting === 'auto_approve';

    const swap = await this.prisma.wechatSwap.create({
      data: { fromUserId, toUserId, status: autoApprove ? 'approved' : 'pending' },
    });
    return { swap_id: swap.id, status: swap.status };
  }

  /** 审核互换申请 */
  async reviewSwap(userId: number, swapId: number, action: 'approved' | 'rejected') {
    const swap = await this.prisma.wechatSwap.findUnique({ where: { id: swapId } });
    if (!swap || swap.toUserId !== userId) throw new NotFoundException({ code: 'BIZ_001', message: '申请不存在' });
    if (swap.status !== 'pending') throw new ConflictException({ code: 'BIZ_031', message: '申请已处理' });
    await this.prisma.wechatSwap.update({ where: { id: swapId }, data: { status: action } });
    return { swap_id: swapId, status: action };
  }

  /** 查互换申请列表(收到的) */
  async getPendingSwaps(userId: number) {
    const swaps = await this.prisma.wechatSwap.findMany({
      where: { toUserId: userId, status: 'pending' },
      include: { fromUser: { select: { id: true, nickname: true } } },
    });
    return { items: swaps.map(s => ({ swap_id: s.id, from_user: s.fromUser, created_at: s.createdAt })) };
  }
}
