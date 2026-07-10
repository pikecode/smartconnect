import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsInt, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { CommissionService } from './commission.service';
import { CurrentTenant, TenantContext } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/auth.decorator';

class CommissionQueryDto {
  @IsOptional() @IsString() status?: string;
}

class AdminSettleDto {
  @IsOptional() @Type(() => Number) @IsInt() b_id?: number;
}

@UseGuards()
@Controller('c/me/commissions')
export class CommissionController {
  constructor(private readonly service: CommissionService) {}

  @Get()
  getUserCommissions(@CurrentTenant() t: TenantContext, @Query() q: CommissionQueryDto) {
    if (!t.userId) return { items: [], summary: { pending: 0, settled: 0, withdrawable: 0 } };
    return this.service.getUserCommissions(t.userId, q.status);
  }
}

@UseGuards()
@Roles('platform_admin')
@Controller('admin/commission')
export class AdminCommissionController {
  constructor(private readonly service: CommissionService) {}

  @Get()
  adminList(@Query() q: CommissionQueryDto & { b_id?: number }) {
    return this.service.adminList(q.b_id, q.status);
  }

  @Post('settle')
  settle(@Query() q: AdminSettleDto) {
    return this.service.settle(q.b_id);
  }
}
