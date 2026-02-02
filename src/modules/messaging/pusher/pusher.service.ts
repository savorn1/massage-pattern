import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import * as Pusher from 'pusher';

/**
 * Pusher channel types
 */
export type ChannelType = 'public' | 'private' | 'presence';

/**
 * Event result interface
 */
export interface TriggerResult {
  success: boolean;
  channelCount?: number;
}

/**
 * Presence channel member
 */
export interface PresenceMember {
  user_id: string;
  user_info?: Record<string, unknown>;
}

/**
 * Channel info response
 */
export interface ChannelInfo {
  occupied: boolean;
  user_count?: number;
  subscription_count?: number;
}

/**
 * Webhook event interface
 */
export interface WebhookEvent {
  name: string;
  channel?: string;
  user_id?: string;
  event?: string;
  data?: string;
  socket_id?: string;
}

/**
 * Webhook data interface
 */
export interface WebhookData {
  time_ms: number;
  events: WebhookEvent[];
}

/**
 * Pusher Service
 *
 * Provides server-side Pusher functionality:
 * - Trigger events on channels
 * - Batch trigger multiple events
 * - Authenticate private/presence channels
 * - Get channel information
 * - Get presence channel members
 *
 * Channel naming conventions:
 * - Public: "channel-name" (anyone can subscribe)
 * - Private: "private-channel-name" (requires auth)
 * - Presence: "presence-channel-name" (requires auth + tracks members)
 */
