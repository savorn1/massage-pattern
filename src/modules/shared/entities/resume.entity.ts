import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseEntity } from '@/core/database/base/base.entity';

export type ResumeDocument = Resume & Document;

@Schema({ _id: false })
export class WorkExperience {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  company: string;

  @Prop()
  location?: string;

  @Prop({ required: true })
  startDate: string;

  @Prop()
  endDate?: string;

  @Prop({ default: false })
  isCurrent: boolean;

  @Prop({ type: [String], default: [] })
  responsibilities: string[];
}

@Schema({ _id: false })
export class Education {
  @Prop({ required: true })
  degree: string;

  @Prop({ required: true })
  institution: string;

  @Prop({ required: true })
  year: string;

  @Prop({ type: [String], default: [] })
  highlights: string[];
}

@Schema({ _id: false })
export class Language {
  @Prop({ required: true })
  name: string;

  @Prop()
  level?: string;
}

@Schema({ _id: false })
export class Award {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  organization: string;

  @Prop({ required: true })
  year: string;
}

@Schema({ _id: false })
export class ResumeReference {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  jobTitle: string;

  @Prop({ required: true })
  organization: string;

  @Prop()
  email?: string;

  @Prop()
  phone?: string;
}

/**
 * Resume entity — one document per user
 */
@Schema({ collection: 'resumes', timestamps: true })
export class Resume extends BaseEntity {
  @Prop({ required: true, unique: true })
  userId: string;

  // Personal info
  @Prop({ required: true })
  fullName: string;

  @Prop()
  title?: string;

  @Prop()
  phone?: string;

  @Prop()
  email?: string;

  @Prop()
  location?: string;

  @Prop()
  profileUrl?: string;

  // Summary
  @Prop({ type: String, default: '' })
  summary: string;

  // Skills
  @Prop({ type: [String], default: [] })
  skills: string[];

  // Work experience
  @Prop({ type: [Object], default: [] })
  experiences: WorkExperience[];

  // Education
  @Prop({ type: [Object], default: [] })
  education: Education[];

  // Languages
  @Prop({ type: [Object], default: [] })
  languages: Language[];

  // Awards
  @Prop({ type: [Object], default: [] })
  awards: Award[];

  // References
  @Prop({ type: [Object], default: [] })
  references: ResumeReference[];

  // Hobbies
  @Prop({ type: [String], default: [] })
  hobbies: string[];
}

export const ResumeSchema = SchemaFactory.createForClass(Resume);
ResumeSchema.index({ userId: 1 }, { unique: true });
