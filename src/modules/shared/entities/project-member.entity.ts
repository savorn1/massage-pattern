import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProjectMemberDocument = ProjectMember & Document;

export enum ProjectMemberRole {
  MANAGER = 'manager',
  DEVELOPER = 'developer',
  VIEWER = 'viewer',
}

@Schema({ collection: 'project_members', timestamps: false })
export class ProjectMember {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  projectId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ProjectMemberRole),
    default: ProjectMemberRole.DEVELOPER,
  })
  role: ProjectMemberRole;

  @Prop({ type: Date, default: Date.now })
  joinedAt: Date;
}

export const ProjectMemberSchema = SchemaFactory.createForClass(ProjectMember);

// Indexes
// ProjectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });
// ProjectMemberSchema.index({ projectId: 1 });
// ProjectMemberSchema.index({ userId: 1 });
