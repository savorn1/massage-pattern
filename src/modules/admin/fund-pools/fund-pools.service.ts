import { BaseRepository } from '@/core/database/base/base.repository';
import { BusinessException } from '@/core/exceptions/business.exception';
import {
  FundPool,
  FundPoolDocument,
  FundPoolExecution,
  FundPoolExecutionDocument,
} from '@/modules/shared/entities';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateFundPoolDto } from './dto/create-fund-pool.dto';
import { UpdateFundPoolDto } from './dto/update-fund-pool.dto';

@Injectable()
export class FundPoolsService extends BaseRepository<FundPoolDocument> {
  private readonly logger = new Logger(FundPoolsService.name);

  constructor(
    @InjectModel(FundPool.name)
    private readonly fundPoolModel: Model<FundPoolDocument>,
    @InjectModel(FundPoolExecution.name)
    private readonly executionModel: Model<FundPoolExecutionDocument>,
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
    // Remove all execution history for this pool
    await this.executionModel.deleteMany({ poolId: id }).exec();
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
    return this.fundPoolModel.find({
      isEnabled: true,
      $or: [
        { lastExecutedAt: null },
        {
          $expr: {
            $lte: [
              { $add: ['$lastExecutedAt', { $multiply: ['$intervalMinutes', 60000] }] },
              now,
            ],
          },
        },
      ],
    }).exec();
  }

  /**
   * Atomically adds recurringAmount to currentAmount and stamps lastExecutedAt.
   * Also saves an execution record for the history log.
   */
  async applyRecurring(id: string): Promise<FundPoolDocument> {
    const updated = await this.fundPoolModel.findByIdAndUpdate(
      id,
      [
        {
          $set: {
            currentAmount: { $add: ['$currentAmount', '$recurringAmount'] },
            lastExecutedAt: new Date(),
          },
        },
      ],
      { new: true },
    );

    if (!updated) {
      throw BusinessException.resourceNotFound('FundPool', id);
    }

    // Record execution history
    await this.executionModel.create({
      poolId: id,
      amountAdded: updated.recurringAmount,
      balanceAfter: updated.currentAmount,
      executedAt: updated.lastExecutedAt,
    });

    this.logger.log(
      `FundPool "${updated.name}" executed: +${updated.recurringAmount} → ${updated.currentAmount}`,
    );
    return updated;
  }

  /**
   * Returns the most recent executions for a pool, newest first.
   */
  async getRecentExecutions(poolId: string, limit = 10): Promise<FundPoolExecutionDocument[]> {
    return this.executionModel
      .find()
      .find({ poolId: new Types.ObjectId(poolId) })
      .sort({ executedAt: -1 })
      .limit(limit)
      .exec();
  }
}
