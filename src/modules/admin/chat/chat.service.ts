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
    const userConvDocs = participantIds.map((uid) => ({
      userId: uid,
      conversationId: conversation._id,
      unreadCount: 0,
      joinedAt: now,
      muted: false,
    }));
    await this.userConversationModel.insertMany(userConvDocs);

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

    return conversation;
  }

  async getUserConversations(userId: string): Promise<ConversationDocument[]> {
    const userConvs = await this.userConversationModel
      .find({ userId: new Types.ObjectId(userId) })
      .lean();

    const conversationIds = userConvs.map((uc) => uc.conversationId);

    return this.conversationModel
      .find({ _id: { $in: conversationIds } })
      .sort({ updatedAt: -1 })
      .exec();
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
    await this.conversationModel.findByIdAndUpdate(conversationId, {
      $pull: { participants: targetId, admins: targetId },
    });

    const updated = await this.conversationModel.findById(conversationId).exec();
    if (!updated) throw new NotFoundException('Conversation not found.');
    return updated;
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  async sendMessage(
    conversationId: string,
    senderId: string,
    dto: SendMessageDto,
  ): Promise<MessageDocument> {
    const conversation = await this.getConversation(conversationId, senderId);

    const message = await this.messageModel.create({
      conversationId: conversation._id,
      senderId: new Types.ObjectId(senderId),
      type: dto.type ?? MessageType.TEXT,
      content: dto.content,
      replyTo: dto.replyTo ? new Types.ObjectId(dto.replyTo) : undefined,
      readBy: [{ userId: new Types.ObjectId(senderId), readAt: new Date() }],
    });

    // Update lastMessage snapshot on the conversation
    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessage: {
        messageId: message._id,
        senderId: message.senderId,
        content: message.content,
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
