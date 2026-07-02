import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { IsString, IsOptional, IsIn, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AdminService } from './admin.service';
import { Roles, Public } from '../../common/decorators/auth.decorator';

class CreateBDto {
  @IsString() phone!: string;
  @IsString() name!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) feeCap?: number;
}

class UpdateBDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) feeCap?: number;
  @IsOptional() @IsString() status?: string;
}

class ProjectAuditDto {
  @IsIn(['approved', 'rejected']) action!: string;
  @IsOptional() authenticity?: number;
  @IsOptional() risk?: number;
  @IsOptional() profitability?: number;
}

@UseGuards()
@Roles('platform_admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('b')
  bList() { return this.admin.bList(); }
  @Post('b')
  bCreate(@Body() dto: CreateBDto) { return this.admin.bCreate(dto); }
  @Put('b/:id')
  bUpdate(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBDto) { return this.admin.bUpdate(id, dto); }
  @Delete('b/:id')
  async bDelete(@Param('id', ParseIntPipe) id: number) { await this.admin.bDelete(id); return null; }

  @Get('project')
  projectList() { return this.admin.projectList(); }
  @Put('project/:id/audit')
  projectAudit(@Param('id', ParseIntPipe) id: number, @Body() dto: ProjectAuditDto) { return this.admin.projectAudit(id, dto.action, { authenticity: dto.authenticity, risk: dto.risk, profitability: dto.profitability }); }

  @Get('data/dashboard')
  dashboard() { return this.admin.dashboard(); }
}