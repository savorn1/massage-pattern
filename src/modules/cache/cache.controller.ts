import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CacheService } from './cache.service';

/**
 * CacheController — demo endpoints that teach the cache-aside pattern.
 *
 * The /cache/demo/* endpoints simulate an expensive DB call (artificial delay)
 * vs a cached version, so you can see the latency difference in the frontend.
 */
@ApiTags('Cache')
@Controller('cache')
export class CacheController {
  constructor(private readonly cacheService: CacheService) {}

  // ─── Stats & inspection ───────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Cache hit/miss stats and key count' })
  async stats() {
    return this.cacheService.getStats();
  }

  @Get('keys')
  @ApiOperation({ summary: 'List cached keys (pattern filter optional)' })
  async keys(@Query('pattern') pattern = '*', @Query('limit') limit = '50') {
    return {
      keys: await this.cacheService.listKeys(pattern, parseInt(limit, 10)),
    };
  }

  @Post('stats/reset')
  @ApiOperation({ summary: 'Reset hit/miss counters' })
  resetStats() {
    this.cacheService.resetStats();
    return { success: true };
  }

  // ─── Manual operations (for learning / testing) ───────────────────────────

  @Get('get/:key')
  @ApiOperation({ summary: 'Get a value from cache by key' })
  async get(@Param('key') key: string) {
    const value = await this.cacheService.get(key);
    const ttl = await this.cacheService.ttl(key);
    return { key, value, ttl, hit: value !== null };
  }

  @Post('set')
  @ApiOperation({ summary: 'Store a value in cache' })
  async set(@Body() body: { key: string; value: unknown; ttl?: number }) {
    await this.cacheService.set(body.key, body.value, body.ttl ?? 60);
    return { success: true, key: body.key, ttl: body.ttl ?? 60 };
  }

  @Delete('key/:key')
  @ApiOperation({ summary: 'Delete a specific cache key' })
  async del(@Param('key') key: string) {
    await this.cacheService.del(key);
    return { success: true, deleted: key };
  }

  @Delete('pattern')
  @ApiOperation({ summary: 'Delete all keys matching a glob pattern' })
  async delPattern(@Body() body: { pattern: string }) {
    const count = await this.cacheService.delPattern(body.pattern);
    return { success: true, pattern: body.pattern, deletedCount: count };
  }

  @Delete('flush')
  @ApiOperation({ summary: 'Clear entire cache (dev only)' })
  async flush() {
    await this.cacheService.flush();
    return { success: true, message: 'Cache flushed' };
  }

  // ─── Cache-aside demo ─────────────────────────────────────────────────────

  /**
   * Demo: Simulate a slow DB query (artificial 800ms delay).
   * First call → MISS → waits 800ms → stores result in cache
   * Subsequent calls → HIT → returns instantly from Redis
   */
  @Get('demo/slow-query')
  @ApiOperation({ summary: 'Demo: cache-aside — slow DB query vs cache hit' })
  async demoSlowQuery(@Query('key') key = 'demo:slow-query') {
    const start = Date.now();
    let source: 'cache' | 'database' = 'cache';

    const data = await this.cacheService.getOrSet(
      key,
      async () => {
        // Simulate expensive DB query
        source = 'database';
        await this.delay(800);
        return {
          result: 'Project task statistics',
          totalTasks: Math.floor(Math.random() * 200) + 50,
          completedTasks: Math.floor(Math.random() * 100),
          overdueTasks: Math.floor(Math.random() * 20),
          generatedAt: new Date().toISOString(),
        };
      },
      30, // TTL: 30 seconds
    );

    return {
      data,
      source,
      latencyMs: Date.now() - start,
      cachedKey: key,
      ttl: await this.cacheService.ttl(key),
    };
  }

  /**
   * Demo: Write-through — simulate updating a task and invalidating its cache.
   */
  @Post('demo/invalidate')
  @ApiOperation({ summary: 'Demo: invalidate cache after a mutation' })
  async demoInvalidate(@Body() body: { pattern?: string }) {
    const pattern = body.pattern || 'demo:*';
    const deleted = await this.cacheService.delPattern(pattern);
    return {
      success: true,
      pattern,
      deletedCount: deleted,
      message: `Invalidated ${deleted} cache key(s) matching "${pattern}"`,
    };
  }

  /**
   * Demo: Warm up cache — pre-populate before traffic arrives.
   */
  @Post('demo/warmup')
  @ApiOperation({ summary: 'Demo: cache warm-up (pre-populate before traffic)' })
  async demoWarmup() {
    const keys = [
      { key: 'demo:projects:active', value: { count: 12, items: ['Alpha', 'Beta', 'Gamma'] }, ttl: 120 },
      { key: 'demo:tasks:overdue', value: { count: 5, taskIds: ['T-001', 'T-042', 'T-077'] }, ttl: 60 },
      { key: 'demo:users:online', value: { count: 3, users: ['alice', 'bob', 'charlie'] }, ttl: 30 },
    ];

    for (const item of keys) {
      await this.cacheService.set(item.key, item.value, item.ttl);
    }

    return {
      success: true,
      message: `Warmed up ${keys.length} cache keys`,
      keys: keys.map((k) => k.key),
    };
  }

  // ─── Helper ───────────────────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
