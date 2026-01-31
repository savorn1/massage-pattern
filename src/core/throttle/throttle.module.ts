import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * Throttle Module - Rate Limiting
 *
 * Protects APIs from abuse with configurable rate limits.
 *
 * Default limits:
 * - Short: 10 requests per 1 second (burst protection)
 * - Medium: 100 requests per 10 seconds (normal usage)
 * - Long: 1000 requests per 1 minute (sustained usage)
 *
 * Environment variables:
 * - THROTTLE_SHORT_TTL (ms) - Short window duration
 * - THROTTLE_SHORT_LIMIT - Max requests in short window
 * - THROTTLE_MEDIUM_TTL (ms) - Medium window duration
 * - THROTTLE_MEDIUM_LIMIT - Max requests in medium window
 * - THROTTLE_LONG_TTL (ms) - Long window duration
 * - THROTTLE_LONG_LIMIT - Max requests in long window
 *
 * Usage:
 * - Global: All routes protected by default
 * - Skip: Use @SkipThrottle() decorator
 * - Custom: Use @Throttle({ default: { limit: 5, ttl: 60000 } })
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: configService.get<number>('THROTTLE_SHORT_TTL', 1000),
            limit: configService.get<number>('THROTTLE_SHORT_LIMIT', 10),
          },
          {
            name: 'medium',
            ttl: configService.get<number>('THROTTLE_MEDIUM_TTL', 10000),
            limit: configService.get<number>('THROTTLE_MEDIUM_LIMIT', 100),
          },
          {
            name: 'long',
            ttl: configService.get<number>('THROTTLE_LONG_TTL', 60000),
            limit: configService.get<number>('THROTTLE_LONG_LIMIT', 1000),
          },
        ],
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [ThrottlerModule],
})
export class ThrottleModule {}
