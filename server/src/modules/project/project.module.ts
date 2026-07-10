import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProjectController, BProjectController, ReviewController } from './project.controller';
import { ProjectService } from './project.service';
import { ScoreService } from './score.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectController, BProjectController, ReviewController],
  providers: [ProjectService, ScoreService],
  exports: [ProjectService],
})
export class ProjectModule {}
