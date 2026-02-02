import { Module } from '@nestjs/common';
import { PusherService } from './pusher.service';
import { PusherController } from './pusher.controller';

/**
 * Pusher Module
 *
 * Provides Pusher integration for real-time messaging:
 *
 * Features:
 * - Trigger events on public/private/presence channels
 * - Batch event triggering
 * - Channel authentication for private/presence channels
 * - Channel information queries
 * - Webhook handling
 *
 * Configuration (environment variables):
 * - PUSHER_APP_ID: Your Pusher app ID
 * - PUSHER_KEY: Your Pusher app key
 * - PUSHER_SECRET: Your Pusher app secret
 * - PUSHER_CLUSTER: Pusher cluster (default: mt1)
 *
 * Usage:
 * 1. Import PusherModule in your feature module
 * 2. Inject PusherService where needed
 * 3. Use service methods to trigger events
 *
 * @example
 * // In a service
 * constructor(private pusherService: PusherService) {}
 *
 * async notifyUser(userId: string, message: string) {
 *   await this.pusherService.trigger(
 *     `private-user-${userId}`,
 *     'notification',
 *     { message }
 *   );
 * }
 */
@Module({
  controllers: [PusherController],
  providers: [PusherService],
  exports: [PusherService],
})
export class PusherModule {}
