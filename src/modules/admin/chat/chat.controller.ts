import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateConversationDto, SendMessageDto, UpdateGroupDto } from './dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ─── Conversations ────────────────────────────────────────────────────────

  /** Create a new private or group conversation */
  @Post('conversations')
  createConversation(@Req() req, @Body() dto: CreateConversationDto) {
    return this.chatService.createConversation(req.user.userId, dto);
  }

  /** Get all conversations for the authenticated user */
  @Get('conversations')
  getUserConversations(@Req() req) {
    return this.chatService.getUserConversations(req.user.userId);
  }

  /** Get a single conversation by id */
  @Get('conversations/:id')
  getConversation(@Req() req, @Param('id') id: string) {
    return this.chatService.getConversation(id, req.user.userId);
  }

  /** Update group name, avatar, or admins */
  @Patch('conversations/:id')
  updateGroup(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.chatService.updateGroup(id, req.user.userId, dto);
  }

  /** Add participants to a group conversation */
  @Post('conversations/:id/participants')
  addParticipants(
    @Req() req,
    @Param('id') id: string,
    @Body('userIds') userIds: string[],
  ) {
    return this.chatService.addParticipants(id, req.user.userId, userIds);
  }

  /** Remove a participant from a group (or leave the group yourself) */
  @Delete('conversations/:id/participants/:userId')
  removeParticipant(
    @Req() req,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.chatService.removeParticipant(id, req.user.userId, userId);
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  /** Send a message to a conversation */
  @Post('conversations/:id/messages')
  sendMessage(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(id, req.user.userId, dto);
  }

  /** Get messages for a conversation (newest first, paginated) */
  @Get('conversations/:id/messages')
  getMessages(
    @Req() req,
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.chatService.getMessages(id, req.user.userId, +page, +limit);
  }

  /** Mark a message as read and reset unread count */
  @Post('conversations/:id/messages/:messageId/read')
  async markAsRead(
    @Req() req,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    await this.chatService.markAsRead(id, req.user.userId, messageId);
    return { ok: true };
  }

  /** Soft-delete a message (sender only) */
  @Delete('messages/:messageId')
  deleteMessage(@Req() req, @Param('messageId') messageId: string) {
    return this.chatService.deleteMessage(messageId, req.user.userId);
  }
}
