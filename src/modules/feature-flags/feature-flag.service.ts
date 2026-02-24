import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FeatureFlag, FeatureFlagDocument, FlagType } from './feature-flag.entity';

export interface CreateFlagDto {
  key: string;
  name: string;
  description?: string;
  type?: FlagType;
  percentage?: number;
  userIds?: string[];
  category?: string;
}

export interface UpdateFlagDto {
  name?: string;
  description?: string;
  enabled?: boolean;
  type?: FlagType;
  percentage?: number;
  userIds?: string[];
  category?: string;
}

export interface EvaluateResult {
  key: string;
  enabled: boolean;
  reason: string;
}

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);

  constructor(
    @InjectModel(FeatureFlag.name)
    private readonly flagModel: Model<FeatureFlagDocument>,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────

  async findAll(): Promise<FeatureFlag[]> {
    return this.flagModel.find().sort({ category: 1, key: 1 }).lean().exec();
  }

  async findByKey(key: string): Promise<FeatureFlag> {
    const flag = await this.flagModel.findOne({ key }).lean().exec();
    if (!flag) throw new NotFoundException(`Feature flag "${key}" not found`);
    return flag;
  }

  async create(dto: CreateFlagDto): Promise<FeatureFlag> {
    const existing = await this.flagModel.findOne({ key: dto.key }).exec();
    if (existing) throw new ConflictException(`Feature flag "${dto.key}" already exists`);

    const flag = new this.flagModel({
      ...dto,
      key: dto.key.toLowerCase().replace(/\s+/g, '-'),
      enabled: false,
    });

    const saved = await flag.save();
    this.logger.log(`[FF] Created flag: ${dto.key}`);
    return saved.toObject();
  }

  async update(key: string, dto: UpdateFlagDto): Promise<FeatureFlag> {
    const flag = await this.flagModel
      .findOneAndUpdate({ key }, { $set: dto }, { new: true })
      .lean()
      .exec();

    if (!flag) throw new NotFoundException(`Feature flag "${key}" not found`);
    this.logger.log(`[FF] Updated flag: ${key}`);
    return flag;
  }

  async delete(key: string): Promise<void> {
    const result = await this.flagModel.deleteOne({ key }).exec();
    if (result.deletedCount === 0) throw new NotFoundException(`Feature flag "${key}" not found`);
    this.logger.log(`[FF] Deleted flag: ${key}`);
  }

  // ─── Toggle ──────────────────────────────────────────────────────────────

  async toggle(key: string): Promise<FeatureFlag> {
    const flag = await this.flagModel.findOne({ key }).exec();
    if (!flag) throw new NotFoundException(`Feature flag "${key}" not found`);

    flag.enabled = !flag.enabled;
    await flag.save();

    this.logger.log(`[FF] Toggled "${key}" → ${flag.enabled ? 'ENABLED' : 'DISABLED'}`);
    return flag.toObject();
  }

  async enable(key: string): Promise<FeatureFlag> {
    return this.update(key, { enabled: true });
  }

  async disable(key: string): Promise<FeatureFlag> {
    return this.update(key, { enabled: false });
  }

  // ─── Evaluation ──────────────────────────────────────────────────────────

  /**
   * Evaluate whether a flag is active for a given user.
   *
   * boolean    → just check flag.enabled
   * percentage → hash userId to get consistent 0-100 bucket, compare to percentage
   * users      → check if userId is in the allowed list
   */
  async evaluate(key: string, userId?: string): Promise<EvaluateResult> {
    let flag: FeatureFlag;
    try {
      flag = await this.findByKey(key);
    } catch {
      return { key, enabled: false, reason: 'flag_not_found' };
    }

    if (!flag.enabled) {
      return { key, enabled: false, reason: 'flag_disabled' };
    }

    switch (flag.type) {
      case 'boolean':
        return { key, enabled: true, reason: 'flag_enabled' };

      case 'percentage': {
        if (!userId) return { key, enabled: false, reason: 'no_user_id' };
        const bucket = this.hashUserToBucket(userId);
        const active = bucket <= flag.percentage;
        return {
          key,
          enabled: active,
          reason: active ? `in_percentage (bucket ${bucket})` : `out_of_percentage (bucket ${bucket})`,
        };
      }

      case 'users': {
        if (!userId) return { key, enabled: false, reason: 'no_user_id' };
        const active = flag.userIds.includes(userId);
        return {
          key,
          enabled: active,
          reason: active ? 'user_in_allowlist' : 'user_not_in_allowlist',
        };
      }

      default:
        return { key, enabled: false, reason: 'unknown_type' };
    }
  }

  /** Evaluate multiple flags at once — efficient for client bootstrap */
  async evaluateMany(keys: string[], userId?: string): Promise<Record<string, boolean>> {
    const results = await Promise.all(keys.map((k) => this.evaluate(k, userId)));
    return Object.fromEntries(results.map((r) => [r.key, r.enabled]));
  }

  /** Check if a flag is enabled (simple boolean, no user context) */
  async isEnabled(key: string): Promise<boolean> {
    const result = await this.evaluate(key);
    return result.enabled;
  }

  // ─── Seed defaults ───────────────────────────────────────────────────────

  async seedDefaults(): Promise<void> {
    const defaults: CreateFlagDto[] = [
      {
        key: 'new-dashboard',
        name: 'New Dashboard UI',
        description: 'Enable the redesigned dashboard with analytics widgets',
        type: 'boolean',
        category: 'ui',
      },
      {
        key: 'beta-export',
        name: 'Beta CSV Export',
        description: 'Allow exporting tasks and projects to CSV',
        type: 'percentage',
        percentage: 50,
        category: 'features',
      },
      {
        key: 'dark-mode',
        name: 'Dark Mode',
        description: 'Toggle dark mode across the application',
        type: 'boolean',
        category: 'ui',
      },
      {
        key: 'ai-suggestions',
        name: 'AI Task Suggestions',
        description: 'Show AI-powered task title and description suggestions',
        type: 'users',
        userIds: [],
        category: 'ai',
      },
      {
        key: 'maintenance-mode',
        name: 'Maintenance Mode',
        description: 'Show maintenance banner and disable write operations',
        type: 'boolean',
        category: 'ops',
      },
      {
        key: 'fund-pool-executor',
        name: 'Fund Pool Executor',
        description: 'Enable the BullMQ worker that automatically applies recurring amounts to fund pools',
        type: 'boolean',
        category: 'workers',
      },
    ];

    for (const flag of defaults) {
      const exists = await this.flagModel.findOne({ key: flag.key }).exec();
      if (!exists) {
        await this.create(flag);
        this.logger.log(`[FF] Seeded default flag: ${flag.key}`);
      }
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Deterministic hash: userId → 1..100 bucket.
   * Same user always falls in the same bucket for consistent rollout.
   */
  private hashUserToBucket(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i);
      hash |= 0;
    }
    return (Math.abs(hash) % 100) + 1;
  }
}
