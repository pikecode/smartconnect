import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { UserService } from './user.service';
import { CurrentTenant, TenantContext } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/auth.decorator';

class UserQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() project_id?: number;
}

@UseGuards()
@Roles('b_tenant')
@Controller('b/user')
export class UserController {
  constructor(private readonly user: UserService) {}

  @Get('views')
  views(@CurrentTenant() t: TenantContext, @Query() q: UserQueryDto) {
    return this.user.views(t, q.project_id);
  }

  @Get('joined')
  joined(@CurrentTenant() t: TenantContext, @Query() q: UserQueryDto) {
    return this.user.joined(t, q.project_id);
  }

  @Get('referrals')
  referrals(@CurrentTenant() t: TenantContext) {
    return this.user.referrals(t);
  }
}