@Injectable()
export class PusherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PusherService.name);
  private pusher: Pusher;
  private isInitialized = false;

  onModuleInit() {
    this.initializePusher();
  }

  onModuleDestroy() {
    this.logger.log('Pusher service destroyed');
  }

  /**
   * Initialize Pusher client
   */
  private initializePusher(): void {
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.PUSHER_CLUSTER || 'mt1';

    if (!appId || !key || !secret) {
      this.logger.warn(
        'Pusher credentials not configured. Set PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET environment variables.',
      );
      return;
    }

    this.pusher = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    });

    this.isInitialized = true;
    this.logger.log(`Pusher initialized (cluster: ${cluster})`);
  }

  /**
   * Check if Pusher is configured and ready
   */
  isConnected(): boolean {
    return this.isInitialized;
  }

  /**
   * Get Pusher app key (for client-side)
   */
  getAppKey(): string | undefined {
    return process.env.PUSHER_KEY;
  }

  /**
   * Get Pusher cluster (for client-side)
   */
  getCluster(): string {
    return process.env.PUSHER_CLUSTER || 'mt1';
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TRIGGER EVENTS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Trigger an event on a channel
   *
   * @param channel - Channel name (e.g., "my-channel", "private-user-123")
   * @param event - Event name (e.g., "new-message")
   * @param data - Event payload
   * @param socketId - Optional socket ID to exclude from receiving the event
   */
  async trigger(
    channel: string,
    event: string,
    data: unknown,
    socketId?: string,
  ): Promise<TriggerResult> {
    this.ensureInitialized();

    try {
      const params = socketId ? { socket_id: socketId } : undefined;
      await this.pusher.trigger(channel, event, data, params);

      this.logger.debug(`Triggered "${event}" on channel "${channel}"`);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to trigger "${event}" on "${channel}"`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Trigger an event on multiple channels
   *
   * @param channels - Array of channel names (max 100)
   * @param event - Event name
   * @param data - Event payload
   */
  async triggerMultiple(
    channels: string[],
    event: string,
    data: unknown,
  ): Promise<TriggerResult> {
    this.ensureInitialized();

    if (channels.length > 100) {
      throw new Error('Maximum 100 channels per trigger');
    }

    try {
      await this.pusher.trigger(channels, event, data);

      this.logger.debug(`Triggered "${event}" on ${channels.length} channels`);
      return { success: true, channelCount: channels.length };
    } catch (error) {
      this.logger.error(
        `Failed to trigger "${event}" on multiple channels`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Trigger multiple events in a batch
   *
   * @param batch - Array of events to trigger
   */
  async triggerBatch(
    batch: Array<{
      channel: string;
      name: string;
      data: unknown;
    }>,
  ): Promise<TriggerResult> {
    this.ensureInitialized();

    if (batch.length > 10) {
      throw new Error('Maximum 10 events per batch');
    }

    try {
      await this.pusher.triggerBatch(batch);

      this.logger.debug(`Triggered batch of ${batch.length} events`);
      return { success: true };
    } catch (error) {
      this.logger.error(
        'Failed to trigger batch',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CHANNEL AUTHENTICATION
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Authenticate a private channel subscription
   *
   * @param socketId - The socket ID from the client
   * @param channel - The private channel name (must start with "private-")
   */
  authenticatePrivateChannel(
    socketId: string,
    channel: string,
  ): Pusher.AuthResponse {
    this.ensureInitialized();

    if (!channel.startsWith('private-')) {
      throw new Error('Private channel must start with "private-"');
    }

    const auth = this.pusher.authorizeChannel(socketId, channel);
    this.logger.debug(`Authenticated private channel: ${channel}`);
    return auth;
  }

  /**
   * Authenticate a presence channel subscription
   *
   * @param socketId - The socket ID from the client
   * @param channel - The presence channel name (must start with "presence-")
   * @param userId - Unique user identifier
   * @param userInfo - Optional user information to share with other members
   */
  authenticatePresenceChannel(
    socketId: string,
    channel: string,
    userId: string,
    userInfo?: Record<string, unknown>,
  ): Pusher.AuthResponse {
    this.ensureInitialized();

    if (!channel.startsWith('presence-')) {
      throw new Error('Presence channel must start with "presence-"');
    }

    const presenceData: Pusher.PresenceChannelData = {
      user_id: userId,
      user_info: userInfo,
    };

    const auth = this.pusher.authorizeChannel(socketId, channel, presenceData);
    this.logger.debug(
      `Authenticated presence channel: ${channel} for user: ${userId}`,
    );
    return auth;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CHANNEL INFORMATION
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Get information about a channel
   *
   * @param channel - Channel name
   * @param options - Query options
   */
  async getChannelInfo(
    channel: string,
    options?: { info?: string[] },
  ): Promise<ChannelInfo> {
    this.ensureInitialized();

    try {
      const params: Record<string, string> = {};
      if (options?.info) {
        params.info = options.info.join(',');
      }

      const response = await this.pusher.get({
        path: `/channels/${channel}`,
        params,
      });

      const body = (await response.json()) as ChannelInfo;
      return body;
    } catch (error) {
      this.logger.error(
        `Failed to get channel info for "${channel}"`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Get list of channels
   *
   * @param options - Filter options
   */
  async getChannels(options?: {
    prefix?: string;
    info?: string[];
  }): Promise<Record<string, ChannelInfo>> {
    this.ensureInitialized();

    try {
      const params: Record<string, string> = {};
      if (options?.prefix) {
        params.filter_by_prefix = options.prefix;
      }
      if (options?.info) {
        params.info = options.info.join(',');
      }

      const response = await this.pusher.get({
        path: '/channels',
        params,
      });

      const body = (await response.json()) as {
        channels: Record<string, ChannelInfo>;
      };
      return body.channels;
    } catch (error) {
      this.logger.error(
        'Failed to get channels',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Get users in a presence channel
   *
   * @param channel - Presence channel name
   */
  async getPresenceUsers(channel: string): Promise<PresenceMember[]> {
    this.ensureInitialized();

    if (!channel.startsWith('presence-')) {
      throw new Error('Channel must be a presence channel');
    }

    try {
      const response = await this.pusher.get({
        path: `/channels/${channel}/users`,
      });

      const body = (await response.json()) as { users: PresenceMember[] };
      return body.users;
    } catch (error) {
      this.logger.error(
        `Failed to get users for channel "${channel}"`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // WEBHOOKS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Validate webhook signature
   *
   * @param body - Raw request body
   * @param signature - X-Pusher-Signature header
   */
  validateWebhook(body: string, signature: string): boolean {
    this.ensureInitialized();

    try {
      const webhook = this.pusher.webhook({
        headers: { 'x-pusher-signature': signature },
        rawBody: body,
      });

      return webhook.isValid();
    } catch {
      return false;
    }
  }

  /**
   * Parse webhook events
   *
   * @param body - Raw request body
   * @param signature - X-Pusher-Signature header
   */
  parseWebhook(body: string, signature: string): WebhookData | null {
    this.ensureInitialized();

    const webhook = this.pusher.webhook({
      headers: { 'x-pusher-signature': signature },
      rawBody: body,
    });

    if (!webhook.isValid()) {
      this.logger.warn('Invalid webhook signature');
      return null;
    }

    return webhook.getData() as unknown as WebhookData;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Ensure Pusher is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(
        'Pusher is not configured. Set PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET environment variables.',
      );
    }
  }

  /**
   * Build a private channel name
   */
  buildPrivateChannel(name: string): string {
    return `private-${name}`;
  }

  /**
   * Build a presence channel name
   */
  buildPresenceChannel(name: string): string {
    return `presence-${name}`;
  }

  /**
   * Get channel type from name
   */
  getChannelType(channel: string): ChannelType {
    if (channel.startsWith('presence-')) return 'presence';
    if (channel.startsWith('private-')) return 'private';
    return 'public';
  }
}
