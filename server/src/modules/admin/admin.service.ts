import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ============ B 端管理 ============

  async bList(): Promise<{ items: { id: number; phone: string; name: string; status: string; feeCap: number; createdAt: string }[] }> {
    const rows = await this.prisma.bTenant.findMany({ orderBy: { createdAt: 'desc' } });
    return { items: rows.map((r) => ({ id: r.id, phone: r.phone, name: r.name, status: r.status, feeCap: r.feeCap, createdAt: r.createdAt.toISOString() })) };
  }

  async bCreate(data: { phone: string; name: string; feeCap?: number }): Promise<{ id: number; initToken: string }> {
    const exist = await this.prisma.bTenant.findUnique({ where: { phone: data.phone } });
    if (exist) throw new ConflictException({ code: 'BIZ_090', message: '手机号已注册' });
    const b = await this.prisma.bTenant.create({
      data: { phone: data.phone, passwordHash: 'uninit', name: data.name, feeCap: data.feeCap ?? 99900 },
    });
    return { id: b.id, initToken: `init_${b.phone}` };
  }

  async bUpdate(id: number, data: { name?: string; feeCap?: number; status?: string }): Promise<void> {
    const b = await this.prisma.bTenant.findUnique({ where: { id } });
    if (!b) throw new NotFoundException({ code: 'BIZ_001', message: 'B端不存在' });
    await this.prisma.bTenant.update({ where: { id }, data: { ...(data.name ? { name: data.name } : {}), ...(data.feeCap ? { feeCap: data.feeCap } : {}), ...(data.status ? { status: data.status as 'active' | 'disabled' } : {}) } });
  }

  async bDelete(id: number): Promise<void> {
    const b = await this.prisma.bTenant.findUnique({ where: { id } });
    if (!b) throw new NotFoundException({ code: 'BIZ_001', message: 'B端不存在' });
    const orders = await this.prisma.bOrder.count({ where: { bId: id } });
    if (orders > 0) throw new ConflictException({ code: 'BIZ_090', message: 'B端有未结算订单不可删' });
    await this.prisma.bTenant.delete({ where: { id } });
  }

  // ============ 项目审核 ============

  async projectAudit(id: number, action: string, score?: { authenticity?: number; risk?: number; profitability?: number }): Promise<void> {
    if (action === 'approved') {
      await this.prisma.project.update({ where: { id }, data: { auditStatus: 'approved' } });
      const project = await this.prisma.project.findUnique({ where: { id }, select: { bId: true } });
      if (project) {
        await this.prisma.projectScore.upsert({
          where: { projectId: id },
          update: { authenticity: score?.authenticity ?? 50, risk: score?.risk ?? 50, profitability: score?.profitability ?? 50 },
          create: { projectId: id, bId: project.bId, authenticity: score?.authenticity ?? 50, risk: score?.risk ?? 50, profitability: score?.profitability ?? 50 },
        });
      }
    } else {
      await this.prisma.project.update({ where: { id }, data: { auditStatus: 'rejected' } });
    }
  }

  async projectList(): Promise<{ items: { id: number; title: string; bName: string; auditStatus: string; createdAt: string }[] }> {
    const rows = await this.prisma.project.findMany({
      include: { bTenant: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { items: rows.map((r) => ({ id: r.id, title: r.title, bName: r.bTenant.name, auditStatus: r.auditStatus, createdAt: r.createdAt.toISOString() })) };
  }

  // ============ 看板 ============

  async dashboard(): Promise<{ bCount: number; cCount: number; projectCount: number; revenueTotal: number; revenueMonth: number }> {
    const [bCount, cCount, projectCount] = await Promise.all([
      this.prisma.bTenant.count(), this.prisma.cUser.count(), this.prisma.project.count(),
    ]);
    return { bCount, cCount, projectCount, revenueTotal: 0, revenueMonth: 0 };
  }
}