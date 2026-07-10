import { Controller, Get, UseGuards, Post, Body } from '@nestjs/common';
import { MeService } from './me.service';
import { CurrentTenant, TenantContext } from '../../common/decorators/current-tenant.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class WithdrawDto { @Type(() => Number) @IsInt() @Min(1000) amount!: number; }

@UseGuards()
@Controller('c/me')
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly prisma: PrismaService,
  ) {}

  @Get() getMe(@CurrentTenant() t: TenantContext) { return this.me.getMe(t); }
  @Get('favorites') getFavorites(@CurrentTenant() t: TenantContext) { return this.me.getFavorites(t); }
  @Get('joined') getJoined(@CurrentTenant() t: TenantContext) { return this.me.getJoined(t); }
  @Get('referrals') getReferrals(@CurrentTenant() t: TenantContext) { return this.me.getReferrals(t); }
  @Get('b-portal') bPortal(@CurrentTenant() t: TenantContext) { return this.me.getBPortal(t); }
  @Post('withdraw') withdraw(@CurrentTenant() t: TenantContext, @Body() dto: WithdrawDto) { return this.me.withdraw(t, dto.amount); }
}
