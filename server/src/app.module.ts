import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { TenantModule } from './tenant/tenant.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { HomeModule } from './modules/home/home.module';
import { ProjectModule } from './modules/project/project.module';
import { MeModule } from './modules/me/me.module';

import { AdminModule } from './modules/admin/admin.module';
import { UserModule } from './modules/user/user.module';
import { PayModule } from './modules/pay/pay.module';
import { CommissionModule } from './modules/commission/commission.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env', '.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    JwtModule.register({ global: true }),
    PrismaModule,
    TenantModule,
    AuthModule,
    HealthModule,
    HomeModule,
    ProjectModule,
    MeModule,
    AdminModule,
    UserModule,
    PayModule,
    CommissionModule,
  ],
})
export class AppModule {}
