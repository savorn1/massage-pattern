import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ChatService } from './chat.service';
import { CreateConversationDto, SendMessageDto, UpdateGroupDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) { }

  // ─── Presence ─────────────────────────────────────────────────────────────

  /** Returns the list of currently online userIds */
  @Get('presence')
  getOnlineUsers() {
    return this.chatService.getOnlineUserIds();
  }

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

  // ─── Archiving ────────────────────────────────────────────────────────────

  /** Get archived conversations for the authenticated user */
  @Get('conversations/archived')
  getArchivedConversations(@Req() req) {
    return this.chatService.getArchivedConversations(req.user.userId);
  }

  @Patch('conversations/:id/archive')
  archiveConversation(
    @Req() req,
    @Param('id') id: string,
    @Body() body: { archive: boolean },
  ) {
    return this.chatService.archiveConversation(req.user.userId, id, body.archive);
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

  /** Remove a participant from a group (admin only) */
  @Delete('conversations/:id/participants/:userId')
  removeParticipant(
    @Req() req,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.chatService.removeParticipant(id, req.user.userId, userId);
  }

  /** Leave a group conversation (self-remove) */
  @Delete('conversations/:id/leave')
  leaveGroup(@Req() req, @Param('id') id: string) {
    return this.chatService.removeParticipant(id, req.user.userId, req.user.userId);
  }


  /** Block a member from sending messages (admin only) */
  @Post('conversations/:id/members/:userId/block')
  blockMember(
    @Req() req,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.chatService.blockMember(id, req.user.userId, userId);
  }

  /** Unblock a member (admin only) */
  @Post('conversations/:id/members/:userId/unblock')
  unblockMember(
    @Req() req,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.chatService.unblockMember(id, req.user.userId, userId);
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  /** Send a message to a conversation (multipart/form-data, up to 5 files × 20 MB) */
  @Post('conversations/:id/messages')
  @UseInterceptors(FilesInterceptor('files', 5, { limits: { fileSize: 20 * 1024 * 1024 } }))
  sendMessage(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.chatService.sendMessage(id, req.user.userId, dto, files);
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

  /** Edit message content (sender only) */
  @Patch('messages/:messageId')
  editMessage(
    @Req() req,
    @Param('messageId') messageId: string,
    @Body('content') content: string,
  ) {
    return this.chatService.editMessage(messageId, req.user.userId, content);
  }

  /** Soft-delete a message (sender only) */
  @Delete('messages/:messageId')
  deleteMessage(@Req() req, @Param('messageId') messageId: string) {
    return this.chatService.deleteMessage(messageId, req.user.userId);
  }

  /** Toggle emoji reaction on a message */
  @Post('messages/:messageId/reactions')
  toggleReaction(
    @Req() req,
    @Param('messageId') messageId: string,
    @Body('emoji') emoji: string,
  ) {
    return this.chatService.toggleReaction(messageId, req.user.userId, emoji);
  }

  /** Pin a message in a conversation */
  @Post('conversations/:id/pin/:messageId')
  pinMessage(
    @Req() req,
    @Param('id') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.chatService.pinMessage(conversationId, messageId, req.user.userId);
  }

  /** Unpin a message from a conversation */
  @Delete('conversations/:id/pin/:messageId')
  unpinMessage(
    @Param('id') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.chatService.unpinMessage(conversationId, messageId);
  }

  /** Mute or unmute a conversation for the current user */
  @Post('conversations/:id/mute')
  async muteConversation(
    @Req() req,
    @Param('id') id: string,
    @Body('mute') mute: boolean,
  ) {
    await this.chatService.muteConversation(id, req.user.userId, mute);
    return { ok: true, muted: mute };
  }

  /** Get the thread (root message + all direct replies) for a message */
  @Get('conversations/:id/messages/:messageId/thread')
  getThreadMessages(
    @Req() req,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    return this.chatService.getThreadMessages(id, messageId, req.user.userId);
  }

  /** Star a message */
  @Post('messages/:messageId/star')
  async starMessage(@Req() req, @Param('messageId') messageId: string) {
    await this.chatService.starMessage(req.user.userId, messageId);
    return { ok: true };
  }

  /** Unstar a message */
  @Delete('messages/:messageId/star')
  async unstarMessage(@Req() req, @Param('messageId') messageId: string) {
    await this.chatService.unstarMessage(req.user.userId, messageId);
    return { ok: true };
  }

  /** Get all starred messages for the current user */
  @Get('starred')
  getStarredMessages(@Req() req) {
    return this.chatService.getStarredMessages(req.user.userId);
  }

  /** Fetch OG/meta link preview for a URL */
  @Get('link-preview')
  getLinkPreview(@Query('url') url: string) {
    return this.chatService.getLinkPreview(url);
  }

  /** Search messages across all user conversations */
  @Get('messages/search')
  searchMessages(
    @Req() req,
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.searchMessages(req.user.userId, q, limit ? +limit : 30);
  }

  // ─── Disappearing messages ────────────────────────────────────────────────

  @Patch('conversations/:id/disappearing')
  setDisappearingMessages(
    @Req() req,
    @Param('id') id: string,
    @Body() body: { enabled: boolean; ttl: number },
  ) {
    return this.chatService.setDisappearingMessages(id, req.user.userId, body.enabled, body.ttl);
  }

  // ─── Polls ────────────────────────────────────────────────────────────────

  @Post('conversations/:id/poll')
  createPoll(
    @Req() req,
    @Param('id') id: string,
    @Body() body: { question: string; options: string[] },
  ) {
    return this.chatService.createPoll(id, req.user.userId, body.question, body.options);
  }

  @Post('messages/:messageId/poll/vote')
  votePoll(
    @Req() req,
    @Param('messageId') messageId: string,
    @Body() body: { optionIndex: number },
  ) {
    return this.chatService.votePoll(messageId, req.user.userId, body.optionIndex);
  }
}
