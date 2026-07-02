import { Module } from '@nestjs/common';
import { ProjectController, BProjectController } from './project.controller';
import { ProjectService } from './project.service';

@Module({
  controllers: [ProjectController, BProjectController],
  providers: [ProjectService],
})
export class ProjectModule {}
