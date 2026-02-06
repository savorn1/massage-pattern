import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkplaceMember, WorkplaceMemberSchema } from '@/modules/shared/entities';
import { WorkplaceMembersService } from './workplace-members.service';
import { WorkplaceMembersController } from './workplace-members.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: WorkplaceMember.name, schema: WorkplaceMemberSchema }]),
  ],
  controllers: [WorkplaceMembersController],
  providers: [WorkplaceMembersService],
  exports: [WorkplaceMembersService],
})
export class WorkplaceMembersModule {}
