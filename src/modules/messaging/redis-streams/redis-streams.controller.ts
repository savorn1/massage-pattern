import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { RedisStreamsService } from './redis-streams.service';
import {
  AddMessageDto,
  CreateGroupDto,
  ConsumeGroupDto,
  AcknowledgeDto,
} from './dto/stream-message.dto';

@Controller('redis-streams')
export class RedisStreamsController {
  constructor(private readonly streamsService: RedisStreamsService) {}

  // ════════════════════════════════════════════════════════════════════════════
  // PRODUCER ENDPOINTS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Add a message to a stream
   * POST /redis-streams/add
   */
  @Post('add')
  async addMessage(@Body() dto: AddMessageDto) {
    const messageId = await this.streamsService.addMessage(
      dto.stream,
      dto.data,
      dto.maxLen,
    );
    return {
      success: true,
      messageId,
      stream: dto.stream,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SIMPLE CONSUMER ENDPOINTS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Read messages from a stream
   * GET /redis-streams/:stream/messages?startId=0&count=10
   */
  @Get(':stream/messages')
  async readMessages(
    @Param('stream') stream: string,
    @Query('startId', new DefaultValuePipe('0')) startId: string,
    @Query('count', new DefaultValuePipe(10), ParseIntPipe) count: number,
  ) {
    const messages = await this.streamsService.readMessages(
      stream,
      startId,
      count,
    );
    return {
      stream,
      count: messages.length,
      messages,
    };
  }

  /**
   * Read latest messages from a stream
   * GET /redis-streams/:stream/latest?count=10
   */
  @Get(':stream/latest')
  async readLatestMessages(
    @Param('stream') stream: string,
    @Query('count', new DefaultValuePipe(10), ParseIntPipe) count: number,
  ) {
    const messages = await this.streamsService.readLatestMessages(
      stream,
      count,
    );
    return {
      stream,
      count: messages.length,
      messages,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CONSUMER GROUP ENDPOINTS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Create a consumer group
   * POST /redis-streams/groups/create
   */
  @Post('groups/create')
  async createGroup(@Body() dto: CreateGroupDto) {
    const created = await this.streamsService.createConsumerGroup(
      dto.stream,
      dto.group,
      dto.startId,
    );
    return {
      success: true,
      created,
      stream: dto.stream,
      group: dto.group,
    };
  }

  /**
   * Read messages from a consumer group
   * POST /redis-streams/groups/consume
   */
  @Post('groups/consume')
  async consumeFromGroup(@Body() dto: ConsumeGroupDto) {
    const messages = await this.streamsService.readFromGroup(
      dto.stream,
      dto.group,
      dto.count,
      dto.blockMs,
    );
    return {
      stream: dto.stream,
      group: dto.group,
      count: messages.length,
      messages,
    };
  }

  /**
   * Acknowledge a message
   * POST /redis-streams/groups/ack
   */
  @Post('groups/ack')
  async acknowledge(@Body() dto: AcknowledgeDto) {
    const result = await this.streamsService.acknowledge(
      dto.stream,
      dto.group,
      dto.messageId,
    );
    return {
      success: result > 0,
      acknowledged: result,
    };
  }

  /**
   * Get pending messages for a group
   * GET /redis-streams/:stream/groups/:group/pending?count=10
   */
  @Get(':stream/groups/:group/pending')
  async getPendingMessages(
    @Param('stream') stream: string,
    @Param('group') group: string,
    @Query('count', new DefaultValuePipe(10), ParseIntPipe) count: number,
  ) {
    const pending = await this.streamsService.getPendingMessages(
      stream,
      group,
      count,
    );
    return {
      stream,
      group,
      count: pending.length,
      pending,
    };
  }

  /**
   * Claim stuck messages
   * POST /redis-streams/:stream/groups/:group/claim?minIdleTime=60000
   */
  @Post(':stream/groups/:group/claim')
  async claimStuckMessages(
    @Param('stream') stream: string,
    @Param('group') group: string,
    @Query('minIdleTime', new DefaultValuePipe(60000), ParseIntPipe)
    minIdleTime: number,
  ) {
    const claimed = await this.streamsService.claimStuckMessages(
      stream,
      group,
      minIdleTime,
    );
    return {
      stream,
      group,
      claimed: claimed.length,
      messages: claimed,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // INFO & MANAGEMENT ENDPOINTS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Get stream info
   * GET /redis-streams/:stream/info
   */
  @Get(':stream/info')
  async getStreamInfo(@Param('stream') stream: string) {
    const [info, length, groups] = await Promise.all([
      this.streamsService.getStreamInfo(stream),
      this.streamsService.getStreamLength(stream),
      this.streamsService.getGroupInfo(stream),
    ]);
    return {
      stream,
      length,
      info,
      groups,
    };
  }

  /**
   * Get stream length
   * GET /redis-streams/:stream/length
   */
  @Get(':stream/length')
  async getStreamLength(@Param('stream') stream: string) {
    const length = await this.streamsService.getStreamLength(stream);
    return {
      stream,
      length,
    };
  }

  /**
   * Trim stream to max length
   * POST /redis-streams/:stream/trim?maxLen=1000
   */
  @Post(':stream/trim')
  async trimStream(
    @Param('stream') stream: string,
    @Query('maxLen', ParseIntPipe) maxLen: number,
  ) {
    const deleted = await this.streamsService.trimStream(stream, maxLen);
    return {
      stream,
      deleted,
    };
  }

  /**
   * Delete stream
   * DELETE /redis-streams/:stream
   */
  @Delete(':stream')
  async deleteStream(@Param('stream') stream: string) {
    const result = await this.streamsService.deleteStream(stream);
    return {
      success: result > 0,
      stream,
    };
  }

  /**
   * Health check
   * GET /redis-streams/health
   */
  @Get('health')
  healthCheck() {
    return {
      status: this.streamsService.isConnected() ? 'connected' : 'disconnected',
      service: 'redis-streams',
    };
  }
}
