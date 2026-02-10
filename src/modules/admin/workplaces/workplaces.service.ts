import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Workplace,
  WorkplaceDocument,
  WorkplaceMember,
  WorkplaceMemberDocument,
  WorkplaceMemberRole,
  Project,
  ProjectDocument,
} from '@/modules/shared/entities';
import { CreateWorkplaceDto } from './dto/create-workplace.dto';
import { UpdateWorkplaceDto } from './dto/update-workplace.dto';
import { BaseRepository } from '@/core/database/base/base.repository';
import { BusinessException } from '@/core/exceptions/business.exception';

/**
 * Service for managing workplaces
 */
@Injectable()
export class WorkplacesService extends BaseRepository<WorkplaceDocument> {
  private readonly logger = new Logger(WorkplacesService.name);

  constructor(
    @InjectModel(Workplace.name)
    private readonly workplaceModel: Model<WorkplaceDocument>,
    @InjectModel(WorkplaceMember.name)
    private readonly workplaceMemberModel: Model<WorkplaceMemberDocument>,
    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,
  ) {
    super(workplaceModel);
  }

  /**
   * Create a new workplace
   */
  async createWorkplace(
    createWorkplaceDto: CreateWorkplaceDto,
    userId: string,
  ): Promise<WorkplaceDocument> {
    // Check if slug is already taken
    const existingWorkplace = await this.findOne({ slug: createWorkplaceDto.slug });
    if (existingWorkplace) {
      throw BusinessException.duplicateResource('Workplace', 'slug');
    }

    const workplaceData: Partial<Workplace> = {
      ...createWorkplaceDto,
      ownerId: new Types.ObjectId(userId),
    };

    const workplace = await this.create(workplaceData as Partial<WorkplaceDocument>);

    // Automatically add the creator as an owner member
    await this.workplaceMemberModel.create({
      workplaceId: workplace._id,
      userId: new Types.ObjectId(userId),
      role: WorkplaceMemberRole.OWNER,
    });

    this.logger.log(`Workplace created: ${workplace.name} by user ${userId}`);
    return workplace;
  }

  /**
   * Find workplace by ID
   */
  async findWorkplaceById(id: string): Promise<WorkplaceDocument> {
    const workplace = await this.findById(id);
    if (!workplace) {
      throw BusinessException.resourceNotFound('Workplace', id);
    }
    return workplace;
  }

  /**
   * Find workplace by slug
   */
  async findWorkplaceBySlug(slug: string): Promise<WorkplaceDocument> {
    const workplace = await this.findOne({ slug });
    if (!workplace) {
      throw BusinessException.resourceNotFound('Workplace', slug);
    }
    return workplace;
  }

  /**
   * Update workplace
   */
  async updateWorkplace(
    id: string,
    updateWorkplaceDto: UpdateWorkplaceDto,
  ): Promise<WorkplaceDocument> {
    const workplace = await this.update(id, updateWorkplaceDto);
    if (!workplace) {
      throw BusinessException.resourceNotFound('Workplace', id);
    }

    this.logger.log(`Workplace updated: ${id}`);
    return workplace;
  }

  /**
   * Delete workplace (soft delete by archiving)
   */
  async deleteWorkplace(id: string): Promise<WorkplaceDocument> {
    const workplace = await this.update(id, {
      status: 'archived',
    });
    if (!workplace) {
      throw BusinessException.resourceNotFound('Workplace', id);
    }

    this.logger.log(`Workplace archived: ${id}`);
    return workplace;
  }

  /**
   * Hard delete workplace and all associated members
   */
  async hardDeleteWorkplace(id: string): Promise<void> {
    const workplace = await this.findById(id);
    if (!workplace) {
      throw BusinessException.resourceNotFound('Workplace', id);
    }

    // Delete all workplace members
    await this.workplaceMemberModel.deleteMany({
      workplaceId: new Types.ObjectId(id),
    });

    // Delete the workplace
    await this.delete(id);

    this.logger.log(`Workplace permanently deleted: ${id}`);
  }

  /**
   * Get workplaces owned by a user
   */
  async getWorkplacesByOwner(ownerId: string, skip = 0, limit = 10) {
    return this.findWithPagination(
      { ownerId: new Types.ObjectId(ownerId), status: 'active' },
      { skip, limit },
      { createdAt: -1 },
    );
  }

