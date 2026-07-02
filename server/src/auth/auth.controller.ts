import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { IsString, IsOptional, IsInt, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/auth.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';

class WxLoginDto {
  @IsString() @MinLength(1) code!: string;
  @IsOptional() @Type(() => Number) @IsInt() sceneBId?: number;
  @IsOptional() @IsString() sceneSig?: string;
  @IsOptional() @Type(() => Number) @IsInt() inviteUserId?: number;
}

class BindPhoneDto {
  @IsString() @MinLength(11) phone!: string;
  @IsString() smsCode!: string;
}

class SendSmsDto {
  @IsString() @MinLength(11) phone!: string;
}

class BLoginDto {
  @IsString() phone!: string;
  @IsString() @MinLength(6) password!: string;
}

class BInitPasswordDto {
  @IsString() init_token!: string;
  @IsString() @MinLength(8) password!: string;
}

@Controller('c/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('wx-login')
  wxLogin(@Body() dto: WxLoginDto) { return this.auth.wxLogin(dto); }

  @UseGuards()
  @Post('bind-phone')
  bindPhone(@Request() req: { tenant?: { userId: number | null } }, @Body() dto: BindPhoneDto) {
    const uid = req.tenant?.userId;
    if (!uid) throw new Error('未认证');
    return this.auth.bindPhone(uid, dto.phone, dto.smsCode);
  }

  @Public()
  @Post('send-sms')
  sendSms(@Body() dto: SendSmsDto) {
    // MVP mock: 验证码 123456, 不真发
    void dto;
    return { success: true, message: '短信发送成功(模拟)', code: '123456' };
  }
}
