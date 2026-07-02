import { Controller, Get, UseGuards, ForbiddenException, Post } from '@nestjs/common';
import { MeService } from './me.service';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '../../common/decorators/current-tenant.decorator';
import { Public } from '../../common/decorators/auth.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@UseGuards()
@Controller('c/me')
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getMe(@CurrentTenant() tenant: TenantContext) {
    return this.me.getMe(tenant);
  }

  @Get('favorites')
  getFavorites(@CurrentTenant() tenant: TenantContext) {
    return this.me.getFavorites(tenant);
  }

  @Get('joined')
  getJoined(@CurrentTenant() tenant: TenantContext) {
    return this.me.getJoined(tenant);
  }

  @Get('referrals')
  getReferrals(@CurrentTenant() tenant: TenantContext) {
    return this.me.getReferrals(tenant);
  }

  @Get('b-portal')
  bPortal(@CurrentTenant() tenant: TenantContext) {
    return this.me.getBPortal(tenant);
  }
}
