import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { TenantContext } from '../../common/decorators/current-tenant.decorator';

export interface HomeData {
  stats: { total_users: number; recent_viewers: { id: number; nickname: string | null }[] };
  slogan: string;
  dynamics: { id: number; projectId: number; title: string; content: string | null }[];
}

@Injectable()
export class HomeService {
  private readonly slogan = '向割韭菜说不,为您精准匹配好项目';

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  async getHome(tenant: TenantContext): Promise<HomeData> {
    // 平台入口: 全局统计; B端入口: 该B端范围
    const bId = tenant.bId;

    const totalUsers = await this.prisma.cUser.count();

    const recentUsers = await this.prisma.cUser.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, nickname: true },
    });

    const dynamics = await this.tenantCtx.runInTenant(tenant, async (tx) => {
      const where = bId ? { bId } : {};
      return tx.projectDynamic.findMany({
        where,
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { id: true, projectId: true, title: true, content: true },
      });
    });

    return {
      stats: {
        total_users: totalUsers,
        recent_viewers: recentUsers.map((u) => ({ id: u.id, nickname: u.nickname })),
      },
      slogan: this.slogan,
      dynamics,
    };
  }
}
