import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FileDocument = File & Document;

@Schema({ collection: 'files', timestamps: true })
export class File {
  @Prop({ type: Types.ObjectId, ref: 'Task' })
  taskId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  uploaderId: Types.ObjectId;

  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  size: number;

  createdAt: Date;
}

export const FileSchema = SchemaFactory.createForClass(File);

// Indexes
FileSchema.index({ taskId: 1 });
FileSchema.index({ uploaderId: 1 });
