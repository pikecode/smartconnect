import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommissionModule } from '../commission/commission.module';
import { PayController, KycController } from './pay.controller';
import { PayService } from './pay.service';
import { KycService } from './kyc.service';

@Module({
  imports: [PrismaModule, CommissionModule],
  controllers: [PayController, KycController],
  providers: [PayService, KycService],
  exports: [PayService, KycService],
})
export class PayModule {}
