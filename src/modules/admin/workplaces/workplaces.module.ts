import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Workplace, WorkplaceSchema, WorkplaceMember, WorkplaceMemberSchema, User, UserSchema } from '@/modules/shared/entities';
import { WorkplacesService } from './workplaces.service';
import { WorkplacesController } from './workplaces.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Workplace.name, schema: WorkplaceSchema },
      { name: User.name, schema: UserSchema },
      { name: WorkplaceMember.name, schema: WorkplaceMemberSchema}]),
  ],
  controllers: [WorkplacesController],
  providers: [WorkplacesService],
  exports: [WorkplacesService],
})
export class WorkplacesModule {}
