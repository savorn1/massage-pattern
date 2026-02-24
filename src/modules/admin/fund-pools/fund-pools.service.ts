import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FundPool, FundPoolDocument } from '@/modules/shared/entities';
import { CreateFundPoolDto } from './dto/create-fund-pool.dto';
import { UpdateFundPoolDto } from './dto/update-fund-pool.dto';
import { BaseRepository } from '@/core/database/base/base.repository';
import { BusinessException } from '@/core/exceptions/business.exception';

@Injectable()
export class FundPoolsService extends BaseRepository<FundPoolDocument> {
  private readonly logger = new Logger(FundPoolsService.name);

  constructor(
    @InjectModel(FundPool.name)
    private readonly fundPoolModel: Model<FundPoolDocument>,
  ) {
    super(fundPoolModel);
  }

  async createFundPool(dto: CreateFundPoolDto): Promise<FundPoolDocument> {
    const existing = await this.findOne({ name: dto.name });
    if (existing) {
      throw BusinessException.duplicateResource('FundPool', 'name');
    }

    const pool = await this.create({
      ...dto,
      isEnabled: dto.isEnabled ?? true,
      lastExecutedAt: dto.lastExecutedAt ?? null,
    } as Partial<FundPoolDocument>);

    this.logger.log(`FundPool created: ${pool.name}`);
    return pool;
  }

  async findFundPoolById(id: string): Promise<FundPoolDocument> {
    const pool = await this.findById(id);
    if (!pool) {
      throw BusinessException.resourceNotFound('FundPool', id);
    }
    return pool;
  }

  async updateFundPool(id: string, dto: UpdateFundPoolDto): Promise<FundPoolDocument> {
    const pool = await this.findById(id);
    if (!pool) {
      throw BusinessException.resourceNotFound('FundPool', id);
    }

    if (dto.name && dto.name !== pool.name) {
      const existing = await this.findOne({ name: dto.name });
      if (existing) {
        throw BusinessException.duplicateResource('FundPool', 'name');
      }
    }

    const updated = await this.update(id, dto);
    if (!updated) {
      throw BusinessException.resourceNotFound('FundPool', id);
    }

    this.logger.log(`FundPool updated: ${id}`);
    return updated;
  }

  async deleteFundPool(id: string): Promise<void> {
    const pool = await this.findById(id);
    if (!pool) {
      throw BusinessException.resourceNotFound('FundPool', id);
    }

    await this.delete(id);
    this.logger.log(`FundPool deleted: ${id}`);
  }

  async getAllFundPools(skip = 0, limit = 50) {
    return this.findWithPagination({}, { skip, limit }, { createdAt: -1 });
  }

  async toggleEnabled(id: string): Promise<FundPoolDocument> {
    const pool = await this.findFundPoolById(id);
    const updated = await this.update(id, { isEnabled: !pool.isEnabled } as Partial<FundPoolDocument>);
    if (!updated) {
      throw BusinessException.resourceNotFound('FundPool', id);
    }
    this.logger.log(`FundPool ${id} toggled to ${updated.isEnabled}`);
    return updated;
  }

  async recordExecution(id: string): Promise<FundPoolDocument> {
    const updated = await this.update(id, { lastExecutedAt: new Date() } as Partial<FundPoolDocument>);
    if (!updated) {
      throw BusinessException.resourceNotFound('FundPool', id);
    }
    return updated;
  }

  /**
   * Returns all enabled pools whose next execution time has been reached.
   * A pool is due when: now >= lastExecutedAt + intervalMinutes, or never executed.
   */
  async getDuePools(): Promise<FundPoolDocument[]> {
    const now = new Date();
    const allEnabled = await this.findAll({ isEnabled: true });

    return allEnabled.filter((pool) => {
      if (!pool.lastExecutedAt) return true;
      const nextRun = new Date(pool.lastExecutedAt.getTime() + pool.intervalMinutes * 60_000);
      return now >= nextRun;
    });
  }

  /**
   * Atomically adds recurringAmount to currentAmount and stamps lastExecutedAt.
   */
  async applyRecurring(id: string): Promise<FundPoolDocument> {
    const pool = await this.findById(id);
    if (!pool) {
      throw BusinessException.resourceNotFound('FundPool', id);
    }

    const updated = await this.fundPoolModel.findByIdAndUpdate(
      id,
      {
        $inc: { currentAmount: pool.recurringAmount },
        $set: { lastExecutedAt: new Date() },
      },
      { new: true },
    );

    if (!updated) {
      throw BusinessException.resourceNotFound('FundPool', id);
    }

    this.logger.log(
      `FundPool "${updated.name}" executed: +${pool.recurringAmount} → ${updated.currentAmount}`,
    );
    return updated;
  }
}
