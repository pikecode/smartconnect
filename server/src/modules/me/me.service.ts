import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { TenantContext } from '../../common/decorators/current-tenant.decorator';
import { AuthService } from '../../auth/auth.service';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
    private readonly authService: AuthService,
  ) {}

  async getMe(tenant: TenantContext): Promise<{
    user: { id: number; phone: string | null; nickname: string | null };
    entry_source: string | null;
  }> {
    if (!tenant.userId) {
      return { user: { id: 0, phone: null, nickname: null }, entry_source: null };
    }

    const user = await this.prisma.cUser.findUnique({
      where: { id: tenant.userId },
      select: { id: true, phone: true, nickname: true },
    });

    return {
      user: {
        id: user?.id ?? 0,
        phone: user?.phone ? this.maskPhone(user.phone) : null,
        nickname: user?.nickname ?? null,
      },
      entry_source: tenant.entrySource,
    };
  }

  async getFavorites(tenant: TenantContext): Promise<{ items: { project_id: number; title: string }[] }> {
    if (!tenant.userId) return { items: [] };

    // userFavorite 是租户表, 走 runInTenant; 收藏跨多 B 端, bId=null(平台豁免)
    const favs = await this.tenantCtx.runInTenant(tenant, (tx) =>
      tx.userFavorite.findMany({
        where: { userId: tenant.userId!, targetType: 'project' },
      }),
    );
    // project 是租户表, 走 runInTenant 公开查询
    const projects = await this.tenantCtx.runInTenant(tenant, (tx) =>
      tx.project.findMany({
        where: { id: { in: favs.map((f) => f.targetId) } },
        select: { id: true, title: true },
      }),
    );
    return { items: projects.map((p) => ({ project_id: p.id, title: p.title })) };
  }

  async getJoined(tenant: TenantContext): Promise<{ items: { project_id: number; title: string; joined_at: string; unlock_contact: boolean }[] }> {
    if (!tenant.userId) return { items: [] };

    // userJoin 是租户表, 走 runInTenant
    const joins = await this.tenantCtx.runInTenant(tenant, (tx) =>
      tx.userJoin.findMany({
        where: { userId: tenant.userId! },
        include: { project: { select: { id: true, title: true } } },
      }),
    );
    return {
      items: joins.map((j) => ({
        project_id: j.project.id, title: j.project.title,
        joined_at: j.joinedAt.toISOString(), unlock_contact: j.unlockContact,
      })),
    };
  }

  async getReferrals(tenant: TenantContext): Promise<{ items: { user_id: number; nickname: string | null; joined_count: number }[] }> {
    const bId = tenant.bId;
    if (!tenant.userId || !bId) return { items: [] };

    const refs = await this.tenantCtx.runInTenant(tenant, (tx) =>
      tx.userReferral.findMany({
        where: { referrerId: tenant.userId!, bId },
        include: { referred: { select: { id: true, nickname: true } } },
      }),
    );

    return {
      items: refs.map((r) => ({
        user_id: r.referred.id,
        nickname: r.referred.nickname,
        joined_count: 0, // TODO: 聚合下级的加入数
      })),
    };
  }

  async getBPortal(tenant: TenantContext): Promise<{ url: string; expires_at: string }> {
    if (!tenant.bId) {
      throw new ForbiddenException({ code: 'AUTH_012', message: '仅B端用户可访问' });
    }
    const raw = this.authService.generateInitToken();
    const tokenHash = this.authService.hashInitToken(raw);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await this.prisma.bInitToken.create({ data: { bId: tenant.bId, tokenHash, expiresAt } });
    return { url: `http://localhost:5173/init-password?token=${raw}`, expires_at: expiresAt.toISOString() };
  }

  private maskPhone(phone: string): string {
    return phone.length >= 11 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone;
  }
}
