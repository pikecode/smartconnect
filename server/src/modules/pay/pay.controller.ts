import { Body, Controller, Get, Param, ParseIntPipe, Post, RawBodyRequest, Headers, Request, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { PayService } from './pay.service';
import { KycService } from './kyc.service';
import { CurrentTenant, TenantContext } from '../../common/decorators/current-tenant.decorator';
import { Public, Roles } from '../../common/decorators/auth.decorator';
import { UseGuards as UseGuardsNest } from '@nestjs/common';
import * as express from 'express';

class CreateOrderDto {
  @IsString() type!: 'bp_unlock' | 'join_project' | 'partner';
  @IsOptional() @Type(() => Number) @IsInt() project_id?: number;
}

class KycDto {
  @IsString() real_name!: string;
  @IsString() id_card!: string;
}

@UseGuards()
@Controller('c/pay')
export class PayController {
  constructor(
    private readonly pay: PayService,
    private readonly kyc: KycService,
  ) {}

  @Post('order')
  createOrder(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateOrderDto) {
    return this.pay.createOrder(tenant, dto.type, dto.project_id);
  }

  @Public()
  @Post('notify/wx')
  async wxNotify(
    @Request() req: express.Request,
    @Headers('Wechatpay-Signature') sig: string,
    @Headers('Wechatpay-Timestamp') ts: string,
    @Headers('Wechatpay-Nonce') nonce: string,
  ) {
    const raw = (req as RawBodyRequest<express.Request>).rawBody?.toString('utf-8') ?? '';
    await this.pay.handleNotify(raw, sig, ts, nonce);
    return { code: 'SUCCESS', message: '成功' };
  }

  @Get('order/:id')
  queryOrder(@CurrentTenant() tenant: TenantContext, @Param('id', ParseIntPipe) id: number) {
    return this.pay.queryOrder(tenant, id);
  }

  @Post('order/:id/refund')
  refund(@CurrentTenant() tenant: TenantContext, @Param('id', ParseIntPipe) id: number, @Body() dto: { reason?: string }) {
    return this.pay.refund(tenant, id, dto.reason ?? '用户申请退款');
  }
}

@UseGuards()
@Controller('c/me')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Post('kyc')
  submitKyc(@CurrentTenant() tenant: TenantContext, @Body() dto: KycDto) {
    if (!tenant.userId) throw new Error('未认证');
    return this.kyc.submit(tenant.userId, dto.real_name, dto.id_card);
  }

  @Get('kyc/status')
  kycStatus(@CurrentTenant() tenant: TenantContext) {
    if (!tenant.userId) return { status: null, verified_at: null };
    return this.kyc.getStatus(tenant.userId);
  }
}
