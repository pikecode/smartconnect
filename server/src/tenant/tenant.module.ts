import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantContextService } from './tenant-context.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [TenantContextService],
  exports: [TenantContextService],
})
export class TenantModule {}
