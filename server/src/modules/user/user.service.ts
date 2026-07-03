import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { TenantContext } from '../../common/decorators/current-tenant.decorator';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  async views(tenant: TenantContext, projectId?: number) {
    const bId = tenant.bId;
    if (!bId) return { items: [] };
    return this.tenantCtx.runInTenant(tenant, async (tx) => {
      const joins = await tx.userJoin.findMany({
        where: { bId, ...(projectId ? { projectId } : {}) },
        include: { cUser: { select: { id: true, nickname: true } }, project: { select: { id: true, title: true } } },
        orderBy: { joinedAt: 'desc' },
      });
      return {
        items: joins.map((j) => ({
          user_id: j.cUser.id,
          nickname: j.cUser.nickname,
          project_id: j.project.id,
          view_time: j.joinedAt.toISOString(),
          duration_sec: 0, // 浏览时长暂无实际数据
          is_favorited: false,
          forward_count: 0,
        })),
      };
    });
  }

  async joined(tenant: TenantContext, projectId?: number) {
    const bId = tenant.bId;
    if (!bId) return { items: [] };
    return this.tenantCtx.runInTenant(tenant, async (tx) => {
      const joins = await tx.userJoin.findMany({
        where: { bId, ...(projectId ? { projectId } : {}) },
        include: { cUser: { select: { id: true, nickname: true, phone: true } }, project: { select: { id: true, title: true } } },
        orderBy: { joinedAt: 'desc' },
      });
      return {
        items: joins.map((j) => ({
          user_id: j.cUser.id,
          nickname: j.cUser.nickname,
          phone: j.cUser.phone ? j.cUser.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null,
          project_id: j.project.id,
          project_title: j.project.title,
          joined_at: j.joinedAt.toISOString(),
          unlock_contact: j.unlockContact,
        })),
      };
    });
  }

  async referrals(tenant: TenantContext) {
    const bId = tenant.bId;
    if (!bId) return { items: [] };
    return this.tenantCtx.runInTenant(tenant, async (tx) => {
      const refs = await tx.userReferral.findMany({
        where: { bId },
        include: {
          referrer: { select: { id: true, nickname: true } },
          referred: { select: { id: true, nickname: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      // 按推荐人聚合
      const map = new Map<number, { user_id: number; nickname: string | null; referred_count: number; joined_count: number }>();
      for (const r of refs) {
        const existing = map.get(r.referrerId) ?? { user_id: r.referrerId, nickname: r.referrer.nickname, referred_count: 0, joined_count: 0 };
        existing.referred_count += 1;
        map.set(r.referrerId, existing);
      }
      return { items: Array.from(map.values()) };
    });
  }
}
