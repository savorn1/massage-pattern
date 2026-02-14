import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { Project, ProjectSchema } from '@/modules/shared/entities';
import { EventsModule } from '../events/events.module';

/**
 * Projects module for project management
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Project.name, schema: ProjectSchema }]),
    EventsModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
