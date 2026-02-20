import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheController } from './cache.controller';

/**
 * CacheModule — globally available Redis cache.
 *
 * Marked @Global() so any module can inject CacheService
 * without explicitly importing CacheModule.
 *
 * Usage in any service:
 *   constructor(private readonly cacheService: CacheService) {}
 *
 *   // Cache-aside pattern:
 *   const data = await this.cacheService.getOrSet(
 *     `tasks:project:${projectId}`,
 *     () => this.db.findTasks(projectId),
 *     60,   // TTL in seconds
 *   );
 *
 *   // Invalidate on mutation:
 *   await this.cacheService.delPattern(`tasks:project:${projectId}:*`);
 */
@Global()
@Module({
  controllers: [CacheController],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
