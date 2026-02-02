import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseEntity } from '@/core/database/base/base.entity';
import { UserRole } from '@/common/constants/roles.constant';

export type UserDocument = User & Document;

/**
 * User entity representing all user types in the system
 */
@Schema({ collection: 'users', timestamps: true })
export class User extends BaseEntity {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({
    type: [String],
    enum: Object.values(UserRole),
    default: [UserRole.CLIENT],
  })
  roles: UserRole[];

  @Prop()
  phone?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop()
  emailVerificationToken?: string;

  @Prop()
  passwordResetToken?: string;

  @Prop()
  passwordResetExpires?: Date;

  @Prop()
  lastLogin?: Date;

  @Prop()
  lastLoginIp?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const UserSchema = SchemaFactory.createForClass(User);
