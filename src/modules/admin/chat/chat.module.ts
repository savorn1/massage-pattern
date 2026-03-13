import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import {
  Conversation,
  ConversationSchema,
  Message,
  MessageReminder,
  MessageReminderSchema,
  MessageSchema,
  SavedReply,
  SavedReplySchema,
  ScheduledMessage,
  ScheduledMessageSchema,
  UserConversation,
  UserConversationSchema,
} from '@/modules/shared/entities';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { WebsocketModule } from '@/modules/messaging/websocket/websocket.module';
import { UploadsModule } from '@/modules/uploads/uploads.module';
import { BullmqModule } from '@/modules/workers/bullmq/bullmq.module';
import { ScheduledMessageWorker } from '@/modules/workers/bullmq/workers/scheduled-message.worker';
import { MessageReminderWorker } from '@/modules/workers/bullmq/workers/message-reminder.worker';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: UserConversation.name, schema: UserConversationSchema },
      { name: ScheduledMessage.name, schema: ScheduledMessageSchema },
      { name: MessageReminder.name, schema: MessageReminderSchema },
      { name: SavedReply.name, schema: SavedReplySchema },
    ]),
    AuthModule,
    NotificationsModule,
    UsersModule,
    WebsocketModule,
    UploadsModule,
    BullmqModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ScheduledMessageWorker, MessageReminderWorker],
  exports: [ChatService],
})
export class ChatModule {}
