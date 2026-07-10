import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { TenantContext } from '../../common/decorators/current-tenant.decorator';

export interface ListQuery {
  page?: number;
  page_size?: number;
  category_id?: number;
  keyword?: string;
  region?: string;
}

export interface ProjectListItem {
  id: number;
  title: string;
  one_liner: string;
  category: { id: number; name: string };
  join_mode: string;
  join_price: number;
  bp_price: number;
}

export interface ProjectDetail {
  id: number;
  title: string;
  one_liner: string;
  intro: string | null;
  vision: string | null;
  goals: string | null;
  team: string | null;
  technology: string | null;
  competition: string | null;
  requirements: string | null;
  swot: unknown;
  company_info: unknown;
  qcc_url: string | null;
  founder_intro: string | null;
  origin_story: string | null;
  join_requirement: string | null;
  join_mode: string;
  join_price: number;
  score: { authenticity: number; risk: number; profitability: number; review_count: number } | null;
  bp: { locked: boolean; price: number };
  is_favorited: boolean;
  is_joined: boolean;
  contact?: { name: string | null; phone: string | null; wechat: string | null };
}

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  async list(tenant: TenantContext, q: ListQuery): Promise<{ items: ProjectListItem[] }> {
    const page = q.page ?? 1;
    const pageSize = Math.min(q.page_size ?? 20, 50);
    const bId = tenant.bId;

    return this.tenantCtx.runInTenant(tenant, async (tx) => {
      const where = {
        ...(bId ? { bId } : {}),
        ...(q.category_id ? { categoryId: q.category_id } : {}),
        ...(q.keyword ? { title: { contains: q.keyword, mode: 'insensitive' as const } } : {}),
        auditStatus: 'approved' as const,
      };

      const [rows, total] = await Promise.all([
        tx.project.findMany({
          where,
          take: pageSize,
          skip: (page - 1) * pageSize,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, title: true, oneLiner: true,
            joinMode: true, joinPrice: true, bpPrice: true,
            category: { select: { id: true, name: true } },
          },
        }),
        tx.project.count({ where }),
      ]);

      const items: ProjectListItem[] = rows.map((r) => ({
        id: r.id, title: r.title, one_liner: r.oneLiner,
        category: r.category, join_mode: r.joinMode, join_price: r.joinPrice, bp_price: r.bpPrice,
      }));
      return { items, total, page, page_size: pageSize };
    });
  }

  async detail(tenant: TenantContext, id: number): Promise<ProjectDetail> {
    const project = await this.tenantCtx.runInTenant(tenant, async (tx) => {
      return tx.project.findUnique({
        where: { id },
        include: { score: true, category: true },
      });
    });

    if (!project || project.auditStatus !== 'approved') {
      throw new NotFoundException({ code: 'BIZ_001', message: '项目不存在或未审核' });
    }

    const userId = tenant.userId;
    const projBId = project.bId;

    // 权限边界查询: 租户表统一走 runInTenant, 平台入口用 project.bId 覆写
    let isJoined = false;
    let isFavorited = false;
    if (userId) {
      const [join, fav] = await Promise.all([
        this.tenantCtx.runInTenant(tenant, (tx) =>
          tx.userJoin.findUnique({ where: { userId_projectId: { userId, projectId: id } } }),
          projBId,
        ),
        this.tenantCtx.runInTenant(tenant, (tx) =>
          tx.userFavorite.findFirst({ where: { userId, targetType: 'project', targetId: id } }),
          projBId,
        ),
      ]);
      isJoined = join !== null;
      isFavorited = fav !== null;
    }

    const result: ProjectDetail = {
      id: project.id, title: project.title, one_liner: project.oneLiner,
      intro: project.intro, vision: project.vision, goals: project.goals,
      team: project.team, technology: project.technology, competition: project.competition,
      requirements: project.requirements,
      swot: project.swot, company_info: project.companyInfo,
      qcc_url: this.validateQccUrl(project.qccUrl),
      founder_intro: project.founderIntro, origin_story: project.originStory,
      join_requirement: project.joinRequirement,
      join_mode: project.joinMode, join_price: project.joinPrice,
      score: project.score ? {
        authenticity: project.score.authenticity,
        risk: project.score.risk,
        profitability: project.score.profitability,
        review_count: project.score.reviewCount,
      } : null,
      bp: { locked: true, price: project.bpPrice },
      is_favorited: isFavorited,
      is_joined: isJoined,
    };

    // 联系信息: 仅加入用户可见(从城市运营中心取, 租户表)
    if (isJoined) {
      const cc = await this.tenantCtx.runInTenant(tenant, (tx) =>
        tx.cityCenter.findFirst({ where: { bId: projBId } }),
        projBId,
      );
      result.contact = {
        name: cc?.contactName ?? null,
        phone: cc?.contactPhone ?? null,
        wechat: cc?.contactWechat ?? null,
      };
    }

    return result;
  }

  async favorite(tenant: TenantContext, projectId: number): Promise<{ favorite_id: number }> {
    if (!tenant.userId) {
      throw new NotFoundException({ code: 'TENANT_002', message: '无租户上下文' });
    }

    // 从 project 派生 bId(平台入口无 JWT bId)
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { bId: true },
    });
    if (!project) {
      throw new NotFoundException({ code: 'BIZ_001', message: '项目不存在' });
    }
    const projBId = project.bId;

    const fav = await this.tenantCtx.runInTenant(tenant, (tx) =>
      tx.userFavorite.upsert({
        where: { userId_targetType_targetId: { userId: tenant.userId!, targetType: 'project', targetId: projectId } },
        update: {},
        create: { userId: tenant.userId!, bId: projBId, targetType: 'project', targetId: projectId },
      }),
      projBId,
    );
    return { favorite_id: fav.id };
  }

  async unfavorite(tenant: TenantContext, projectId: number): Promise<void> {
    if (!tenant.userId) return;
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { bId: true },
    });
    if (!project) return;

    await this.tenantCtx.runInTenant(tenant, (tx) =>
      tx.userFavorite.deleteMany({
        where: { userId: tenant.userId!, targetType: 'project', targetId: projectId },
      }),
      project.bId,
    );
  }

  async join(tenant: TenantContext, projectId: number): Promise<{ joined: true }> {
    const userId = tenant.userId;
    if (!userId) {
      throw new NotFoundException({ code: 'TENANT_002', message: '无租户上下文' });
    }

    // 平台入口: 从 project 派生 bId
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, bId: true, joinMode: true, auditStatus: true },
    });
    if (!project || project.auditStatus !== 'approved') {
      throw new NotFoundException({ code: 'BIZ_001', message: '项目不存在' });
    }
    const projBId = project.bId;

    if (project.joinMode !== 'free') {
      // 付费加入: 返回需支付标志，由前端调 /c/pay/order
      return { joined: false, requires_payment: true, project_id: projectId } as unknown as { joined: true };
    }

    try {
      await this.tenantCtx.runInTenant(tenant, (tx) =>
        tx.userJoin.create({
          data: { userId, bId: projBId, projectId, unlockContact: true },
        }),
        projBId,
      );
    } catch {
      throw new ConflictException({ code: 'BIZ_020', message: '已加入该项目' });
    }
    return { joined: true };
  }

  private validateQccUrl(url: string | null): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      if (parsed.hostname.endsWith('qcc.com')) return url;
      return null;
    } catch {
      return null;
    }
  }

  // ============ B 端项目 CRUD ============

  async bList(tenant: TenantContext): Promise<{ items: { id: number; title: string; audit_status: string; join_count: number; created_at: string }[] }> {
    const bId = tenant.bId;
    if (!bId) throw new NotFoundException({ code: 'TENANT_002', message: '无租户上下文' });

    return this.tenantCtx.runInTenant(tenant, async (tx) => {
      const rows = await tx.project.findMany({
        where: { bId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, auditStatus: true, createdAt: true },
      });
      const joinCounts = await tx.userJoin.groupBy({ by: ['projectId'], _count: true });
      const countMap = new Map(joinCounts.map((j) => [j.projectId, j._count]));

      return {
        items: rows.map((r) => ({
          id: r.id, title: r.title,
          audit_status: r.auditStatus,
          join_count: countMap.get(r.id) ?? 0,
          created_at: r.createdAt.toISOString(),
        })),
      };
    });
  }

  async bCreate(tenant: TenantContext, data: { title: string; one_liner: string; category_id: number; intro?: string; vision?: string; join_mode?: string; join_price?: number }): Promise<{ id: number }> {
    const bId = tenant.bId;
    if (!bId) throw new NotFoundException({ code: 'TENANT_002', message: '无租户上下文' });

    const bTenant = await this.prisma.bTenant.findUnique({ where: { id: bId }, select: { feeCap: true } });
    const feeCap = bTenant?.feeCap ?? 99900;
    const joinPrice = data.join_price ?? 0;
    if (joinPrice > feeCap) {
      throw new ConflictException({ code: 'BIZ_080', message: `加入价格超过上限(${feeCap / 100}元)` });
    }

    const project = await this.tenantCtx.runInTenant(tenant, async (tx) => {
      return tx.project.create({
        data: {
          bId,
          categoryId: data.category_id,
          title: data.title,
          oneLiner: data.one_liner,
          intro: data.intro,
          vision: data.vision,
          joinMode: (data.join_mode === 'paid' ? 'paid' : 'free') as 'free' | 'paid',
          joinPrice,
          auditStatus: 'pending',
        },
      });
    });
    return { id: project.id };
  }

  async bUpdate(tenant: TenantContext, id: number, data: { title?: string; one_liner?: string; intro?: string; vision?: string; join_mode?: string; join_price?: number }): Promise<void> {
    const bId = tenant.bId;
    if (!bId) throw new NotFoundException({ code: 'TENANT_002', message: '无租户上下文' });

    await this.tenantCtx.runInTenant(tenant, async (tx) => {
      const project = await tx.project.findUnique({ where: { id } });
      if (!project || project.bId !== bId) {
        throw new NotFoundException({ code: 'BIZ_001', message: '项目不存在' });
      }
      return tx.project.update({
        where: { id },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.one_liner !== undefined ? { oneLiner: data.one_liner } : {}),
          ...(data.intro !== undefined ? { intro: data.intro } : {}),
          ...(data.vision !== undefined ? { vision: data.vision } : {}),
          ...(data.join_mode !== undefined ? { joinMode: data.join_mode as 'free' | 'paid' } : {}),
          ...(data.join_price !== undefined ? { joinPrice: data.join_price } : {}),
        },
      });
    });
  }

  async bDelete(tenant: TenantContext, id: number): Promise<void> {
    const bId = tenant.bId;
    if (!bId) throw new NotFoundException({ code: 'TENANT_002', message: '无租户上下文' });

    await this.tenantCtx.runInTenant(tenant, async (tx) => {
      const project = await tx.project.findUnique({ where: { id } });
      if (!project || project.bId !== bId) {
        throw new NotFoundException({ code: 'BIZ_001', message: '项目不存在' });
      }
      // 有付费加入的项目不可物理删, 软删通过状态
      const hasJoins = await tx.userJoin.count({ where: { projectId: id } });
      if (hasJoins > 0) {
        throw new ConflictException({ code: 'BIZ_081', message: '项目有加入记录不可删' });
      }
      await tx.project.delete({ where: { id } });
    });
  }

  async bJoinSetting(tenant: TenantContext, projectId: number, data: { join_mode: string; join_price?: number }): Promise<void> {
    const bId = tenant.bId;
    if (!bId) throw new NotFoundException({ code: 'TENANT_002', message: '无租户上下文' });

    const bTenant = await this.prisma.bTenant.findUnique({ where: { id: bId }, select: { feeCap: true } });
    const feeCap = bTenant?.feeCap ?? 99900;
    const joinPrice = data.join_price ?? 0;
    if (data.join_mode === 'paid' && joinPrice > feeCap) {
      throw new ConflictException({ code: 'BIZ_080', message: `加入价格超过上限(${feeCap / 100}元)` });
    }

    await this.tenantCtx.runInTenant(tenant, (tx) =>
      tx.project.update({
        where: { id: projectId },
        data: { joinMode: data.join_mode as 'free' | 'paid', joinPrice },
      }),
    );
  }

  // ============ C 端申请发布项目(v0.1 免费审核) ============

  async apply(tenant: TenantContext, data: { title: string; one_liner: string; category_id: number; phone: string }): Promise<{ apply_id: number }> {
    if (!tenant.userId) throw new NotFoundException({ code: 'TENANT_002', message: '无用户上下文' });

    // 查用户是否已有 B 端身份, 没有则创建(通过 phone 匹配或新建)
    let bTenant = await this.prisma.bTenant.findUnique({ where: { phone: data.phone } });
    if (!bTenant) {
      bTenant = await this.prisma.bTenant.create({
        data: {
          phone: data.phone,
          passwordHash: 'uninit', // 首登初始化
          name: data.title.slice(0, 20) + '运营中心',
          feeCap: 99900,
        },
      });
    }

    // 创建项目(pending 审核)
    const project = await this.tenantCtx.runInTenant(tenant, (tx) =>
      tx.project.create({
        data: {
          bId: bTenant.id,
          categoryId: data.category_id,
          title: data.title,
          oneLiner: data.one_liner,
          auditStatus: 'pending',
        },
      }),
      bTenant.id,
    );

    return { apply_id: project.id };
  }
}
