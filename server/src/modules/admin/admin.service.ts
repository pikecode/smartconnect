import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../../auth/auth.service';

/** 总后台 /admin 接口。所有租户表查询走 runInTenant(null) 跨 B 端访问 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /** 事务内执行跨租户操作，设 app.is_admin = 'true' 绕过 RLS 租户隔离 */
  private async bypass<T>(fn: (tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0]) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.is_admin = 'true'`;
      return fn(tx);
    });
  }

  async bList(): Promise<{ items: { id: number; phone: string; name: string; status: string; feeCap: number; createdAt: string }[] }> {
    const rows = await this.prisma.bTenant.findMany({ orderBy: { createdAt: 'desc' } });
    return { items: rows.map((r) => ({ id: r.id, phone: r.phone, name: r.name, status: r.status, feeCap: r.feeCap, createdAt: r.createdAt.toISOString() })) };
  }

  async bCreate(data: { phone: string; name: string; feeCap?: number }): Promise<{ id: number; initToken: string }> {
    const exist = await this.prisma.bTenant.findUnique({ where: { phone: data.phone } });
    if (exist) throw new ConflictException({ code: 'BIZ_090', message: '手机号已注册' });

    const raw = this.authService.generateInitToken();
    const tokenHash = this.authService.hashInitToken(raw);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const b = await this.bypass(async (tx) => {
      // passwordHash 初始值为占位符，首登后改为 bcrypt
      const created = await tx.bTenant.create({
        data: { phone: data.phone, passwordHash: 'uninit', name: data.name, feeCap: data.feeCap ?? 99900 },
      });
      // init token 独立存储，30 分钟过期
      await tx.bInitToken.create({ data: { bId: created.id, tokenHash, expiresAt } });
      return created;
    });

    return { id: b.id, initToken: raw };
  }

  async bUpdate(id: number, data: { name?: string; feeCap?: number; status?: string }): Promise<void> {
    await this.bypass(async (tx) => {
      const b = await tx.bTenant.findUnique({ where: { id } });
      if (!b) throw new NotFoundException({ code: 'BIZ_001', message: 'B端不存在' });
      await tx.bTenant.update({ where: { id },
        data: { ...(data.name ? { name: data.name } : {}), ...(data.feeCap ? { feeCap: data.feeCap } : {}), ...(data.status ? { status: data.status as 'active' | 'disabled' } : {}) },
      });
    });
  }

  async bDelete(id: number): Promise<void> {
    await this.bypass(async (tx) => {
      const b = await tx.bTenant.findUnique({ where: { id } });
      if (!b) throw new NotFoundException({ code: 'BIZ_001', message: 'B端不存在' });
      const orders = await tx.bOrder.count({ where: { bId: id } });
      if (orders > 0) throw new ConflictException({ code: 'BIZ_090', message: 'B端有未结算订单不可删' });
      await tx.bTenant.delete({ where: { id } });
    });
  }

  async projectAudit(id: number, action: string, score?: { authenticity?: number; risk?: number; profitability?: number }): Promise<void> {
    await this.bypass(async (tx) => {
      if (action === 'approved') {
        await tx.project.update({ where: { id }, data: { auditStatus: 'approved' } });
        const project = await tx.project.findUnique({ where: { id }, select: { bId: true } });
        if (project) {
          await tx.projectScore.upsert({
            where: { projectId: id },
            update: { authenticity: score?.authenticity ?? 50, risk: score?.risk ?? 50, profitability: score?.profitability ?? 50 },
            create: { projectId: id, bId: project.bId, authenticity: score?.authenticity ?? 50, risk: score?.risk ?? 50, profitability: score?.profitability ?? 50 },
          });
        }
      } else {
        await tx.project.update({ where: { id }, data: { auditStatus: 'rejected' } });
      }
    });
  }

  async projectList(): Promise<{ items: { id: number; title: string; bName: string; auditStatus: string; createdAt: string }[] }> {
    const rows = await this.bypass((tx) =>
      tx.project.findMany({
        include: { bTenant: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
    return { items: rows.map((r) => ({ id: r.id, title: r.title, bName: r.bTenant.name, auditStatus: r.auditStatus, createdAt: r.createdAt.toISOString() })) };
  }

  async dashboard(): Promise<{ bCount: number; cCount: number; projectCount: number; revenueTotal: number; revenueMonth: number }> {
    const [bCount, cCount, projectCount] = await Promise.all([
      this.prisma.bTenant.count(), this.prisma.cUser.count(), this.prisma.project.count(),
    ]);
    return { bCount, cCount, projectCount, revenueTotal: 0, revenueMonth: 0 };
  }
}
