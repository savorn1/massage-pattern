import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { QueryMessageDto } from './dto/query-message.dto';

@Injectable()
export class MongodbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MongodbService.name);

  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  onModuleInit() {
    this.logger.log('MongoDB service initialized');
  }

  onModuleDestroy() {
    this.logger.log('MongoDB service destroyed');
  }

  /**
   * Create a new message
   */
  async create(createMessageDto: CreateMessageDto): Promise<MessageDocument> {
    try {
      const message = new this.messageModel(createMessageDto);
      const savedMessage = await message.save();
      this.logger.log(`Message created with ID: ${String(savedMessage._id)}`);
      return savedMessage;
    } catch (error) {
      this.logger.error('Failed to create message', error);
      throw error;
    }
  }

  /**
   * Find all messages with optional filtering, pagination
   */
  async findAll(queryDto: QueryMessageDto = {}): Promise<MessageDocument[]> {
    try {
      const { limit = 100, skip = 0, ...filters } = queryDto;

      const query: FilterQuery<MessageDocument> = {};

      if (filters.sender) query.sender = filters.sender;
      if (filters.recipient) query.recipient = filters.recipient;
      if (filters.channel) query.channel = filters.channel;
      if (filters.type) query.type = filters.type;
      if (filters.isRead !== undefined) query.isRead = filters.isRead;

      const messages = await this.messageModel
        .find(query)
        .limit(limit)
        .skip(skip)
        .sort({ createdAt: -1 })
        .exec();

      this.logger.log(`Found ${messages.length} messages`);
      return messages;
    } catch (error) {
      this.logger.error('Failed to find messages', error);
      throw error;
    }
  }

  /**
   * Find a single message by ID
   */
  async findOne(id: string): Promise<MessageDocument | null> {
    try {
      const message = await this.messageModel.findById(id).exec();
      if (message) {
        this.logger.log(`Found message with ID: ${id}`);
      } else {
        this.logger.warn(`Message not found with ID: ${id}`);
      }
      return message;
    } catch (error) {
      this.logger.error(`Failed to find message with ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * Update a message by ID
   */
  async update(
    id: string,
    updateMessageDto: UpdateMessageDto,
  ): Promise<MessageDocument | null> {
    try {
      const updatedMessage = await this.messageModel
        .findByIdAndUpdate(id, updateMessageDto, { new: true })
        .exec();

      if (updatedMessage) {
        this.logger.log(`Message updated with ID: ${id}`);
      } else {
        this.logger.warn(`Message not found for update with ID: ${id}`);
      }
      return updatedMessage;
    } catch (error) {
      this.logger.error(`Failed to update message with ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * Delete a message by ID
   */
  async delete(id: string): Promise<MessageDocument | null> {
    try {
      const deletedMessage = await this.messageModel
        .findByIdAndDelete(id)
        .exec();
      if (deletedMessage) {
        this.logger.log(`Message deleted with ID: ${id}`);
      } else {
        this.logger.warn(`Message not found for deletion with ID: ${id}`);
      }
      return deletedMessage;
    } catch (error) {
      this.logger.error(`Failed to delete message with ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(id: string): Promise<MessageDocument | null> {
    return this.update(id, { isRead: true });
  }

  /**
   * Get message count with optional filters
   */
  async count(queryDto: QueryMessageDto = {}): Promise<number> {
    try {
      const { ...filters } = queryDto;

      const query: FilterQuery<MessageDocument> = {};

      if (filters.sender) query.sender = filters.sender;
      if (filters.recipient) query.recipient = filters.recipient;
      if (filters.channel) query.channel = filters.channel;
      if (filters.type) query.type = filters.type;
      if (filters.isRead !== undefined) query.isRead = filters.isRead;

      const count = await this.messageModel.countDocuments(query).exec();
      this.logger.log(`Message count: ${count}`);
      return count;
    } catch (error) {
      this.logger.error('Failed to count messages', error);
      throw error;
    }
  }

  /**
   * Get unread messages for a recipient
   */
  async getUnreadMessages(recipient: string): Promise<MessageDocument[]> {
    try {
      const messages = await this.messageModel
        .find({ recipient, isRead: false })
        .sort({ createdAt: -1 })
        .exec();

      this.logger.log(
        `Found ${messages.length} unread messages for ${recipient}`,
      );
      return messages;
    } catch (error) {
      this.logger.error(
        `Failed to get unread messages for ${recipient}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get conversation between two users
   */
  async getConversation(
    user1: string,
    user2: string,
    limit = 50,
  ): Promise<MessageDocument[]> {
    try {
      const messages = await this.messageModel
        .find({
          $or: [
            { sender: user1, recipient: user2 },
            { sender: user2, recipient: user1 },
          ],
        })
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec();

      this.logger.log(
        `Found ${messages.length} messages in conversation between ${user1} and ${user2}`,
      );
      return messages;
    } catch (error) {
      this.logger.error(
        `Failed to get conversation between ${user1} and ${user2}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get messages in a channel
   */
  async getChannelMessages(
    channel: string,
    limit = 100,
  ): Promise<MessageDocument[]> {
    try {
      const messages = await this.messageModel
        .find({ channel })
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec();

      this.logger.log(
        `Found ${messages.length} messages in channel ${channel}`,
      );
      return messages;
    } catch (error) {
      this.logger.error(`Failed to get messages for channel ${channel}`, error);
      throw error;
    }
  }

  /**
   * Delete all messages (use with caution)
   */
  async deleteAll(): Promise<{ deletedCount: number }> {
    try {
      const result = await this.messageModel.deleteMany({}).exec();
      this.logger.warn(`Deleted ${result.deletedCount} messages`);
      return { deletedCount: result.deletedCount };
    } catch (error) {
      this.logger.error('Failed to delete all messages', error);
      throw error;
    }
  }
}
