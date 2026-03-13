import { NotificationsService } from '@/modules/admin/notifications/notifications.service';
import { UsersService } from '@/modules/admin/users/users.service';
import { WebsocketGateway } from '@/modules/messaging/websocket/websocket.gateway';
import {
  Conversation,
  ConversationDocument,
  ConversationType,
  Message,
  MessageDocument,
  MessageType,
  MessageReminder,
  MessageReminderDocument,
  MessageReminderStatus,
  NotificationType,
  SavedReply,
  SavedReplyDocument,
  ScheduledMessage,
  ScheduledMessageDocument,
  ScheduledMessageStatus,
  UserConversation,
  UserConversationDocument,
} from '@/modules/shared/entities';
import { UploadsService } from '@/modules/uploads/uploads.service';
import { BullmqService } from '@/modules/workers/bullmq/bullmq.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as crypto from 'crypto';
import * as http from 'http';
import * as https from 'https';
import { FilterQuery, Model, Types } from 'mongoose';
import { URL } from 'url';
import {
  CreateConversationDto,
  CreateSavedReplyDto,
  MessagesAroundDto,
  ScheduleMessageDto,
  SendMessageDto,
  SetReminderDto,
  UpdateGroupDto,
  UpdateSavedReplyDto,
} from './dto';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,

    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,

    @InjectModel(UserConversation.name)
    private readonly userConversationModel: Model<UserConversationDocument>,

    @InjectModel(ScheduledMessage.name)
    private readonly scheduledMessageModel: Model<ScheduledMessageDocument>,

    @InjectModel(MessageReminder.name)
    private readonly messageReminderModel: Model<MessageReminderDocument>,

    @InjectModel(SavedReply.name)
    private readonly savedReplyModel: Model<SavedReplyDocument>,

    private readonly wsGateway: WebsocketGateway,
    private readonly uploadsService: UploadsService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly bullmqService: BullmqService,
  ) { }

  // ─── Presence ─────────────────────────────────────────────────────────────

  getOnlineUserIds(): string[] {
    return this.wsGateway.getOnlineUserIds();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Emit an event to every participant's personal room (except the sender) */
  private emitToParticipants(
    participants: Types.ObjectId[],
    excludeSenderId: string,
    event: string,
    payload: unknown,
  ): void {
    const senderObjId = new Types.ObjectId(excludeSenderId);
    for (const participantId of participants) {
      if (!participantId.equals(senderObjId)) {
        this.wsGateway.broadcastToRoom(
          `user:${participantId.toString()}`,
          event,
          payload,
        );
      }
    }
  }

  /** Emit to ALL participants (including sender, e.g. for delete events) */
  private emitToAllParticipants(
    participants: Types.ObjectId[],
    event: string,
    payload: unknown,
  ): void {
    for (const participantId of participants) {
      this.wsGateway.broadcastToRoom(
        `user:${participantId.toString()}`,
        event,
        payload,
      );
    }
  }

  // ─── Conversations ────────────────────────────────────────────────────────

  async createConversation(
    currentUserId: string,
    dto: CreateConversationDto,
  ): Promise<ConversationDocument> {
    const participantIds = [
      ...new Set([currentUserId, ...dto.participants]),
    ].map((id) => new Types.ObjectId(id));

    if (dto.type === ConversationType.PRIVATE) {
      if (participantIds.length !== 2) {
        throw new BadRequestException(
          'Private conversation must have exactly 2 participants.',
        );
      }

      const existing = await this.conversationModel.findOne({
        type: ConversationType.PRIVATE,
        participants: { $all: participantIds, $size: 2 },
      });
      if (existing) return existing;
    }

    const now = new Date();
    const conversation = await this.conversationModel.create({
      type: dto.type,
      participants: participantIds,
      name: dto.name,
      avatar: dto.avatar,
      createdBy:
        dto.type === ConversationType.GROUP
          ? new Types.ObjectId(currentUserId)
          : undefined,
      admins:
        dto.type === ConversationType.GROUP
          ? [new Types.ObjectId(currentUserId)]
          : [],
    });

    // Seed user_conversations for all participants
    const userConversationDocs = participantIds.map((uid) => ({
      userId: uid,
      conversationId: conversation._id,
      unreadCount: 0,
      joinedAt: now,
      muted: false,
    }));
    await this.userConversationModel.insertMany(userConversationDocs);

    // Notify other participants they've been added to a new conversation
    this.emitToParticipants(
      participantIds,
      currentUserId,
      'chat:conversation:new',
      {
        _id: (conversation._id as Types.ObjectId).toString(),
        type: conversation.type,
        participants: participantIds.map((p) => p.toString()),
        name: conversation.name ?? null,
        admins: (conversation.admins as Types.ObjectId[]).map((a) => a.toString()),
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    );

    // Send in-app notifications for group creation
    if (dto.type === ConversationType.GROUP) {
      const actor = await this.usersService.findById(currentUserId);
      const actorName = actor?.name ?? 'Someone';
      const convId = (conversation._id as Types.ObjectId).toString();

      for (const uid of participantIds) {
        if (uid.toString() === currentUserId) continue;
        const recipientId = uid.toString();
        const created = await this.notificationsService.create({
          recipientId,
          actorId: currentUserId,
          conversationId: convId,
          conversationName: conversation.name,
          type: NotificationType.CHAT_GROUP_CREATED,
          message: `${actorName} added you to the group "${conversation.name ?? 'Unnamed group'}"`,
        });
        this.wsGateway.broadcastToRoom(`user:${recipientId}`, 'notification:new', created);
      }
    }

    return conversation;
  }

  async getUserConversations(userId: string) {
    // Only non-archived conversations
    const userConversations = await this.userConversationModel
      .find({ userId: new Types.ObjectId(userId), archived: { $ne: true } })
      .lean();

    const ucMap = new Map<
      string,
      { unreadCount: number; muted: boolean; lastReadMessageId?: Types.ObjectId; archived: boolean }
    >(
      userConversations.map((uc) => [
        uc.conversationId.toString(),
        {
          unreadCount: uc.unreadCount ?? 0,
          muted: uc.muted ?? false,
          lastReadMessageId: uc.lastReadMessageId,
          archived: uc.archived ?? false,
        },
      ]),
    );

    const conversationIds = userConversations.map((uc) => uc.conversationId);

    const conversations = await this.conversationModel
      .find({ _id: { $in: conversationIds } })
      .sort({ updatedAt: -1 })
      .lean();

    return conversations.map((conv) => {
      const uc = ucMap.get((conv._id as Types.ObjectId).toString());
      return {
        ...conv,
        unreadCount: uc?.unreadCount ?? 0,
        muted: uc?.muted ?? false,
        archived: uc?.archived ?? false,
        lastReadMessageId: uc?.lastReadMessageId?.toString() ?? null,
      };
    });
  }

  async getArchivedConversations(userId: string) {
    const userConversations = await this.userConversationModel
      .find({ userId: new Types.ObjectId(userId), archived: true })
      .lean();

    const conversationIds = userConversations.map((uc) => uc.conversationId);

    const conversations = await this.conversationModel
      .find({ _id: { $in: conversationIds } })
      .sort({ updatedAt: -1 })
      .lean();

    return conversations.map((conv) => ({
      ...conv,
      archived: true,
      unreadCount: 0,
      muted: userConversations.find((uc) => uc.conversationId.toString() === (conv._id as Types.ObjectId).toString())?.muted ?? false,
      lastReadMessageId: null,
    }));
  }

  async archiveConversation(userId: string, conversationId: string, archive: boolean): Promise<void> {
    await this.userConversationModel.updateOne(
      { userId: new Types.ObjectId(userId), conversationId: new Types.ObjectId(conversationId) },
      { $set: { archived: archive } },
      { upsert: true },
    );
  }

  // ─── Starred messages ──────────────────────────────────────────────────────

  async starMessage(userId: string, messageId: string): Promise<void> {
    const message = await this.messageModel.findById(messageId);
    if (!message || message.isDeleted) throw new NotFoundException('Message not found.');

    await this.userConversationModel.updateOne(
      {
        userId: new Types.ObjectId(userId),
        conversationId: message.conversationId,
      },
      { $addToSet: { starredMessageIds: new Types.ObjectId(messageId) } },
    );
  }

  async unstarMessage(userId: string, messageId: string): Promise<void> {
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Message not found.');

    await this.userConversationModel.updateOne(
      {
        userId: new Types.ObjectId(userId),
        conversationId: message.conversationId,
      },
      { $pull: { starredMessageIds: new Types.ObjectId(messageId) } },
    );
  }

  async getStarredMessages(userId: string): Promise<{ message: MessageDocument; conversationId: string }[]> {
    const userConversations = await this.userConversationModel
      .find({
        userId: new Types.ObjectId(userId),
        'starredMessageIds.0': { $exists: true },
      })
      .lean();

    const allStarredIds = userConversations.flatMap((uc) =>
      (uc.starredMessageIds ?? []).map((id) => ({
        id,
        conversationId: uc.conversationId.toString(),
      })),
    );

    if (allStarredIds.length === 0) return [];

    const messages = await this.messageModel
      .find({ _id: { $in: allStarredIds.map((s) => s.id) }, isDeleted: false })
      .sort({ createdAt: -1 })
      .exec();

    const convMap = new Map(allStarredIds.map((s) => [s.id.toString(), s.conversationId]));

    return messages.map((msg) => ({
      message: msg,
      conversationId: convMap.get((msg._id as Types.ObjectId).toString()) ?? '',
    }));
  }

  async getStarredMessageIds(userId: string, conversationId: string): Promise<string[]> {
    const uc = await this.userConversationModel
      .findOne({ userId: new Types.ObjectId(userId), conversationId: new Types.ObjectId(conversationId) })
      .lean();
    return (uc?.starredMessageIds ?? []).map((id) => id.toString());
  }

  // ─── Link preview ──────────────────────────────────────────────────────────

  async getLinkPreview(rawUrl: string): Promise<{
    url: string;
    title: string | null;
    description: string | null;
    image: string | null;
    siteName: string | null;
  }> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new BadRequestException('Only http/https URLs are supported.');
      }
    } catch {
      throw new BadRequestException('Invalid URL.');
    }

    const html = await this.fetchHtml(rawUrl);

    const og = (prop: string) =>
      html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'))?.[1] ??
      null;

    const title =
      og('title') ??
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ??
      null;

    return {
      url: rawUrl,
      title,
      description: og('description') ??
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? null,
      image: og('image') ?? null,
      siteName: og('site_name') ?? parsed.hostname,
    };
  }

  private fetchHtml(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          this.fetchHtml(res.headers.location).then(resolve).catch(reject);
          return;
        }
        let data = '';
        res.on('data', (chunk: string) => {
          data += chunk;
          if (data.length > 100_000) { req.destroy(); resolve(data); }
        });
        res.on('end', () => resolve(data));
        res.on('error', reject);
      });
      req.setTimeout(5000, () => { req.destroy(); reject(new Error('Timeout')); });
      req.on('error', reject);
    });
  }

  async muteConversation(
    conversationId: string,
    userId: string,
    mute: boolean,
  ): Promise<void> {
    await this.getConversation(conversationId, userId);
    await this.userConversationModel.updateOne(
      { userId: new Types.ObjectId(userId), conversationId: new Types.ObjectId(conversationId) },
      { $set: { muted: mute } },
      { upsert: true },
    );
  }

  async getThreadMessages(
    conversationId: string,
    messageId: string,
    userId: string,
  ): Promise<{ root: MessageDocument | null; replies: MessageDocument[] }> {
    await this.getConversation(conversationId, userId);

    const [root, replies] = await Promise.all([
      this.messageModel.findOne({
        _id: new Types.ObjectId(messageId),
        conversationId: new Types.ObjectId(conversationId),
      }).exec(),
      this.messageModel
        .find({
          conversationId: new Types.ObjectId(conversationId),
          replyTo: new Types.ObjectId(messageId),
          isDeleted: false,
        })
        .sort({ createdAt: 1 })
        .exec(),
    ]);

    return { root, replies };
  }

  async getConversation(
    conversationId: string,
    userId: string,
  ): Promise<ConversationDocument> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found.');

    const isMember = conversation.participants.some((p) =>
      p.equals(new Types.ObjectId(userId)),
    );
    if (!isMember) throw new ForbiddenException('Access denied.');

    return conversation;
  }

  async updateGroup(
    conversationId: string,
    currentUserId: string,
    dto: UpdateGroupDto,
  ): Promise<ConversationDocument> {
    const conversation = await this.getConversation(conversationId, currentUserId);

    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('Only group conversations can be updated.');
    }

    const isAdmin = conversation.admins.some((a) =>
      a.equals(new Types.ObjectId(currentUserId)),
    );
    if (!isAdmin) throw new ForbiddenException('Only admins can update the group.');

    const update: Partial<Conversation> = {};
    if (dto.name !== undefined) update.name = dto.name;
    if (dto.avatar !== undefined) update.avatar = dto.avatar;
    if (dto.admins !== undefined)
      update.admins = dto.admins.map((id) => new Types.ObjectId(id));

    const updated = await this.conversationModel
      .findByIdAndUpdate(conversationId, update, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Conversation not found.');
    return updated;
  }

  async addParticipants(
    conversationId: string,
    currentUserId: string,
    userIds: string[],
  ): Promise<ConversationDocument> {
    const conversation = await this.getConversation(conversationId, currentUserId);

    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('Cannot add participants to private chats.');
    }

    const isAdmin = conversation.admins.some((a) =>
      a.equals(new Types.ObjectId(currentUserId)),
    );
    if (!isAdmin)
      throw new ForbiddenException('Only admins can add participants.');

    const newIds = userIds.map((id) => new Types.ObjectId(id));
    const now = new Date();

    await this.conversationModel.findByIdAndUpdate(conversationId, {
      $addToSet: { participants: { $each: newIds } },
    });

    const ops = newIds.map((uid) => ({
      updateOne: {
        filter: { userId: uid, conversationId: conversation._id },
        update: { $setOnInsert: { unreadCount: 0, joinedAt: now, muted: false } },
        upsert: true,
      },
    }));
    await this.userConversationModel.bulkWrite(ops);

    const updated = await this.conversationModel.findById(conversationId).exec();
    if (!updated) throw new NotFoundException('Conversation not found.');

    const conversationPayload: Record<string, unknown> = {
      _id: (updated._id as Types.ObjectId).toString(),
      type: updated.type,
      participants: (updated.participants as Types.ObjectId[]).map((p) => p.toString()),
      name: updated.name ?? null,
      admins: (updated.admins as Types.ObjectId[]).map((a) => a.toString()),
      blockedMembers: (updated.blockedMembers as Types.ObjectId[]).map((b) => b.toString()),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };

    // Notify newly added members so the conversation appears in their list
    for (const uid of newIds) {
      this.wsGateway.broadcastToRoom(
        `user:${uid.toString()}`,
        'chat:conversation:new',
        conversationPayload,
      );
    }

    // Notify existing participants that the member list changed
    const existingParticipants = (updated.participants as Types.ObjectId[]).filter(
      (p) => !newIds.some((n) => n.equals(p)),
    );
    for (const uid of existingParticipants) {
      this.wsGateway.broadcastToRoom(`user:${uid.toString()}`, 'chat:member:added', {
        conversationId,
        userIds: newIds.map((n) => n.toString()),
      });
    }

    // Send in-app notifications to newly added members
    const actor = await this.usersService.findById(currentUserId);
    const actorName = actor?.name ?? 'Someone';
    const groupName = updated.name ?? 'Unnamed group';

    for (const uid of newIds) {
      const recipientId = uid.toString();
      const created = await this.notificationsService.create({
        recipientId,
        actorId: currentUserId,
        conversationId,
        conversationName: updated.name,
        type: NotificationType.CHAT_MEMBER_ADDED,
        message: `${actorName} added you to the group "${groupName}"`,
      });
      this.wsGateway.broadcastToRoom(`user:${recipientId}`, 'notification:new', created);
    }

    return updated;
  }

  async removeParticipant(
    conversationId: string,
    currentUserId: string,
    targetUserId: string,
  ): Promise<ConversationDocument> {
    const conversation = await this.getConversation(conversationId, currentUserId);

    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('Cannot remove participants from private chats.');
    }

    const isAdmin = conversation.admins.some((a) =>
      a.equals(new Types.ObjectId(currentUserId)),
    );
    const isSelf = currentUserId === targetUserId;

    if (!isAdmin && !isSelf) {
      throw new ForbiddenException('Only admins can remove other participants.');
    }

    const targetId = new Types.ObjectId(targetUserId);

    // Notify all current participants before removing
    this.emitToAllParticipants(
      conversation.participants as Types.ObjectId[],
      isSelf ? 'chat:member:left' : 'chat:member:removed',
      { conversationId, userId: targetUserId },
    );

    await this.conversationModel.findByIdAndUpdate(conversationId, {
      $pull: { participants: targetId, admins: targetId, blockedMembers: targetId },
    });

    const updated = await this.conversationModel.findById(conversationId).exec();
    if (!updated) throw new NotFoundException('Conversation not found.');
    return updated;
  }

  async blockMember(
    conversationId: string,
    currentUserId: string,
    targetUserId: string,
  ): Promise<ConversationDocument> {
    const conversation = await this.getConversation(conversationId, currentUserId);

    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('Cannot block members in private chats.');
    }

    const isAdmin = conversation.admins.some((a) =>
      a.equals(new Types.ObjectId(currentUserId)),
    );
    if (!isAdmin) throw new ForbiddenException('Only admins can block members.');

    if (currentUserId === targetUserId) {
      throw new BadRequestException('You cannot block yourself.');
    }

    await this.conversationModel.findByIdAndUpdate(conversationId, {
      $addToSet: { blockedMembers: new Types.ObjectId(targetUserId) },
    });

    const updated = await this.conversationModel.findById(conversationId).exec();
    if (!updated) throw new NotFoundException('Conversation not found.');

    this.emitToAllParticipants(
      updated.participants as Types.ObjectId[],
      'chat:member:blocked',
      { conversationId, userId: targetUserId },
    );

    return updated;
  }

  async unblockMember(
    conversationId: string,
    currentUserId: string,
    targetUserId: string,
  ): Promise<ConversationDocument> {
    const conversation = await this.getConversation(conversationId, currentUserId);

    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('Cannot unblock members in private chats.');
    }

    const isAdmin = conversation.admins.some((a) =>
      a.equals(new Types.ObjectId(currentUserId)),
    );
    if (!isAdmin) throw new ForbiddenException('Only admins can unblock members.');

    await this.conversationModel.findByIdAndUpdate(conversationId, {
      $pull: { blockedMembers: new Types.ObjectId(targetUserId) },
    });

    const updated = await this.conversationModel.findById(conversationId).exec();
    if (!updated) throw new NotFoundException('Conversation not found.');

    this.emitToAllParticipants(
      updated.participants as Types.ObjectId[],
      'chat:member:unblocked',
      { conversationId, userId: targetUserId },
    );

    return updated;
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  async sendMessage(
    conversationId: string,
    senderId: string,
    dto: SendMessageDto,
    files: Express.Multer.File[] = [],
  ): Promise<MessageDocument> {
    const conversation = await this.getConversation(conversationId, senderId);

    const isBlocked = (conversation.blockedMembers ?? []).some((b) =>
      b.equals(new Types.ObjectId(senderId)),
    );
    if (isBlocked) {
      throw new ForbiddenException('You have been blocked in this conversation.');
    }

    if (!dto.content?.trim() && files.length === 0) {
      throw new BadRequestException('Message must have content or at least one file.');
    }

    // Upload files to MinIO and build attachment list
    const attachments = await Promise.all(
      files.map((file) =>
        this.uploadsService
          .uploadFile(file.buffer, Buffer.from(file.originalname, 'latin1').toString('utf8'), file.mimetype, senderId)
          .then((saved) => ({
            url: saved.url,
            originalName: saved.originalName,
            mimeType: saved.mimeType,
            size: saved.size,
          })),
      ),
    );

    // Determine message type: prefer explicit, else infer from attachments
    let type = dto.type ?? MessageType.TEXT;
    if (files.length > 0 && !dto.type) {
      type = files.every((f) => f.mimetype.startsWith('image/'))
        ? MessageType.IMAGE
        : MessageType.FILE;
    }

    // Compute expiresAt if conversation has disappearing messages enabled
    const dm = conversation.disappearingMessages as { enabled?: boolean; ttl?: number } | undefined;
    const expiresAt =
      dm?.enabled && dm.ttl
        ? new Date(Date.now() + dm.ttl * 1000)
        : undefined;

    // Extract mentioned user IDs from @[name](userId) patterns
    const mentionRegex = /@\[[^\]]+\]\(([a-f0-9]{24})\)/g;
    const rawContent = dto.content?.trim() ?? '';
    const mentions: Types.ObjectId[] = [];
    for (const m of rawContent.matchAll(mentionRegex)) {
      try { mentions.push(new Types.ObjectId(m[1])); } catch { /* skip invalid ids */ }
    }

    const message = await this.messageModel.create({
      conversationId: conversation._id,
      senderId: new Types.ObjectId(senderId),
      type,
      content: rawContent,
      attachments,
      replyTo: dto.replyTo ? new Types.ObjectId(dto.replyTo) : undefined,
      readBy: [{ userId: new Types.ObjectId(senderId), readAt: new Date() }],
      ...(expiresAt ? { expiresAt } : {}),
      ...(mentions.length > 0 ? { mentions } : {}),
    });

    // Update lastMessage snapshot on the conversation
    const previewContent = dto.content?.trim()
      || (attachments.length === 1 ? attachments[0].originalName : `${attachments.length} files`);
    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessage: {
        messageId: message._id,
        senderId: message.senderId,
        content: previewContent,
        createdAt: message.createdAt,
      },
    });

    // Increment unread count for all participants except the sender
    await this.userConversationModel.updateMany(
      {
        conversationId: conversation._id,
        userId: { $ne: new Types.ObjectId(senderId) },
      },
      { $inc: { unreadCount: 1 } },
    );

    // ── Real-time: push new message to other participants ─────────────────
    const payload: Record<string, unknown> = {
      _id: (message._id as Types.ObjectId).toString(),
      conversationId: (message.conversationId as Types.ObjectId).toString(),
      senderId: (message.senderId as Types.ObjectId).toString(),
      type: message.type,
      content: message.content,
      attachments: message.attachments,
      replyTo: message.replyTo
        ? (message.replyTo as Types.ObjectId).toString()
        : null,
      readBy: message.readBy,
      isDeleted: message.isDeleted,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };

    this.emitToParticipants(
      conversation.participants as Types.ObjectId[],
      senderId,
      'chat:message:new',
      payload,
    );

    return message;
  }

  async getMessages(
    conversationId: string,
    userId: string,
    page = 1,
    limit = 50,
    before?: string,
    after?: string,
  ): Promise<{ data: MessageDocument[]; total: number }> {
    await this.getConversation(conversationId, userId);
    const base = this.conversationFilter(conversationId);

    if (before) {
      return this.fetchMessages({ ...base, createdAt: { $lt: new Date(before) } }, -1, 0, limit);
    }
    if (after) {
      return this.fetchMessages({ ...base, createdAt: { $gt: new Date(after) } }, 1, 0, limit);
    }
    return this.fetchMessages(base, -1, (page - 1) * limit, limit);
  }

  async getMessagesAround(
    conversationId: string,
    userId: string,
    messageId: string,
    limit = 50,
  ): Promise<MessagesAroundDto> {
    await this.getConversation(conversationId, userId);
    const base = this.conversationFilter(conversationId);

    const anchor = await this.messageModel.findById(messageId);
    if (!anchor) throw new NotFoundException('Message not found.');

    // Sort descending so skip(newerCount - half) positions the window around the anchor
    const newerCount = await this.messageModel.countDocuments({
      ...base,
      createdAt: { $gt: anchor.createdAt },
    });
    const skip = Math.max(0, newerCount - Math.floor(limit / 2));

    const { data, total } = await this.fetchMessages(base, -1, skip, limit);
    return { data, total, hasNewer: skip > 0, hasOlder: skip + data.length < total };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /** Base Mongoose filter for all message queries in a conversation. */
  private conversationFilter(conversationId: string): FilterQuery<MessageDocument> {
    return { conversationId: new Types.ObjectId(conversationId), isDeleted: false };
  }

  /**
   * Fetch messages + total count in parallel.
   * sort = 1  → ascending (oldest first), returned as-is.
   * sort = -1 → descending query, result reversed to ascending before returning.
   */
  private async fetchMessages(
    filter: FilterQuery<MessageDocument>,
    sort: 1 | -1,
    skip: number,
    limit: number,
  ): Promise<{ data: MessageDocument[]; total: number }> {
    const [data, total] = await Promise.all([
      this.messageModel.find(filter).sort({ createdAt: sort }).skip(skip).limit(limit).exec(),
      this.messageModel.countDocuments(filter),
    ]);
    return { data: sort === -1 ? data.reverse() : data, total };
  }

  async markAsRead(
    conversationId: string,
    userId: string,
    messageId: string,
  ): Promise<void> {
    const conversation = await this.getConversation(conversationId, userId);

    const userObjId = new Types.ObjectId(userId);
    const messageObjId = new Types.ObjectId(messageId);
    const now = new Date();

    await this.messageModel.updateOne(
      {
        _id: messageObjId,
        conversationId: new Types.ObjectId(conversationId),
        'readBy.userId': { $ne: userObjId },
      },
      { $push: { readBy: { userId: userObjId, readAt: now } } },
    );

    await this.userConversationModel.updateOne(
      { userId: userObjId, conversationId: new Types.ObjectId(conversationId) },
      { $set: { lastReadMessageId: messageObjId, unreadCount: 0 } },
      { upsert: true },
    );

    // Notify other participants (especially the sender) that this message was read
    this.emitToParticipants(
      conversation.participants as Types.ObjectId[],
      userId,
      'chat:message:readBy',
      {
        conversationId,
        messageId,
        userId,
        readAt: now.toISOString(),
      },
    );
  }

  async markAsDelivered(
    conversationId: string,
    userId: string,
    messageId: string,
  ): Promise<void> {
    const conversation = await this.getConversation(conversationId, userId);

    const userObjId = new Types.ObjectId(userId);
    const messageObjId = new Types.ObjectId(messageId);
    const now = new Date();

    await this.messageModel.updateOne(
      {
        _id: messageObjId,
        conversationId: new Types.ObjectId(conversationId),
        'deliveredTo.userId': { $ne: userObjId },
      },
      { $push: { deliveredTo: { userId: userObjId, deliveredAt: now } } },
    );

    this.emitToParticipants(
      conversation.participants as Types.ObjectId[],
      userId,
      'chat:message:delivered',
      {
        conversationId,
        messageId,
        userId,
        deliveredAt: now.toISOString(),
      },
    );
  }

  async editMessage(
    messageId: string,
    userId: string,
    content: string,
  ): Promise<MessageDocument> {
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Message not found.');
    if (!message.senderId.equals(new Types.ObjectId(userId))) {
      throw new ForbiddenException('You can only edit your own messages.');
    }
    if (message.isDeleted) {
      throw new BadRequestException('Cannot edit a deleted message.');
    }

    const updated = await this.messageModel.findByIdAndUpdate(
      messageId,
      {
        $push: { editHistory: { content: message.content, editedAt: new Date() } },
        $set: { content: content.trim(), editedAt: new Date() },
      },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Message not found.');

    const conversation = await this.conversationModel.findById(updated.conversationId);
    if (conversation) {
      this.emitToAllParticipants(
        conversation.participants as Types.ObjectId[],
        'chat:message:edited',
        {
          messageId: (updated._id as Types.ObjectId).toString(),
          conversationId: (updated.conversationId as Types.ObjectId).toString(),
          content: updated.content,
          editedAt: updated.editedAt,
          editHistory: (updated.editHistory ?? []).map((e: any) => ({
            content: e.content,
            editedAt: e.editedAt,
          })),
        },
      );
    }

    return updated;
  }

  async deleteMessage(
    messageId: string,
    userId: string,
  ): Promise<MessageDocument> {
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Message not found.');

    if (!message.senderId.equals(new Types.ObjectId(userId))) {
      throw new ForbiddenException('You can only delete your own messages.');
    }

    const deleted = await this.messageModel.findByIdAndUpdate(
      messageId,
      { isDeleted: true, deletedAt: new Date(), content: '' },
      { new: true },
    );
    if (!deleted) throw new NotFoundException('Message not found.');

    // ── Real-time: notify all participants of deletion ────────────────────
    const conversation = await this.conversationModel.findById(
      deleted.conversationId,
    );
    if (conversation) {
      this.emitToAllParticipants(
        conversation.participants as Types.ObjectId[],
        'chat:message:deleted',
        {
          messageId: (deleted._id as Types.ObjectId).toString(),
          conversationId: (deleted.conversationId as Types.ObjectId).toString(),
        },
      );
    }

    return deleted;
  }

  async forwardMessage(
    messageId: string,
    senderId: string,
    targetConversationId: string,
  ): Promise<MessageDocument> {
    const original = await this.messageModel.findById(messageId);
    if (!original || original.isDeleted) {
      throw new NotFoundException('Message not found.');
    }

    const targetConversation = await this.getConversation(targetConversationId, senderId);

    // Resolve sender display name
    const senderUser = await this.usersService.findById(senderId).catch(() => null);
    const senderName = (senderUser as any)?.name ?? 'Unknown';

    const dm = targetConversation.disappearingMessages as { enabled?: boolean; ttl?: number } | undefined;
    const expiresAt =
      dm?.enabled && dm.ttl ? new Date(Date.now() + dm.ttl * 1000) : undefined;

    const forwarded = await this.messageModel.create({
      conversationId: targetConversation._id,
      senderId: new Types.ObjectId(senderId),
      type: original.type,
      content: original.content,
      attachments: original.attachments,
      forwardedFrom: {
        messageId: original._id,
        conversationId: original.conversationId,
        senderName,
      },
      readBy: [{ userId: new Types.ObjectId(senderId), readAt: new Date() }],
      ...(expiresAt ? { expiresAt } : {}),
    });

    // Update lastMessage on target conversation
    const previewContent = original.content || (original.attachments?.length ? original.attachments[0].originalName : 'Forwarded message');
    await this.conversationModel.findByIdAndUpdate(targetConversationId, {
      lastMessage: {
        messageId: forwarded._id,
        senderId: forwarded.senderId,
        content: `↪ ${previewContent}`,
        createdAt: forwarded.createdAt,
      },
    });

    await this.userConversationModel.updateMany(
      {
        conversationId: targetConversation._id,
        userId: { $ne: new Types.ObjectId(senderId) },
      },
      { $inc: { unreadCount: 1 } },
    );

    const payload: Record<string, unknown> = {
      _id: (forwarded._id as Types.ObjectId).toString(),
      conversationId: (forwarded.conversationId as Types.ObjectId).toString(),
      senderId: (forwarded.senderId as Types.ObjectId).toString(),
      type: forwarded.type,
      content: forwarded.content,
      attachments: forwarded.attachments,
      replyTo: null,
      readBy: forwarded.readBy,
      isDeleted: forwarded.isDeleted,
      forwardedFrom: {
        messageId: (original._id as Types.ObjectId).toString(),
        conversationId: (original.conversationId as Types.ObjectId).toString(),
        senderName,
      },
      createdAt: forwarded.createdAt,
      updatedAt: forwarded.updatedAt,
    };

    this.emitToParticipants(
      targetConversation.participants as Types.ObjectId[],
      senderId,
      'chat:message:new',
      payload,
    );

    return forwarded;
  }

  async getMentions(
    userId: string,
    limit = 50,
  ): Promise<{ message: MessageDocument; conversationId: string }[]> {
    const userObjId = new Types.ObjectId(userId);

    // Only search in conversations the user belongs to
    const userConvs = await this.userConversationModel
      .find({ userId: userObjId })
      .select('conversationId')
      .lean();
    const convIds = userConvs.map((uc) => uc.conversationId);

    const messages = await this.messageModel
      .find({
        conversationId: { $in: convIds },
        mentions: userObjId,
        isDeleted: false,
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return messages.map((m) => ({
      message: m as unknown as MessageDocument,
      conversationId: (m.conversationId as Types.ObjectId).toString(),
    }));
  }

  // ── Reactions ──────────────────────────────────────────────────────────────

  async toggleReaction(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<MessageDocument> {
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Message not found.');
    if (message.isDeleted) throw new BadRequestException('Cannot react to a deleted message.');

    const userObjId = new Types.ObjectId(userId);
    const reactions = (message.reactions ?? []) as Array<{ emoji: string; userId: Types.ObjectId }>;
    const existing = reactions.findIndex(
      (r) => r.emoji === emoji && r.userId.equals(userObjId),
    );

    let updated: MessageDocument | null;
    if (existing !== -1) {
      // Remove reaction
      updated = await this.messageModel.findByIdAndUpdate(
        messageId,
        { $pull: { reactions: { emoji, userId: userObjId } } },
        { new: true },
      );
    } else {
      // Add reaction
      updated = await this.messageModel.findByIdAndUpdate(
        messageId,
        { $push: { reactions: { emoji, userId: userObjId } } },
        { new: true },
      );
    }
    if (!updated) throw new NotFoundException('Message not found.');

    const conversation = await this.conversationModel.findById(updated.conversationId);
    if (conversation) {
      this.emitToAllParticipants(
        conversation.participants as Types.ObjectId[],
        'chat:message:reaction',
        {
          messageId: (updated._id as Types.ObjectId).toString(),
          conversationId: (updated.conversationId as Types.ObjectId).toString(),
          reactions: (updated.reactions ?? []).map((r: any) => ({
            emoji: r.emoji,
            userId: r.userId.toString(),
          })),
        },
      );
    }
    return updated;
  }

  // ── Pinned messages ────────────────────────────────────────────────────────

  async pinMessage(
    conversationId: string,
    messageId: string,
    userId: string,
  ): Promise<ConversationDocument> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found.');

    const message = await this.messageModel.findById(messageId);
    if (!message || message.isDeleted) throw new NotFoundException('Message not found.');

    const already = (conversation.pinnedMessages ?? []).some(
      (p: any) => p.messageId.toString() === messageId,
    );
    if (already) return conversation as ConversationDocument;

    const pinEntry = {
      messageId: new Types.ObjectId(messageId),
      pinnedBy: new Types.ObjectId(userId),
      pinnedAt: new Date(),
      content: message.content,
    };

    const updated = await this.conversationModel.findByIdAndUpdate(
      conversationId,
      { $push: { pinnedMessages: pinEntry } },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Conversation not found.');

    this.emitToAllParticipants(
      updated.participants as Types.ObjectId[],
      'chat:message:pinned',
      {
        conversationId,
        pinnedMessage: {
          messageId,
          pinnedBy: userId,
          pinnedAt: pinEntry.pinnedAt,
          content: pinEntry.content,
        },
      },
    );
    return updated as ConversationDocument;
  }

  /** Full-text search across all conversations the user belongs to. */
  async searchMessages(
    userId: string,
    query: string,
    limit = 30,
  ): Promise<{ message: MessageDocument; conversationId: string }[]> {
    if (!query?.trim()) return [];

    // Get conversation IDs the user participates in
    const userConvs = await this.userConversationModel
      .find({ userId: new Types.ObjectId(userId) })
      .select('conversationId')
      .lean();
    const convIds = userConvs.map((uc) => uc.conversationId);

    const messages = await this.messageModel
      .find({
        conversationId: { $in: convIds },
        isDeleted: false,
        content: { $regex: query.trim(), $options: 'i' },
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return messages.map((m) => ({
      message: m as unknown as MessageDocument,
      conversationId: (m.conversationId as Types.ObjectId).toString(),
    }));
  }

  // ─── Disappearing messages ──────────────────────────────────────────────────

  async setDisappearingMessages(
    conversationId: string,
    userId: string,
    enabled: boolean,
    ttl: number,
  ): Promise<ConversationDocument> {
    const conv = await this.getConversation(conversationId, userId);
    const updated = await this.conversationModel.findByIdAndUpdate(
      conv._id,
      { $set: { disappearingMessages: { enabled, ttl } } },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Conversation not found.');
    this.emitToAllParticipants(
      updated.participants as Types.ObjectId[],
      'chat:conversation:disappearing',
      { conversationId, enabled, ttl },
    );
    return updated as ConversationDocument;
  }

  // ─── Invite links ────────────────────────────────────────────────────────────

  async getInviteLink(
    conversationId: string,
    userId: string,
  ): Promise<{ token: string }> {
    const conversation = await this.getConversation(conversationId, userId);
    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('Invite links are only available for group conversations.');
    }
    if (conversation.inviteToken) return { token: conversation.inviteToken };
    const token = crypto.randomBytes(20).toString('hex');
    await this.conversationModel.findByIdAndUpdate(conversation._id, { $set: { inviteToken: token } });
    return { token };
  }

  async resetInviteLink(
    conversationId: string,
    userId: string,
  ): Promise<{ token: string }> {
    const conversation = await this.getConversation(conversationId, userId);
    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('Invite links are only available for group conversations.');
    }
    const token = crypto.randomBytes(20).toString('hex');
    await this.conversationModel.findByIdAndUpdate(conversation._id, { $set: { inviteToken: token } });
    return { token };
  }

  async joinViaInviteToken(
    token: string,
    userId: string,
  ): Promise<{ alreadyMember: boolean; conversation: ConversationDocument }> {
    const conversation = await this.conversationModel.findOne({ inviteToken: token });
    if (!conversation) throw new NotFoundException('Invite link is invalid or has been reset.');
    const userObjId = new Types.ObjectId(userId);
    const alreadyMember = conversation.participants.some((p) =>
      (p as Types.ObjectId).equals(userObjId),
    );
    if (!alreadyMember) {
      await this.conversationModel.findByIdAndUpdate(conversation._id, {
        $push: { participants: userObjId },
      });
      conversation.participants.push(userObjId);
      await this.userConversationModel.create({
        userId: userObjId,
        conversationId: conversation._id,
        unreadCount: 0,
        joinedAt: new Date(),
        muted: false,
      });
    }
    return { alreadyMember, conversation };
  }

  // ─── Polls ──────────────────────────────────────────────────────────────────

  async createPoll(
    conversationId: string,
    senderId: string,
    question: string,
    options: string[],
    allowMultiple = false,
  ): Promise<MessageDocument> {
    const conversation = await this.getConversation(conversationId, senderId);

    const dm = conversation.disappearingMessages as { enabled?: boolean; ttl?: number } | undefined;
    const expiresAt = dm?.enabled && dm.ttl ? new Date(Date.now() + dm.ttl * 1000) : undefined;

    const message = await this.messageModel.create({
      conversationId: conversation._id,
      senderId: new Types.ObjectId(senderId),
      type: 'poll',
      content: question,
      attachments: [],
      readBy: [{ userId: new Types.ObjectId(senderId), readAt: new Date() }],
      poll: { question, allowMultiple: !!allowMultiple, options: options.map((text) => ({ text, votes: [] })) },
      ...(expiresAt ? { expiresAt } : {}),
    });

    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessage: {
        messageId: message._id,
        senderId: message.senderId,
        content: `📊 ${question}`,
        createdAt: message.createdAt,
      },
    });

    await this.userConversationModel.updateMany(
      { conversationId: conversation._id, userId: { $ne: new Types.ObjectId(senderId) } },
      { $inc: { unreadCount: 1 } },
    );

    this.emitToAllParticipants(
      conversation.participants as Types.ObjectId[],
      'chat:message:new',
      message.toObject(),
    );

    return message as MessageDocument;
  }

  async votePoll(
    messageId: string,
    userId: string,
    optionIndexes: number[],
  ): Promise<MessageDocument> {
    const message = await this.messageModel.findById(messageId);
    if (!message || message.isDeleted) throw new NotFoundException('Message not found.');
    if (message.type !== 'poll' || !message.poll) throw new BadRequestException('Not a poll message.');

    const options = message.poll.options as Array<{ text: string; votes: Types.ObjectId[] }>;

    if (!Array.isArray(optionIndexes) || optionIndexes.length === 0) {
      throw new BadRequestException('optionIndexes must be a non-empty array.');
    }
    const unique = [...new Set(optionIndexes)];
    if (unique.some((i) => typeof i !== 'number' || i < 0 || i >= options.length)) {
      throw new BadRequestException('Invalid option index.');
    }
    const allowMultiple = !!(message.poll as any).allowMultiple;
    if (!allowMultiple && unique.length !== 1) {
      throw new BadRequestException('This poll allows only one answer.');
    }

    const uid = new Types.ObjectId(userId);

    // Telegram-like rule: cannot change vote once voted.
    const alreadyVoted = options.some((opt) => (opt.votes ?? []).some((v) => v.equals(uid)));
    if (alreadyVoted) {
      throw new BadRequestException('You have already voted in this poll.');
    }

    // Add vote(s) to selected options (no previous vote removal)
    const updatedOptions = options.map((opt, i) => ({
      text: opt.text,
      votes: unique.includes(i)
        ? [...(opt.votes ?? []), uid]
        : (opt.votes ?? []),
    }));

    const updated = await this.messageModel.findByIdAndUpdate(
      messageId,
      { $set: { 'poll.options': updatedOptions } },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Message not found.');

    const conversation = await this.conversationModel.findById(message.conversationId);
    if (conversation) {
      this.emitToAllParticipants(
        conversation.participants as Types.ObjectId[],
        'chat:poll:updated',
        { messageId, poll: updated.poll },
      );
    }

    return updated as MessageDocument;
  }

  async unpinMessage(
    conversationId: string,
    messageId: string,
  ): Promise<ConversationDocument> {
    const updated = await this.conversationModel.findByIdAndUpdate(
      conversationId,
      { $pull: { pinnedMessages: { messageId: new Types.ObjectId(messageId) } } },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Conversation not found.');

    this.emitToAllParticipants(
      updated.participants as Types.ObjectId[],
      'chat:message:unpinned',
      { conversationId, messageId },
    );
    return updated as ConversationDocument;
  }

  // ─── Scheduled Messages ───────────────────────────────────────────────────

  async scheduleMessage(
    conversationId: string,
    senderId: string,
    dto: ScheduleMessageDto,
  ): Promise<ScheduledMessageDocument> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found.');

    const senderOid = new Types.ObjectId(senderId);
    const isMember = conversation.participants.some((p) => p.equals(senderOid));
    if (!isMember) throw new ForbiddenException('Not a participant.');

    const scheduledFor = new Date(dto.scheduledFor);
    if (scheduledFor <= new Date()) {
      throw new BadRequestException('scheduledFor must be in the future.');
    }

    const doc = await this.scheduledMessageModel.create({
      conversationId: new Types.ObjectId(conversationId),
      senderId: senderOid,
      content: dto.content,
      type: dto.type ?? MessageType.TEXT,
      replyTo: dto.replyTo ? new Types.ObjectId(dto.replyTo) : undefined,
      scheduledFor,
      status: ScheduledMessageStatus.PENDING,
    });

    const delayMs = scheduledFor.getTime() - Date.now();
    const job = await this.bullmqService.addDelayedJob(
      'scheduled-messages',
      'send-scheduled-message',
      { scheduledMessageId: (doc as any)._id.toString() },
      delayMs,
    );

    await this.scheduledMessageModel.findByIdAndUpdate(
      (doc as any)._id,
      { jobId: job.id },
    );

    return doc as ScheduledMessageDocument;
  }

  async getScheduledMessages(userId: string): Promise<ScheduledMessageDocument[]> {
    return this.scheduledMessageModel
      .find({ senderId: new Types.ObjectId(userId), status: ScheduledMessageStatus.PENDING })
      .sort({ scheduledFor: 1 })
      .exec() as Promise<ScheduledMessageDocument[]>;
  }

  async cancelScheduledMessage(id: string, userId: string): Promise<void> {
    const doc = await this.scheduledMessageModel.findById(id);
    if (!doc) throw new NotFoundException('Scheduled message not found.');
    if (!doc.senderId.equals(new Types.ObjectId(userId))) {
      throw new ForbiddenException('Only the sender can cancel a scheduled message.');
    }
    if (doc.status !== ScheduledMessageStatus.PENDING) {
      throw new BadRequestException('Only pending scheduled messages can be cancelled.');
    }

    if (doc.jobId) {
      await this.bullmqService.removeJob('scheduled-messages', doc.jobId);
    }

    await this.scheduledMessageModel.findByIdAndUpdate(id, {
      status: ScheduledMessageStatus.CANCELLED,
    });
  }

  /** Called by the BullMQ worker when the scheduled time arrives */
  async sendScheduledMessage(scheduledMessageId: string): Promise<void> {
    const doc = await this.scheduledMessageModel.findById(scheduledMessageId);
    if (!doc || doc.status !== ScheduledMessageStatus.PENDING) return;

    try {
      const sendDto: SendMessageDto = {
        content: doc.content,
        type: doc.type,
        replyTo: doc.replyTo?.toString(),
      };
      await this.sendMessage(
        doc.conversationId.toString(),
        doc.senderId.toString(),
        sendDto,
        [],
      );
      await this.scheduledMessageModel.findByIdAndUpdate(scheduledMessageId, {
        status: ScheduledMessageStatus.SENT,
      });
    } catch {
      await this.scheduledMessageModel.findByIdAndUpdate(scheduledMessageId, {
        status: ScheduledMessageStatus.FAILED,
      });
    }
  }

  // ─── Message Reminders ────────────────────────────────────────────────────

  async setReminder(
    messageId: string,
    userId: string,
    dto: SetReminderDto,
  ): Promise<MessageReminderDocument> {
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Message not found.');

    const remindAt = new Date(dto.remindAt);
    if (remindAt <= new Date()) {
      throw new BadRequestException('remindAt must be in the future.');
    }

    const doc = await this.messageReminderModel.create({
      userId: new Types.ObjectId(userId),
      messageId: new Types.ObjectId(messageId),
      conversationId: message.conversationId,
      remindAt,
      note: dto.note,
      messageContent: message.content?.slice(0, 200),
      status: MessageReminderStatus.PENDING,
    });

    const delayMs = remindAt.getTime() - Date.now();
    const job = await this.bullmqService.addDelayedJob(
      'message-reminders',
      'fire-message-reminder',
      { reminderId: (doc as any)._id.toString() },
      delayMs,
    );

    await this.messageReminderModel.findByIdAndUpdate(
      (doc as any)._id,
      { jobId: job.id },
    );

    return doc as MessageReminderDocument;
  }

  async getReminders(userId: string): Promise<MessageReminderDocument[]> {
    return this.messageReminderModel
      .find({ userId: new Types.ObjectId(userId), status: MessageReminderStatus.PENDING })
      .sort({ remindAt: 1 })
      .exec() as Promise<MessageReminderDocument[]>;
  }

  async cancelReminder(id: string, userId: string): Promise<void> {
    const doc = await this.messageReminderModel.findById(id);
    if (!doc) throw new NotFoundException('Reminder not found.');
    if (!doc.userId.equals(new Types.ObjectId(userId))) {
      throw new ForbiddenException('Only the owner can cancel a reminder.');
    }
    if (doc.status !== MessageReminderStatus.PENDING) {
      throw new BadRequestException('Only pending reminders can be cancelled.');
    }

    if (doc.jobId) {
      await this.bullmqService.removeJob('message-reminders', doc.jobId);
    }

    await this.messageReminderModel.findByIdAndUpdate(id, {
      status: MessageReminderStatus.CANCELLED,
    });
  }

  /** Called by the BullMQ worker when the reminder time arrives */
  async fireReminder(reminderId: string): Promise<void> {
    const doc = await this.messageReminderModel.findById(reminderId);
    if (!doc || doc.status !== MessageReminderStatus.PENDING) return;

    const notification = await this.notificationsService.create({
      recipientId: doc.userId.toString(),
      conversationId: doc.conversationId.toString(),
      type: NotificationType.CHAT_MESSAGE_REMINDER,
      message: doc.note
        ? `Reminder: "${doc.note}"`
        : `Reminder for message: "${(doc.messageContent ?? '').slice(0, 60)}"`,
    });
    

    this.wsGateway.broadcastToRoom(`user:${doc.userId.toString()}`, 'notification:new', notification);

    await this.messageReminderModel.findByIdAndUpdate(reminderId, {
      status: MessageReminderStatus.SENT,
    });
  }

  // ─── Saved Replies ────────────────────────────────────────────────────────

  async createSavedReply(
    userId: string,
    dto: CreateSavedReplyDto,
  ): Promise<SavedReplyDocument> {
    const existing = await this.savedReplyModel.findOne({
      userId: new Types.ObjectId(userId),
      shortcut: dto.shortcut,
    });
    if (existing) {
      throw new ConflictException(`Shortcut "/${dto.shortcut}" already exists.`);
    }

    return this.savedReplyModel.create({
      userId: new Types.ObjectId(userId),
      title: dto.title,
      shortcut: dto.shortcut,
      content: dto.content,
    }) as Promise<SavedReplyDocument>;
  }

  async getSavedReplies(userId: string): Promise<SavedReplyDocument[]> {
    return this.savedReplyModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ shortcut: 1 })
      .exec() as Promise<SavedReplyDocument[]>;
  }

  async updateSavedReply(
    id: string,
    userId: string,
    dto: UpdateSavedReplyDto,
  ): Promise<SavedReplyDocument> {
    const doc = await this.savedReplyModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });
    if (!doc) throw new NotFoundException('Saved reply not found.');

    if (dto.shortcut && dto.shortcut !== doc.shortcut) {
      const conflict = await this.savedReplyModel.findOne({
        userId: new Types.ObjectId(userId),
        shortcut: dto.shortcut,
      });
      if (conflict) {
        throw new ConflictException(`Shortcut "/${dto.shortcut}" already exists.`);
      }
    }

    const updated = await this.savedReplyModel.findByIdAndUpdate(id, dto, { new: true });
    return updated as SavedReplyDocument;
  }

  async deleteSavedReply(id: string, userId: string): Promise<void> {
    const doc = await this.savedReplyModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });
    if (!doc) throw new NotFoundException('Saved reply not found.');
    await this.savedReplyModel.findByIdAndDelete(id);
  }
}
