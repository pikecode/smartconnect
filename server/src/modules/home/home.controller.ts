import { Controller, Get, UseGuards } from '@nestjs/common';
import { HomeService } from './home.service';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '../../common/decorators/current-tenant.decorator';

@UseGuards()
@Controller('c/home')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get()
  getHome(@CurrentTenant() tenant: TenantContext) {
    return this.home.getHome(tenant);
  }
}
