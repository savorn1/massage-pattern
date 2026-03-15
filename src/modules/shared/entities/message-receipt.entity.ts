import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageReceiptDocument = MessageReceipt & Document;

@Schema({ collection: 'message_receipts', timestamps: false })
export class MessageReceipt {
  @Prop({ type: Types.ObjectId, ref: 'Message', required: true })
  messageId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop()
  readAt?: Date;

  @Prop()
  deliveredAt?: Date;
}

export const MessageReceiptSchema = SchemaFactory.createForClass(MessageReceipt);

MessageReceiptSchema.index({ messageId: 1, userId: 1 }, { unique: true });
MessageReceiptSchema.index({ conversationId: 1, userId: 1, readAt: 1 });
MessageReceiptSchema.index({ userId: 1, readAt: 1 });
