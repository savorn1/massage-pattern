import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LabelDocument = Label & Document;

@Schema({ collection: 'labels', timestamps: true })
export class Label {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  projectId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, default: '#6366f1' })
  color: string;

  createdAt: Date;
}

export const LabelSchema = SchemaFactory.createForClass(Label);

// Indexes
// LabelSchema.index({ projectId: 1 });
// LabelSchema.index({ projectId: 1, name: 1 }, { unique: true });
