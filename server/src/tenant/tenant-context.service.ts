import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/decorators/current-tenant.decorator';

/**
 * 租户上下文服务: 在事务内设置 app.b_id 使 RLS 生效。
 *
 * 用法: 业务层需要查租户表时,用 runInTenant 包裹:
 *   tenantCtx.runInTenant(tenant, async (tx) => {
 *     return tx.project.findMany({...});
 *   });
 *
 * SET LOCAL 仅在事务内有效,故必须用 $transaction。
 * RLS 做 DB 层兜底。
 */

/** 租户上下文 + 指定 bId 覆写(用于平台入口从 project 派生租户的场景) */
export interface TenantBId {
  bId: number;
}

@Injectable()
export class TenantContextService {
  private readonly logger = new Logger(TenantContextService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 用租户上下文执行事务。bId=null/undefined 时走平台公开策略(不设 app.b_id)。
   * 传 coverBId 可覆写 bId(用于平台入口从 project 派生租户)。
   */
  async runInTenant<T>(
    tenant: TenantContext,
    fn: (tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0]) => Promise<T>,
    coverBId?: number,
  ): Promise<T> {
    const bId = coverBId ?? tenant.bId;
    const userId = tenant.userId;

    return this.prisma.$transaction(async (tx) => {
      if (bId !== null && bId !== undefined) {
        // SET LOCAL 不支持参数化查询，bId/userId 为内部整数，安全使用字面量
        await tx.$executeRawUnsafe(`SET LOCAL "app.b_id" = '${Number(bId)}'`);
      }
      if (userId !== null && userId !== undefined) {
        await tx.$executeRawUnsafe(`SET LOCAL "app.user_id" = '${Number(userId)}'`);
      }
      this.logger.debug(`RLS context set: b_id=${bId}, user_id=${userId}`);
      return fn(tx);
    });
  }
}
