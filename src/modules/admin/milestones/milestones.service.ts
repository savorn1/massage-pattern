import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Milestone, MilestoneDocument, MilestoneStatus } from '@/modules/shared/entities';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { BaseRepository } from '@/core/database/base/base.repository';
import { BusinessException } from '@/core/exceptions/business.exception';

/**
 * Service for managing milestones
 */
@Injectable()
export class MilestonesService extends BaseRepository<MilestoneDocument> {
  private readonly logger = new Logger(MilestonesService.name);

  constructor(
    @InjectModel(Milestone.name)
    private readonly milestoneModel: Model<MilestoneDocument>,
  ) {
    super(milestoneModel);
  }

  /**
   * Create a new milestone
   */
  async createMilestone(
    createMilestoneDto: CreateMilestoneDto,
    userId: string,
  ): Promise<MilestoneDocument> {
    const milestoneData = {
      ...createMilestoneDto,
      projectId: new Types.ObjectId(createMilestoneDto.projectId),
      createdBy: userId,
      dueDate: new Date(createMilestoneDto.dueDate),
    };

    const milestone = await this.create(milestoneData);
    this.logger.log(`Milestone created: ${milestone.name} by user ${userId}`);
    return milestone;
  }

  /**
   * Update milestone
   */
  async updateMilestone(
    id: string,
    updateMilestoneDto: UpdateMilestoneDto,
  ): Promise<MilestoneDocument | null> {
    const updateData: Record<string, unknown> = { ...updateMilestoneDto };

    // Auto-set completedAt when status changes to completed
    if (
      updateMilestoneDto.status === MilestoneStatus.COMPLETED &&
      !updateMilestoneDto.completedAt
    ) {
      updateData.completedAt = new Date();
      updateData.progress = 100;
    }

    const milestone = await this.update(id, updateData);
    if (!milestone) {
      throw BusinessException.resourceNotFound('Milestone', id);
    }

    this.logger.log(`Milestone updated: ${id}`);
    return milestone;
  }

  /**
   * Soft delete milestone
   */
  async deleteMilestone(
    id: string,
    userId?: string,
  ): Promise<MilestoneDocument | null> {
    const milestone = await this.softDelete(id, userId);
    if (!milestone) {
      throw BusinessException.resourceNotFound('Milestone', id);
    }

    this.logger.log(`Milestone deleted: ${id}`);
    return milestone;
  }

  /**
   * Get milestones by project
   */
  async getMilestonesByProject(projectId: string, skip = 0, limit = 10) {
    return this.findWithPagination(
      { projectId: new Types.ObjectId(projectId), isDeleted: false },
      { skip, limit },
      { dueDate: 1 },
    );
  }

  /**
   * Get upcoming milestones
   */
  async getUpcomingMilestones(projectId: string, skip = 0, limit = 10) {
    return this.findWithPagination(
      {
        projectId: new Types.ObjectId(projectId),
        status: { $ne: MilestoneStatus.COMPLETED },
        dueDate: { $gte: new Date() },
        isDeleted: false,
      },
      { skip, limit },
      { dueDate: 1 },
    );
  }

  /**
   * Get overdue milestones
   */
  async getOverdueMilestones(projectId: string, skip = 0, limit = 10) {
    return this.findWithPagination(
      {
        projectId: new Types.ObjectId(projectId),
        status: { $ne: MilestoneStatus.COMPLETED },
        dueDate: { $lt: new Date() },
        isDeleted: false,
      },
      { skip, limit },
      { dueDate: 1 },
    );
  }

  /**
   * Update milestone progress
   */
  async updateProgress(
    milestoneId: string,
    progress: number,
  ): Promise<MilestoneDocument | null> {
    const updateData: Record<string, unknown> = { progress };

    if (progress >= 100) {
      updateData.status = MilestoneStatus.COMPLETED;
      updateData.completedAt = new Date();
      updateData.progress = 100;
    } else if (progress > 0) {
      updateData.status = MilestoneStatus.IN_PROGRESS;
    }

    const milestone = await this.update(milestoneId, updateData);
    if (!milestone) {
      throw BusinessException.resourceNotFound('Milestone', milestoneId);
    }

    this.logger.log(`Milestone ${milestoneId} progress updated to ${progress}%`);
    return milestone;
  }
}
