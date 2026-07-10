import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TenantModule } from '../../tenant/tenant.module';
import { CoopController, SwapController, SceneController } from './coop.controller';
import { CoopService } from './coop.service';
import { SwapService } from './swap.service';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [CoopController, SwapController, SceneController],
  providers: [CoopService, SwapService],
  exports: [CoopService],
})
export class CoopModule {}
