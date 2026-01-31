import {
  Controller,
  Post,
  Get,
  Body,
  Sse,
  MessageEvent,
  Param,
  Query,
} from '@nestjs/common';
import { RedisPubsubService } from './redis-pubsub.service';
import { PublishDto, SubscribeDto } from './dto/publish.dto';
import { Observable, fromEvent } from 'rxjs';
import { map } from 'rxjs/operators';
import { EventEmitter } from 'events';

@Controller('redis-pubsub')
export class RedisPubsubController {
  private eventEmitter = new EventEmitter();

  constructor(private readonly redisPubsubService: RedisPubsubService) {
    // Set up event emitter to forward Redis messages
    void this.setupEventForwarding();
  }

  private async setupEventForwarding(): Promise<void> {
    // This will be called when clients subscribe via SSE
  }

  @Get()
  getInfo() {
    return {
      pattern: 'Redis Pub/Sub',
      description: 'Publisher/Subscriber architecture for horizontal scaling',
      status: this.redisPubsubService.isConnected()
        ? 'connected'
        : 'disconnected',
      subscribedChannels: this.redisPubsubService.getSubscribedChannels(),
      endpoints: {
        publish: 'POST /redis-pubsub/publish',
        subscribe: 'POST /redis-pubsub/subscribe',
        unsubscribe: 'POST /redis-pubsub/unsubscribe/:channel',
        stream: 'GET /redis-pubsub/stream?channel=xxx (SSE)',
        status: 'GET /redis-pubsub/status',
      },
      examples: {
        publish: {
          method: 'POST',
          url: '/redis-pubsub/publish',
          body: { channel: 'news', message: 'Hello Redis!' },
        },
        subscribe: {
          method: 'POST',
          url: '/redis-pubsub/subscribe',
          body: { channel: 'news' },
        },
        stream: {
          method: 'GET',
          url: '/redis-pubsub/stream?channel=news',
          description: 'Server-Sent Events (SSE) stream',
        },
      },
      practiceTasks: [
        '1. Publish messages to different channels',
        '2. Subscribe to multiple channels',
        '3. Test with Redis CLI: redis-cli PUBLISH news "Hello"',
        '4. Run multiple server instances (horizontal scaling)',
        '5. Monitor with Redis CLI: redis-cli SUBSCRIBE news',
      ],
    };
  }

  @Post('publish')
  async publish(@Body() publishDto: PublishDto) {
    const subscriberCount = await this.redisPubsubService.publish(
      publishDto.channel,
      publishDto.message,
    );

    // Also emit to local SSE connections
    this.eventEmitter.emit(publishDto.channel, publishDto.message);

    return {
      success: true,
      channel: publishDto.channel,
      message: publishDto.message,
      subscriberCount,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('subscribe')
  async subscribe(@Body() subscribeDto: SubscribeDto) {
    await this.redisPubsubService.subscribe(subscribeDto.channel, (message) => {
      // Forward to SSE clients
      this.eventEmitter.emit(subscribeDto.channel, message);
    });

    return {
      success: true,
      channel: subscribeDto.channel,
      message: `Subscribed to channel: ${subscribeDto.channel}`,
      subscriberCount: this.redisPubsubService.getSubscriberCount(
        subscribeDto.channel,
      ),
    };
  }

  @Post('unsubscribe/:channel')
  async unsubscribe(@Param('channel') channel: string) {
    await this.redisPubsubService.unsubscribe(channel);

    return {
      success: true,
      channel,
      message: `Unsubscribed from channel: ${channel}`,
    };
  }

  @Get('status')
  getStatus() {
    const channels = this.redisPubsubService.getSubscribedChannels();
    const channelSubscribers = channels.reduce((acc, channel) => {
      acc[channel] = this.redisPubsubService.getSubscriberCount(channel);
      return acc;
    }, {});

    return {
      connected: this.redisPubsubService.isConnected(),
      subscribedChannels: channels,
      channelSubscribers,
    };
  }

  @Sse('stream')
  stream(@Query('channel') channel: string): Observable<MessageEvent> {
    if (!channel) {
      throw new Error('Channel is required');
    }

    // Subscribe to Redis channel if not already subscribed
    void this.redisPubsubService.subscribe(channel, (message) => {
      this.eventEmitter.emit(channel, message);
    });

    // Create SSE stream from event emitter
    return fromEvent(this.eventEmitter, channel).pipe(
      map((data: unknown) => ({
        data: JSON.stringify({
          channel,
          message: data,
          timestamp: new Date().toISOString(),
        }),
      })),
    );
  }
}