  /**
   * Get workplaces where user is a member
   */
  async getWorkplacesByMember(userId: string, skip = 0, limit = 10) {
    // Find all workplace memberships for the user
    const memberships = await this.workplaceMemberModel
      .find({ userId: new Types.ObjectId(userId) })
      .select('workplaceId')
      .exec();

    const workplaceIds = memberships.map((m) => m.workplaceId);

    return this.findWithPagination(
      { _id: { $in: workplaceIds }, status: 'active' },
      { skip, limit },
      { createdAt: -1 },
    );
  }

  /**
   * Get all active workplaces with pagination
   */
  async getActiveWorkplaces(skip = 0, limit = 10) {
    return this.findWithPagination(
      { status: 'active' },
      { skip, limit },
      { createdAt: -1 },
    );
  }

  /**
   * Check if user has access to workplace
   */
  async hasAccess(workplaceId: string, userId: string): Promise<boolean> {
    const membership = await this.workplaceMemberModel.findOne({
      workplaceId: new Types.ObjectId(workplaceId),
      userId: new Types.ObjectId(userId),
    });
    return !!membership;
  }

  /**
   * Check if user is owner or admin of workplace
   */
  async isAdminOrOwner(workplaceId: string, userId: string): Promise<boolean> {
    const membership = await this.workplaceMemberModel.findOne({
      workplaceId: new Types.ObjectId(workplaceId),
      userId: new Types.ObjectId(userId),
      role: { $in: [WorkplaceMemberRole.OWNER, WorkplaceMemberRole.ADMIN] },
    });
    return !!membership;
  }

  /**
   * Transfer workplace ownership
   */
  async transferOwnership(
    workplaceId: string,
    newOwnerId: string,
    currentOwnerId: string,
  ): Promise<WorkplaceDocument> {
    // Verify current owner
    const workplace = await this.findById(workplaceId);
    if (!workplace) {
      throw BusinessException.resourceNotFound('Workplace', workplaceId);
    }

    if (workplace.ownerId.toString() !== currentOwnerId) {
      throw BusinessException.invalidOperation(
        'Only the current owner can transfer ownership',
      );
    }

    // Update workplace owner
    const updatedWorkplace = await this.update(workplaceId, {
      ownerId: new Types.ObjectId(newOwnerId),
    });

    // Update member roles
    await this.workplaceMemberModel.updateOne(
      {
        workplaceId: new Types.ObjectId(workplaceId),
        userId: new Types.ObjectId(currentOwnerId),
      },
      { role: WorkplaceMemberRole.ADMIN },
    );

    await this.workplaceMemberModel.updateOne(
      {
        workplaceId: new Types.ObjectId(workplaceId),
        userId: new Types.ObjectId(newOwnerId),
      },
      { role: WorkplaceMemberRole.OWNER },
      { upsert: true },
    );

    this.logger.log(
      `Workplace ${workplaceId} ownership transferred from ${currentOwnerId} to ${newOwnerId}`,
    );
    return updatedWorkplace!;
  }

  /**
   * Get project and member counts for given workplace IDs
   */
  async getWorkplaceStats(
    workplaceIds: string[],
  ): Promise<Record<string, { projectCount: number; memberCount: number }>> {
    const ids = workplaceIds.map((id) => new Types.ObjectId(id));

    const [projectCounts, memberCounts] = await Promise.all([
      this.projectModel.aggregate([
        { $match: { workplaceId: { $in: ids }, status: 'active' } },
        { $group: { _id: '$workplaceId', count: { $sum: 1 } } },
      ]),
      this.workplaceMemberModel.aggregate([
        { $match: { workplaceId: { $in: ids } } },
        { $group: { _id: '$workplaceId', count: { $sum: 1 } } },
      ]),
    ]);

    const stats: Record<string, { projectCount: number; memberCount: number }> = {};
    for (const id of workplaceIds) {
      stats[id] = { projectCount: 0, memberCount: 0 };
    }
    for (const p of projectCounts) {
      const key = p._id.toString();
      if (stats[key]) stats[key].projectCount = p.count;
    }
    for (const m of memberCounts) {
      const key = m._id.toString();
      if (stats[key]) stats[key].memberCount = m.count;
    }

    return stats;
  }
}
