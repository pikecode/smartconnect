import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

interface WxLoginInput {
  code: string;
  sceneBId?: number;
  sceneSig?: string;
  inviteUserId?: number;
}

interface JwtPayload {
  uid: number;
  role: 'c_user' | 'b_tenant' | 'platform_admin';
  tenant_context: { b_id: number | null; entry_source: 'platform' | 'b_only' };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  async wxLogin(input: WxLoginInput): Promise<{ token: string; user: { id: number; phone: string | null; isNew: boolean } }> {
    // TODO: 用 wx.code 换 openid (需 WX_APPID/SECRET), MVP 用 code 作伪 openid
    const openid = `wx_${input.code}`;

    let user = await this.prisma.cUser.findUnique({ where: { openid } });
    const isNew = user === null;

    if (!user) {
      user = await this.prisma.cUser.create({ data: { openid } });
    }

    // scene 绑定租户关系 (仅首次)
    if (isNew && input.sceneBId && input.sceneSig) {
      await this.bindScene(user.id, input.sceneBId, input.sceneSig, input.inviteUserId);
    }

    const tenantRel = await this.prisma.userTenantRelation.findFirst({
      where: { userId: user.id },
    });

    const payload: JwtPayload = {
      uid: user.id,
      role: 'c_user',
      tenant_context: {
        b_id: tenantRel?.bId ?? null,
        entry_source: tenantRel?.entrySource ?? 'platform',
      },
    };

    const token = await this.jwt.signAsync(payload);
    return { token, user: { id: user.id, phone: user.phone, isNew } };
  }

  async bindPhone(userId: number, phone: string, smsCode: string): Promise<{ id: number; phone: string }> {
    // MVP: mock 验证码 123456
    if (smsCode !== '123456') {
      throw new UnauthorizedException({ code: 'AUTH_002', message: '短信码错误' });
    }

    const existing = await this.prisma.cUser.findFirst({ where: { phone } });
    if (existing && existing.id !== userId) {
      throw new ConflictException({ code: 'BIZ_010', message: '手机号已绑定其他账号' });
    }

    const masked = this.maskPhone(phone);
    await this.prisma.cUser.update({ where: { id: userId }, data: { phone } });
    return { id: userId, phone: masked };
  }

  private async bindScene(userId: number, bId: number, sig: string, inviteUserId?: number): Promise<void> {
    // TODO: 校验 sceneSig 签名 (HMAC), MVP 跳过
    void sig;

    const bTenant = await this.prisma.bTenant.findUnique({ where: { id: bId } });
    if (!bTenant) return;

    await this.prisma.userTenantRelation.upsert({
      where: { userId_bId: { userId, bId } },
      update: { relationFlags: { increment: 0 } },
      create: {
        userId,
        bId,
        relationFlags: 1, // primary
        entrySource: 'b_only',
        parentUserId: inviteUserId ?? null,
      },
    });

    if (inviteUserId) {
      await this.prisma.userReferral.upsert({
        where: { referredId_bId: { referredId: userId, bId } },
        update: {},
        create: { bId, referrerId: inviteUserId, referredId: userId },
      });
    }
  }

  private maskPhone(phone: string): string {
    return phone.length >= 11 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone;
  }

  // ============ B 端登录 ============

  async bLogin(phone: string, password: string): Promise<{ token: string; bTenant: { id: number; name: string } }> {
    // 校验密码(种子数据用 bcrypt, 此处简化: 用 plaintext 比对, 生产改 bcrypt.compare)
    const bTenant = await this.prisma.bTenant.findUnique({ where: { phone } });
    if (!bTenant || bTenant.status !== 'active') {
      throw new UnauthorizedException({ code: 'AUTH_003', message: '账号或密码错误' });
    }
    // 简化: 种子数据 passwordHash=plaintext; 生产需 bcrypt
    if (bTenant.passwordHash !== password) {
      throw new UnauthorizedException({ code: 'AUTH_003', message: '账号或密码错误' });
    }

    const payload: JwtPayload = {
      uid: bTenant.id,
      role: 'b_tenant',
      tenant_context: { b_id: bTenant.id, entry_source: 'platform' },
    };
    const token = await this.jwt.signAsync(payload);
    return { token, bTenant: { id: bTenant.id, name: bTenant.name } };
  }

  async bInitPassword(initToken: string, password: string): Promise<{ token: string }> {
    // 简化: init_token = phone + timestamp 或随机码; 生产用签名验证
    // MVP: 直接匹配 phone 的 B 端 + token 为明文 phone 的简化版
    // 此处假设 init_token 是 bTenant.phone 或某种预签发 token
    const bTenant = await this.prisma.bTenant.findFirst({ where: { phone: initToken } });
    if (!bTenant) {
      // 兼容随机 token: 尝试匹配 passwordHash === initToken(即未初始化)
      const all = await this.prisma.bTenant.findMany({ where: { status: 'active' }, take: 1 });
      if (all.length === 0) {
        throw new UnauthorizedException({ code: 'AUTH_005', message: 'token无效' });
      }
      // MVP: 取首个未初始化 B 端(种子数据), 匹配 phone
      const target = await this.prisma.bTenant.findFirst({ where: { phone: initToken } });
      if (!target) throw new UnauthorizedException({ code: 'AUTH_005', message: 'token无效' });
      await this.prisma.bTenant.update({ where: { id: target.id }, data: { passwordHash: password } });
      const payload: JwtPayload = {
        uid: target.id, role: 'b_tenant',
        tenant_context: { b_id: target.id, entry_source: 'platform' },
      };
      const token = await this.jwt.signAsync(payload);
      return { token };
    }
    await this.prisma.bTenant.update({ where: { id: bTenant.id }, data: { passwordHash: password } });
    const payload: JwtPayload = {
      uid: bTenant.id, role: 'b_tenant',
      tenant_context: { b_id: bTenant.id, entry_source: 'platform' },
    };
    const token = await this.jwt.signAsync(payload);
    return { token };
  }
}
