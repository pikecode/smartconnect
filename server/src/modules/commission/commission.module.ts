import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommissionController, AdminCommissionController } from './commission.controller';
import { CommissionService } from './commission.service';

@Module({
  imports: [PrismaModule],
  controllers: [CommissionController, AdminCommissionController],
  providers: [CommissionService],
  exports: [CommissionService],
})
export class CommissionModule {}
