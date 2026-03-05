import {
  Conversation,
  ConversationDocument,
  ConversationType,
  Message,
  MessageDocument,
  MessageType,
  UserConversation,
  UserConversationDocument,
} from '@/modules/shared/entities';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WebsocketGateway } from '@/modules/messaging/websocket/websocket.gateway';
import { UploadsService } from '@/modules/uploads/uploads.service';
import { NotificationsService } from '@/modules/admin/notifications/notifications.service';
import { UsersService } from '@/modules/admin/users/users.service';
import { NotificationType } from '@/modules/shared/entities';
import { CreateConversationDto, SendMessageDto, UpdateGroupDto } from './dto';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,

    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,

    @InjectModel(UserConversation.name)
    private readonly userConversationModel: Model<UserConversationDocument>,

    private readonly wsGateway: WebsocketGateway,
    private readonly uploadsService: UploadsService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Emit an event to every participant's personal room (except the sender) */
  private emitToParticipants(
    participants: Types.ObjectId[],
    excludeSenderId: string,
    event: string,
    payload: Record<string, unknown>,
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
    payload: Record<string, unknown>,
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
    const userConversations = await this.userConversationModel
      .find({ userId: new Types.ObjectId(userId) })
      .lean();

    const unreadMap = new Map<string, number>(
      userConversations.map((uc) => [uc.conversationId.toString(), uc.unreadCount ?? 0]),
    );

    const conversationIds = userConversations.map((uc) => uc.conversationId);

    const conversations = await this.conversationModel
      .find({ _id: { $in: conversationIds } })
      .sort({ updatedAt: -1 })
      .lean();

    return conversations.map((conv) => ({
      ...conv,
      unreadCount: unreadMap.get((conv._id as Types.ObjectId).toString()) ?? 0,
    }));
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
          .uploadFile(file.buffer, file.originalname, file.mimetype, senderId)
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

    const message = await this.messageModel.create({
      conversationId: conversation._id,
      senderId: new Types.ObjectId(senderId),
      type,
      content: dto.content?.trim() ?? '',
      attachments,
      replyTo: dto.replyTo ? new Types.ObjectId(dto.replyTo) : undefined,
      readBy: [{ userId: new Types.ObjectId(senderId), readAt: new Date() }],
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
  ): Promise<{ data: MessageDocument[]; total: number }> {
    await this.getConversation(conversationId, userId);

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.messageModel
        .find({ conversationId: new Types.ObjectId(conversationId), isDeleted: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.messageModel.countDocuments({
        conversationId: new Types.ObjectId(conversationId),
        isDeleted: false,
      }),
    ]);

    return { data, total };
  }

  async markAsRead(
    conversationId: string,
    userId: string,
    messageId: string,
  ): Promise<void> {
    await this.getConversation(conversationId, userId);

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
      { lastReadMessageId: messageObjId, unreadCount: 0 },
    );
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
}
