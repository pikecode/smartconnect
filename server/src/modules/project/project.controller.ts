import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ProjectService } from './project.service';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '../../common/decorators/current-tenant.decorator';
import { Public, Roles } from '../../common/decorators/auth.decorator';

class ListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page_size?: number;
  @IsOptional() @Type(() => Number) @IsInt() category_id?: number;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsString() region?: string;
}

class CreateProjectDto {
  @IsString() title!: string;
  @IsString() one_liner!: string;
  @Type(() => Number) @IsInt() category_id!: number;
  @IsOptional() @IsString() intro?: string;
  @IsOptional() @IsString() vision?: string;
  @IsOptional() @IsString() join_mode?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) join_price?: number;
}

class UpdateProjectDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() one_liner?: string;
  @IsOptional() @IsString() intro?: string;
  @IsOptional() @IsString() vision?: string;
  @IsOptional() @IsIn(['free', 'paid']) join_mode?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) join_price?: number;
}

class JoinSettingDto {
  @IsIn(['free', 'paid']) join_mode!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) join_price?: number;
}

class ApplyProjectDto {
  @IsString() title!: string;
  @IsString() one_liner!: string;
  @Type(() => Number) @IsInt() category_id!: number;
  @IsString() phone!: string;
}

@UseGuards()
@Controller('c/project')
export class ProjectController {
  constructor(private readonly project: ProjectService) {}

  @Public()
  @Get()
  list(@CurrentTenant() tenant: TenantContext, @Query() q: ListQueryDto) {
    return this.project.list(tenant, q);
  }

  @Public()
  @Get(':id')
  detail(@CurrentTenant() tenant: TenantContext, @Param('id', ParseIntPipe) id: number) {
    return this.project.detail(tenant, id);
  }

  @Post(':id/favorite')
  favorite(@CurrentTenant() tenant: TenantContext, @Param('id', ParseIntPipe) id: number) {
    return this.project.favorite(tenant, id);
  }

  @Delete(':id/favorite')
  async unfavorite(@CurrentTenant() tenant: TenantContext, @Param('id', ParseIntPipe) id: number) {
    await this.project.unfavorite(tenant, id);
    return null;
  }

  @Post(':id/join')
  join(@CurrentTenant() tenant: TenantContext, @Param('id', ParseIntPipe) id: number) {
    return this.project.join(tenant, id);
  }

  @Public()
  @Post('apply')
  apply(@CurrentTenant() tenant: TenantContext, @Body() dto: ApplyProjectDto) {
    return this.project.apply(tenant, dto);
  }
}

@UseGuards()
@Roles('b_tenant')
@Controller('b/project')
export class BProjectController {
  constructor(private readonly project: ProjectService) {}

  @Get()
  bList(@CurrentTenant() tenant: TenantContext) {
    return this.project.bList(tenant);
  }

  @Post()
  bCreate(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateProjectDto) {
    return this.project.bCreate(tenant, dto);
  }

  @Put(':id')
  bUpdate(@CurrentTenant() tenant: TenantContext, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProjectDto) {
    return this.project.bUpdate(tenant, id, dto);
  }

  @Delete(':id')
  async bDelete(@CurrentTenant() tenant: TenantContext, @Param('id', ParseIntPipe) id: number) {
    await this.project.bDelete(tenant, id);
    return null;
  }

  @Put(':id/join-setting')
  bJoinSetting(@CurrentTenant() tenant: TenantContext, @Param('id', ParseIntPipe) id: number, @Body() dto: JoinSettingDto) {
    return this.project.bJoinSetting(tenant, id, dto);
  }
}
