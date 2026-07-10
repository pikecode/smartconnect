import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const W_PLATFORM = 0.4;
const W_USER = 0.6;
const MIN_REVIEWS = 3;

function stars5ToScore(stars: number): number {
  return Math.round((stars / 5) * 100);
}

@Injectable()
export class ScoreService {
  constructor(private readonly prisma: PrismaService) {}

  /** 用户提交评价后调用，异步重算 project_score */
  async recalculate(projectId: number): Promise<void> {
    const score = await this.prisma.projectScore.findUnique({ where: { projectId } });
    if (!score) return;

    const reviews = await this.prisma.userScoreReview.findMany({ where: { projectId } });
    const count = reviews.length;

    if (count < MIN_REVIEWS) {
      // 样本不足，仅保留平台初始分，不合并用户评价
      await this.prisma.projectScore.update({
        where: { projectId },
        data: { reviewCount: count },
      });
      return;
    }

    const avgAuth = reviews.reduce((s, r) => s + stars5ToScore(r.authenticity), 0) / count;
    const avgRisk = reviews.reduce((s, r) => s + stars5ToScore(r.risk), 0) / count;
    const avgProfit = reviews.reduce((s, r) => s + stars5ToScore(r.profitability), 0) / count;

    const newAuth = Math.round(score.authenticity * W_PLATFORM + avgAuth * W_USER);
    const newRisk = Math.round(score.risk * W_PLATFORM + avgRisk * W_USER);
    const newProfit = Math.round(score.profitability * W_PLATFORM + avgProfit * W_USER);

    await this.prisma.projectScore.update({
      where: { projectId },
      data: { authenticity: newAuth, risk: newRisk, profitability: newProfit, reviewCount: count },
    });
  }
}
