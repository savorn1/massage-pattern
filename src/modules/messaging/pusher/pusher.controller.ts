import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Headers,
  Param,
  RawBodyRequest,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { PusherService } from './pusher.service';
import {
  TriggerEventDto,
  TriggerMultipleDto,
  TriggerBatchDto,
  AuthChannelDto,
} from './dto';

/**
 * Pusher Controller
 *
 * REST API for Pusher operations:
 *
 * Trigger Events:
 * - POST /pusher/trigger         - Trigger event on a channel
 * - POST /pusher/trigger-multiple - Trigger event on multiple channels
 * - POST /pusher/trigger-batch   - Trigger multiple events in batch
 *
 * Authentication:
 * - POST /pusher/auth            - Authenticate private/presence channel
 *
 * Channel Info:
 * - GET /pusher/channels         - List channels
 * - GET /pusher/channels/:name   - Get channel info
 * - GET /pusher/channels/:name/users - Get presence channel users
 *
 * Webhooks:
 * - POST /pusher/webhooks        - Receive Pusher webhooks
 *
 * Config:
 * - GET /pusher/config           - Get client-side config
 * - GET /pusher/status           - Health check
 */
@Controller('pusher')
export class PusherController {
  constructor(private readonly pusherService: PusherService) {}

  // ════════════════════════════════════════════════════════════════════════════
  // TRIGGER EVENTS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Trigger an event on a channel
   * POST /pusher/trigger
   */
  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  async trigger(@Body() dto: TriggerEventDto) {
    const result = await this.pusherService.trigger(
      dto.channel,
      dto.event,
      dto.data,
      dto.socketId,
    );

    return {
      ...result,
      channel: dto.channel,
      event: dto.event,
    };
  }

  /**
   * Trigger an event on multiple channels
   * POST /pusher/trigger-multiple
   */
  @Post('trigger-multiple')
  @HttpCode(HttpStatus.OK)
  async triggerMultiple(@Body() dto: TriggerMultipleDto) {
    const result = await this.pusherService.triggerMultiple(
      dto.channels,
      dto.event,
      dto.data,
    );

    return {
      ...result,
      event: dto.event,
    };
  }

  /**
   * Trigger multiple events in a batch
   * POST /pusher/trigger-batch
   */
  @Post('trigger-batch')
  @HttpCode(HttpStatus.OK)
  async triggerBatch(@Body() dto: TriggerBatchDto) {
    const result = await this.pusherService.triggerBatch(dto.batch);

    return {
      ...result,
      eventCount: dto.batch.length,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CHANNEL AUTHENTICATION
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Authenticate a private or presence channel
   * POST /pusher/auth
   *
   * This endpoint is called by Pusher client when subscribing to private/presence channels.
   * You should add your own authorization logic here (e.g., check if user can access the channel).
   */
  @Post('auth')
  @HttpCode(HttpStatus.OK)
  authenticateChannel(
    @Body() dto: AuthChannelDto,
    // Add @Req() to get user from request if using authentication
  ) {
    const channelType = this.pusherService.getChannelType(dto.channel_name);

    // TODO: Add your authorization logic here
    // Example: Check if the authenticated user can access this channel
    // const user = req.user;
    // if (!canUserAccessChannel(user, dto.channel_name)) {
    //   throw new ForbiddenException('Access denied');
    // }

    if (channelType === 'presence') {
      // For presence channels, you need user info
      // In a real app, get this from authenticated user
      const userId = 'user-' + Math.random().toString(36).substring(7);
      const userInfo = {
        name: 'Anonymous User',
        // Add more user info as needed
      };

      return this.pusherService.authenticatePresenceChannel(
        dto.socket_id,
        dto.channel_name,
        userId,
        userInfo,
      );
    }

    // Private channel
    return this.pusherService.authenticatePrivateChannel(
      dto.socket_id,
      dto.channel_name,
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CHANNEL INFORMATION
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Get list of channels
   * GET /pusher/channels?prefix=private-&info=user_count
   */
  @Get('channels')
  async getChannels(
    @Query('prefix') prefix?: string,
    @Query('info') info?: string,
  ) {
    const infoArray = info ? info.split(',') : undefined;
    const channels = await this.pusherService.getChannels({
      prefix,
      info: infoArray,
    });

    return {
      channels,
      count: Object.keys(channels).length,
    };
  }

  /**
   * Get channel information
   * GET /pusher/channels/:name?info=user_count,subscription_count
   */
  @Get('channels/:name')
  async getChannelInfo(
    @Param('name') name: string,
    @Query('info') info?: string,
  ) {
    const infoArray = info ? info.split(',') : undefined;
    const channelInfo = await this.pusherService.getChannelInfo(name, {
      info: infoArray,
    });

    return {
      channel: name,
      type: this.pusherService.getChannelType(name),
      ...channelInfo,
    };
  }

  /**
   * Get users in a presence channel
   * GET /pusher/channels/:name/users
   */
  @Get('channels/:name/users')
  async getChannelUsers(@Param('name') name: string) {
    const users = await this.pusherService.getPresenceUsers(name);

    return {
      channel: name,
      users,
      count: users.length,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // WEBHOOKS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Receive Pusher webhooks
   * POST /pusher/webhooks
   *
   * Configure webhook URL in Pusher dashboard:
   * https://your-domain.com/pusher/webhooks
   */
  @Post('webhooks')
  @HttpCode(HttpStatus.OK)
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-pusher-signature') signature: string,
  ) {
    const rawBody = req.rawBody?.toString() || '';

    const webhookData = this.pusherService.parseWebhook(rawBody, signature);

    if (!webhookData) {
      return { received: false, error: 'Invalid signature' };
    }

    // Process webhook events
    for (const event of webhookData.events) {
      switch (event.name) {
        case 'channel_occupied':
          // Channel became occupied (first subscriber)
          console.log(`Channel occupied: ${event.channel}`);
          break;

        case 'channel_vacated':
          // Channel became empty (last subscriber left)
          console.log(`Channel vacated: ${event.channel}`);
          break;

        case 'member_added':
          // Member joined a presence channel
          console.log(`Member added to ${event.channel}: ${event.user_id}`);
          break;

        case 'member_removed':
          // Member left a presence channel
          console.log(`Member removed from ${event.channel}: ${event.user_id}`);
          break;

        case 'client_event':
          // Client triggered an event
          console.log(`Client event on ${event.channel}: ${event.event}`);
          break;

        default:
          console.log(`Unknown webhook event: ${event.name}`);
      }
    }

    return { received: true, eventCount: webhookData.events.length };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CONFIGURATION & STATUS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Get client-side configuration
   * GET /pusher/config
   *
   * Returns the configuration needed for Pusher client initialization.
   * Never expose the secret key!
   */
  @Get('config')
  getConfig() {
    return {
      key: this.pusherService.getAppKey(),
      cluster: this.pusherService.getCluster(),
      authEndpoint: '/pusher/auth',
    };
  }

  /**
   * Health check
   * GET /pusher/status
   */
  @Get('status')
  getStatus() {
    return {
      service: 'pusher',
      connected: this.pusherService.isConnected(),
      cluster: this.pusherService.getCluster(),
    };
  }
}
