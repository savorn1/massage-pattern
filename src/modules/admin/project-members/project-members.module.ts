import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectMember, ProjectMemberSchema } from '@/modules/shared/entities';
import { ProjectMembersService } from './project-members.service';
import { ProjectMembersController } from './project-members.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ProjectMember.name, schema: ProjectMemberSchema }]),
  ],
  controllers: [ProjectMembersController],
  providers: [ProjectMembersService],
  exports: [ProjectMembersService],
})
export class ProjectMembersModule {}
