import { Controller, Get, Post, Put, Body, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { CoopService } from './coop.service';
import { SwapService } from './swap.service';
import { CurrentTenant, TenantContext } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/auth.decorator';

class PartnerDto { @IsString() name!: string; @IsString() phone!: string; @IsOptional() @IsString() info?: string; }
class SwapReviewDto { @IsString() action!: 'approved' | 'rejected'; }

// ── C端合作页 ────────────────────────────────────────
@UseGuards()
@Controller('c/coop')
export class CoopController {
  constructor(
    private readonly coop: CoopService,
    private readonly swap: SwapService,
  ) {}

  @Get('city-centers')
  cityCenters(@Query('region') region?: string) {
    return this.coop.cityCenterList(region);
  }

  @Post('city-centers/:id/join')
  joinCircle(@CurrentTenant() t: TenantContext, @Param('id', ParseIntPipe) id: number) {
    return this.coop.joinCircle(t, id);
  }

  @Post('city-centers/:id/favorite')
  favCenter(@CurrentTenant() t: TenantContext, @Param('id', ParseIntPipe) id: number) {
    return this.coop.favCenter(t, id);
  }

  @Post('city-centers/:id/partner-apply')
  partnerApply(@CurrentTenant() t: TenantContext, @Param('id', ParseIntPipe) id: number, @Body() dto: PartnerDto) {
    return this.coop.partnerApply(t, id, dto);
  }
}

// ── C端资源互换 ─────────────────────────────────────
@UseGuards()
@Controller('c/resource')
export class SwapController {
  constructor(private readonly swap: SwapService) {}

  @Get()
  resourceList(@Query('keyword') keyword?: string) {
    return this.swap.resourceList({ bId: null, entrySource: null, userId: null, role: null }, keyword);
  }

  @Post('swap')
  requestSwap(@CurrentTenant() t: TenantContext, @Body() dto: { to_user_id: number }) {
    if (!t.userId) throw new Error('未认证');
    return this.swap.requestSwap(t.userId, dto.to_user_id);
  }

  @Put('swap/:id')
  reviewSwap(@CurrentTenant() t: TenantContext, @Param('id', ParseIntPipe) id: number, @Body() dto: SwapReviewDto) {
    if (!t.userId) throw new Error('未认证');
    return this.swap.reviewSwap(t.userId, id, dto.action);
  }

  @Get('swap/pending')
  pendingSwaps(@CurrentTenant() t: TenantContext) {
    if (!t.userId) return { items: [] };
    return this.swap.getPendingSwaps(t.userId);
  }
}

// ── 总后台千人千面 ─────────────────────────────────
@UseGuards()
@Roles('platform_admin', 'b_tenant')
@Controller('admin/scene')
export class SceneController {
  constructor(private readonly coop: CoopService) {}

  @Post('generate')
  generateScene(@Body() dto: { b_id: number }) {
    return this.coop.generateScene(dto.b_id);
  }
}
