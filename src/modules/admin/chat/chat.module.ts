import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import {
  Conversation,
  ConversationSchema,
  Message,
  MessageSchema,
  UserConversation,
  UserConversationSchema,
} from '@/modules/shared/entities';
import { AuthModule } from '../auth/auth.module';
import { WebsocketModule } from '@/modules/messaging/websocket/websocket.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: UserConversation.name, schema: UserConversationSchema },
    ]),
    AuthModule,
    WebsocketModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
