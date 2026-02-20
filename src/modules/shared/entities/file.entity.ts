import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FileDocument = File & Document;

@Schema({ collection: 'files', timestamps: true })
export class File {
  @Prop({ type: String })
  taskId?: string;

  @Prop({ type: String, required: true })
  uploaderId: string;

  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  url: string;

  /** S3/MinIO object key — used to delete the actual file from storage */
  @Prop()
  s3Key?: string;

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
