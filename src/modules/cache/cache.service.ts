import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;         // 0–100 %
  keyCount: number;
  isConnected: boolean;
}

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis;

  private stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      retryStrategy: (times) => Math.min(times * 50, 2000),
      lazyConnect: false,
    });

    this.client.on('connect', () => this.logger.log('[Cache] Redis connected'));
    this.client.on('error', (err) => this.logger.error('[Cache] Redis error:', err.message));
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  // ─── Core Cache Operations ────────────────────────────────────────────────

  /**
   * Get a value from cache. Returns null on miss.
   */
  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);

    if (raw === null) {
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  /**
   * Store a value in cache with an optional TTL (seconds).
   * Default TTL: 60 seconds.
   */
  async set(key: string, value: unknown, ttlSec = 60): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.client.set(key, serialized, 'EX', ttlSec);
    this.stats.sets++;
    this.logger.debug(`[Cache] SET ${key} (ttl: ${ttlSec}s)`);
  }

  /**
   * Delete a specific key.
   */
  async del(key: string): Promise<void> {
    await this.client.del(key);
    this.stats.deletes++;
    this.logger.debug(`[Cache] DEL ${key}`);
  }

  /**
   * Delete all keys matching a glob pattern.
   * e.g. delPattern('tasks:project:abc123:*')
   *
   * Uses SCAN instead of KEYS to avoid blocking Redis in production.
   */
  async delPattern(pattern: string): Promise<number> {
    const keys = await this.scanKeys(pattern);
    if (keys.length === 0) return 0;

    await this.client.del(...keys);
    this.stats.deletes += keys.length;
    this.logger.debug(`[Cache] DEL pattern "${pattern}" → ${keys.length} keys removed`);
    return keys.length;
  }

  /**
   * Cache-aside pattern helper.
   *
   * 1. Check cache — if hit, return immediately
   * 2. On miss — call factory() to fetch from DB
   * 3. Store result in cache with TTL
   * 4. Return result
   *
   * @example
   * const tasks = await this.cacheService.getOrSet(
   *   `tasks:project:${projectId}`,
   *   () => this.tasksService.getTasksByProject(projectId),
   *   120,
   * );
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSec = 60,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      this.logger.debug(`[Cache] HIT  ${key}`);
      return cached;
    }

    this.logger.debug(`[Cache] MISS ${key} → fetching from source`);
    const value = await factory();
    await this.set(key, value, ttlSec);
    return value;
  }

  /**
   * Check if a key exists in cache.
   */
  async has(key: string): Promise<boolean> {
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  /**
   * Get the remaining TTL of a key in seconds. Returns -1 if no TTL, -2 if missing.
   */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  /**
   * Clear all cache keys (use carefully — only for dev/test).
   */
  async flush(): Promise<void> {
    await this.client.flushdb();
    this.logger.warn('[Cache] FLUSHDB — all cache cleared');
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  async getStats(): Promise<CacheStats> {
    const keyCount = await this.client.dbsize();
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? Math.round((this.stats.hits / total) * 100) : 0;

    return {
      ...this.stats,
      hitRate,
      keyCount,
      isConnected: this.client.status === 'ready',
    };
  }

  resetStats(): void {
    this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
  }

  async listKeys(pattern = '*', limit = 50): Promise<{ key: string; ttl: number }[]> {
    const keys = (await this.scanKeys(pattern)).slice(0, limit);
    const results = await Promise.all(
      keys.map(async (key) => ({ key, ttl: await this.ttl(key) })),
    );
    return results.sort((a, b) => a.key.localeCompare(b.key));
  }

  isConnected(): boolean {
    return this.client?.status === 'ready';
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, batch] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    return keys;
  }
}
