import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';
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

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  // ============ C 端登录 ============

  async wxLogin(input: WxLoginInput): Promise<{ token: string; user: { id: number; phone: string | null; isNew: boolean } }> {
    const openid = `wx_${input.code}`;
    let user = await this.prisma.cUser.findUnique({ where: { openid } });
    const isNew = !user;
    if (!user) user = await this.prisma.cUser.create({ data: { openid } });

    if (isNew && input.sceneBId && input.sceneSig) {
      // 校验 scene 签名
      const expected = this.signScene(input.sceneBId);
      if (input.sceneSig !== expected) {
        throw new UnauthorizedException({ code: 'TENANT_001', message: 'scene签名无效' });
      }
      await this.bindScene(user.id, input.sceneBId, input.inviteUserId);
    }

    // 读 tenant 关系 —— 走 runInTenant 避免 RLS 锁死
    const tenantRel = await this.tenantCtx.runInTenant(
      { bId: null, entrySource: null, userId: user.id, role: null },
      (tx) => tx.userTenantRelation.findFirst({ where: { userId: user.id } }),
    );

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
    if (smsCode !== '123456') throw new UnauthorizedException({ code: 'AUTH_002', message: '短信码错误' });
    const existing = await this.prisma.cUser.findFirst({ where: { phone } });
    if (existing && existing.id !== userId) throw new ConflictException({ code: 'BIZ_010', message: '手机号已绑定其他账号' });
    await this.prisma.cUser.update({ where: { id: userId }, data: { phone } });
    return { id: userId, phone: this.maskPhone(phone) };
  }

  // ============ B 端登录 ============

  async bLogin(phone: string, password: string): Promise<{ token: string; bTenant: { id: number; name: string } }> {
    const bTenant = await this.prisma.bTenant.findUnique({ where: { phone } });
    if (!bTenant || bTenant.status !== 'active') throw new UnauthorizedException({ code: 'AUTH_003', message: '账号或密码错误' });

    if (!bTenant.passwordHash.startsWith('$2b$')) throw new UnauthorizedException({ code: 'AUTH_003', message: '账号尚未初始化密码' });
    const ok = await bcrypt.compare(password, bTenant.passwordHash);
    if (!ok) throw new UnauthorizedException({ code: 'AUTH_003', message: '账号或密码错误' });

    const payload: JwtPayload = { uid: bTenant.id, role: 'b_tenant', tenant_context: { b_id: bTenant.id, entry_source: 'platform' } };
    const token = await this.jwt.signAsync(payload);
    return { token, bTenant: { id: bTenant.id, name: bTenant.name } };
  }

  async bInitPassword(initToken: string, password: string): Promise<{ token: string }> {
    const hash = crypto.createHash('sha256').update(initToken).digest('hex');
    const record = await this.prisma.bInitToken.findUnique({ where: { tokenHash: hash } });
    if (!record) throw new UnauthorizedException({ code: 'AUTH_005', message: '初始化链接无效' });
    if (record.expiresAt < new Date()) throw new UnauthorizedException({ code: 'AUTH_005', message: '初始化链接已过期' });

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.prisma.$transaction(async (tx) => {
      await tx.bTenant.update({ where: { id: record.bId }, data: { passwordHash: hashedPassword } });
      await tx.bInitToken.delete({ where: { tokenHash: hash } }); // 一次性消费
    });

    const bTenant = await this.prisma.bTenant.findUniqueOrThrow({ where: { id: record.bId } });
    const payload: JwtPayload = { uid: bTenant.id, role: 'b_tenant', tenant_context: { b_id: bTenant.id, entry_source: 'platform' } };
    const token = await this.jwt.signAsync(payload);
    return { token };
  }

  // ============ 平台管理员登录 ============

  async adminLogin(username: string, password: string): Promise<{ token: string }> {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { username } });
    if (!admin) throw new UnauthorizedException({ code: 'AUTH_003', message: '账号或密码错误' });
    if (!admin.passwordHash.startsWith('$2b$')) throw new UnauthorizedException({ code: 'AUTH_003', message: '账号不可用' });
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) throw new UnauthorizedException({ code: 'AUTH_003', message: '账号或密码错误' });
    const payload: JwtPayload = { uid: admin.id, role: 'platform_admin', tenant_context: { b_id: null, entry_source: 'platform' } };
    const token = await this.jwt.signAsync(payload);
    return { token };
  }

  // ============ scene 签名 ============

  /** 用 JWT_SECRET 对 bId 签名 */
  signScene(bId: number): string {
    return crypto.createHmac('sha256', String(process.env.JWT_SECRET ?? 'dev-secret')).update(String(bId)).digest('hex').slice(0, 16);
  }

  // ============ init_token 生成（供 admin 调用） ============

  generateInitToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  hashInitToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  // ============ 私有方法 ============

  private async bindScene(userId: number, bId: number, inviteUserId?: number): Promise<void> {
    // 租户表操作走 runInTenant 设 app.b_id
    await this.tenantCtx.runInTenant(
      { bId: null, entrySource: null, userId, role: null },
      async (tx) => {
        await tx.userTenantRelation.upsert({
          where: { userId_bId: { userId, bId } },
          update: { relationFlags: 1 },
          create: { userId, bId, relationFlags: 1, entrySource: 'b_only', parentUserId: inviteUserId ?? null },
        });
        if (inviteUserId) {
          await tx.userReferral.upsert({
            where: { referredId_bId: { referredId: userId, bId } },
            update: {},
            create: { bId, referrerId: inviteUserId, referredId: userId },
          });
        }
      },
      bId,
    );
  }

  private maskPhone(phone: string): string {
    return phone.length >= 11 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone;
  }
}
