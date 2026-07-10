import { Injectable, ConflictException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

const AES_KEY = process.env.AES_SECRET ?? 'change-me-32-chars-aes-secret!!'; // 32字节

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(AES_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  return iv.toString('hex') + ':' + Buffer.concat([cipher.update(text), cipher.final()]).toString('hex');
}

function hash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

@Injectable()
export class KycService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(userId: number, realName: string, idCard: string): Promise<{ kyc_id: number; status: string }> {
    const existing = await this.prisma.userKyc.findUnique({ where: { userId } });
    if (existing && existing.verified === 'approved') throw new ConflictException({ code: 'BIZ_040', message: '已通过实名认证' });

    const idCardHash = hash(idCard);
    const conflict = await this.prisma.userKyc.findFirst({ where: { idCardHash, userId: { not: userId } } });
    if (conflict) throw new ConflictException({ code: 'BIZ_041', message: '身份证已被其他账号使用' });

    const idCardEnc = encrypt(idCard);
    const realNameEnc = encrypt(realName);

    const kyc = existing
      ? await this.prisma.userKyc.update({ where: { userId }, data: { realName: realNameEnc, idCardHash, idCardEnc, verified: 'pending' } })
      : await this.prisma.userKyc.create({ data: { userId, realName: realNameEnc, idCardHash, idCardEnc, verified: 'pending' } });

    return { kyc_id: kyc.id, status: kyc.verified };
  }

  async getStatus(userId: number): Promise<{ status: string | null; verified_at: Date | null }> {
    const kyc = await this.prisma.userKyc.findUnique({ where: { userId }, select: { verified: true, verifiedAt: true } });
    return { status: kyc?.verified ?? null, verified_at: kyc?.verifiedAt ?? null };
  }

  /** 总后台: 审核 KYC */
  async review(userId: number, action: 'approved' | 'rejected'): Promise<void> {
    await this.prisma.userKyc.update({
      where: { userId },
      data: { verified: action, verifiedAt: action === 'approved' ? new Date() : null },
    });
  }

  /** 校验用户是否已实名(提现前使用) */
  async isVerified(userId: number): Promise<boolean> {
    const kyc = await this.prisma.userKyc.findUnique({ where: { userId }, select: { verified: true } });
    return kyc?.verified === 'approved';
  }
}
