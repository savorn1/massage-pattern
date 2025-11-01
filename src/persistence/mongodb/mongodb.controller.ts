import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { MongodbService } from './mongodb.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { QueryMessageDto } from './dto/query-message.dto';

@Controller('mongodb')
export class MongodbController {
  constructor(private readonly mongodbService: MongodbService) {}

  /**
   * Create a new message
   * POST /mongodb/messages
   */
  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createMessageDto: CreateMessageDto) {
    const message = await this.mongodbService.create(createMessageDto);
    return {
      success: true,
      data: message,
      message: 'Message created successfully',
    };
  }

  /**
   * Get all messages with optional filtering and pagination
   * GET /mongodb/messages?sender=alice&limit=50&skip=0
   */
  @Get('messages')
  async findAll(@Query() queryDto: QueryMessageDto) {
    const messages = await this.mongodbService.findAll(queryDto);
    const count = await this.mongodbService.count(queryDto);
    return {
      success: true,
      data: messages,
      total: count,
      limit: queryDto.limit || 100,
      skip: queryDto.skip || 0,
    };
  }

  /**
   * Get a single message by ID
   * GET /mongodb/messages/:id
   */
  @Get('messages/:id')
  async findOne(@Param('id') id: string) {
    const message = await this.mongodbService.findOne(id);
    if (!message) {
      throw new NotFoundException(`Message with ID ${id} not found`);
    }
    return {
      success: true,
      data: message,
    };
  }

  /**
   * Update a message by ID
   * PUT /mongodb/messages/:id
   */
  @Put('messages/:id')
  async update(
    @Param('id') id: string,
    @Body() updateMessageDto: UpdateMessageDto,
  ) {
    const message = await this.mongodbService.update(id, updateMessageDto);
    if (!message) {
      throw new NotFoundException(`Message with ID ${id} not found`);
    }
    return {
      success: true,
      data: message,
      message: 'Message updated successfully',
    };
  }

  /**
   * Delete a message by ID
   * DELETE /mongodb/messages/:id
   */
  @Delete('messages/:id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string) {
    const message = await this.mongodbService.delete(id);
    if (!message) {
      throw new NotFoundException(`Message with ID ${id} not found`);
    }
    return {
      success: true,
      data: message,
      message: 'Message deleted successfully',
    };
  }

  /**
   * Mark a message as read
   * PUT /mongodb/messages/:id/read
   */
  @Put('messages/:id/read')
  async markAsRead(@Param('id') id: string) {
    const message = await this.mongodbService.markAsRead(id);
    if (!message) {
      throw new NotFoundException(`Message with ID ${id} not found`);
    }
    return {
      success: true,
      data: message,
      message: 'Message marked as read',
    };
  }

  /**
   * Get unread messages for a recipient
   * GET /mongodb/messages/unread/:recipient
   */
  @Get('messages/unread/:recipient')
  async getUnreadMessages(@Param('recipient') recipient: string) {
    const messages = await this.mongodbService.getUnreadMessages(recipient);
    return {
      success: true,
      data: messages,
      count: messages.length,
    };
  }

  /**
   * Get conversation between two users
   * GET /mongodb/conversations/:user1/:user2?limit=50
   */
  @Get('conversations/:user1/:user2')
  async getConversation(
    @Param('user1') user1: string,
    @Param('user2') user2: string,
    @Query('limit') limit?: number,
  ) {
    const messages = await this.mongodbService.getConversation(
      user1,
      user2,
      limit || 50,
    );
    return {
      success: true,
      data: messages,
      count: messages.length,
    };
  }

  /**
   * Get messages in a channel
   * GET /mongodb/channels/:channel?limit=100
   */
  @Get('channels/:channel')
  async getChannelMessages(
    @Param('channel') channel: string,
    @Query('limit') limit?: number,
  ) {
    const messages = await this.mongodbService.getChannelMessages(
      channel,
      limit || 100,
    );
    return {
      success: true,
      data: messages,
      count: messages.length,
    };
  }

  /**
   * Get message count
   * GET /mongodb/messages/count
   */
  @Get('messages/count')
  async count(@Query() queryDto: QueryMessageDto) {
    const count = await this.mongodbService.count(queryDto);
    return {
      success: true,
      count,
    };
  }

  /**
   * Delete all messages (use with caution)
   * DELETE /mongodb/messages
   */
  @Delete('messages')
  @HttpCode(HttpStatus.OK)
  async deleteAll() {
    const result = await this.mongodbService.deleteAll();
    return {
      success: true,
      deletedCount: result.deletedCount,
      message: 'All messages deleted',
    };
  }

  /**
   * Health check endpoint
   * GET /mongodb/health
   */
  @Get('health')
  health() {
    return {
      success: true,
      status: 'MongoDB service is running',
      timestamp: new Date().toISOString(),
    };
  }
}
