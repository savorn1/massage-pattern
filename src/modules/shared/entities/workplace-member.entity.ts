import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WorkplaceMemberDocument = WorkplaceMember & Document;

export enum WorkplaceMemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

@Schema({ collection: 'workplace_members', timestamps: false })
export class WorkplaceMember {
  @Prop({ type: Types.ObjectId, ref: 'Workplace', required: true })
  workplaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(WorkplaceMemberRole),
    default: WorkplaceMemberRole.MEMBER,
  })
  role: WorkplaceMemberRole;

  @Prop({ type: Date, default: Date.now })
  joinedAt: Date;
}

export const WorkplaceMemberSchema =
  SchemaFactory.createForClass(WorkplaceMember);

// Indexes
WorkplaceMemberSchema.index({ workplaceId: 1, userId: 1 }, { unique: true });
WorkplaceMemberSchema.index({ workplaceId: 1 });
WorkplaceMemberSchema.index({ userId: 1 });
