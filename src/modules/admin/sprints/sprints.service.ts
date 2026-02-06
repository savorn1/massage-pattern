import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Sprint,
  SprintDocument,
  SprintStatus,
  Project,
  ProjectDocument,
} from '@/modules/shared/entities';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { BaseRepository } from '@/core/database/base/base.repository';
import { BusinessException } from '@/core/exceptions/business.exception';

/**
 * Service for managing sprints within projects
 */
@Injectable()
export class SprintsService extends BaseRepository<SprintDocument> {
  private readonly logger = new Logger(SprintsService.name);

  constructor(
    @InjectModel(Sprint.name)
    private readonly sprintModel: Model<SprintDocument>,
    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,
  ) {
    super(sprintModel);
  }

  /**
   * Create a new sprint for a project
   */
  async createSprint(
    projectId: string,
    createSprintDto: CreateSprintDto,
  ): Promise<SprintDocument> {
    // Verify project exists
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw BusinessException.resourceNotFound('Project', projectId);
    }

    // Validate dates if provided
    if (createSprintDto.startDate && createSprintDto.endDate) {
      const startDate = new Date(createSprintDto.startDate);
      const endDate = new Date(createSprintDto.endDate);
      if (endDate <= startDate) {
        throw BusinessException.invalidOperation(
          'End date must be after start date',
        );
      }
    }

    const sprintData: Partial<Sprint> = {
      ...createSprintDto,
      projectId: new Types.ObjectId(projectId),
      startDate: createSprintDto.startDate
        ? new Date(createSprintDto.startDate)
        : undefined,
      endDate: createSprintDto.endDate
        ? new Date(createSprintDto.endDate)
        : undefined,
    };

    const sprint = await this.create(sprintData as Partial<SprintDocument>);
    this.logger.log(
      `Sprint created: ${sprint.name} for project ${projectId}`,
    );
    return sprint;
  }

  /**
   * Find sprint by ID
   */
  async findSprintById(id: string): Promise<SprintDocument> {
    const sprint = await this.findById(id);
    if (!sprint) {
      throw BusinessException.resourceNotFound('Sprint', id);
    }
    return sprint;
  }

  /**
   * Update a sprint
   */
  async updateSprint(
    id: string,
    updateSprintDto: UpdateSprintDto,
  ): Promise<SprintDocument> {
    const sprint = await this.findById(id);
    if (!sprint) {
      throw BusinessException.resourceNotFound('Sprint', id);
    }

    const updateData: Record<string, unknown> = { ...updateSprintDto };

    // Convert date strings to Date objects
    if (updateSprintDto.startDate) {
      updateData.startDate = new Date(updateSprintDto.startDate);
    }
    if (updateSprintDto.endDate) {
      updateData.endDate = new Date(updateSprintDto.endDate);
    }

    // Validate dates
    const startDate = updateData.startDate || sprint.startDate;
    const endDate = updateData.endDate || sprint.endDate;
    if (startDate && endDate && new Date(endDate as Date) <= new Date(startDate as Date)) {
      throw BusinessException.invalidOperation(
        'End date must be after start date',
      );
    }

    const updatedSprint = await this.update(id, updateData);
    if (!updatedSprint) {
      throw BusinessException.resourceNotFound('Sprint', id);
    }

    this.logger.log(`Sprint updated: ${id}`);
    return updatedSprint;
  }

  /**
   * Delete a sprint
   */
  async deleteSprint(id: string): Promise<void> {
    const sprint = await this.findById(id);
    if (!sprint) {
      throw BusinessException.resourceNotFound('Sprint', id);
    }

    // Cannot delete active sprint
    if (sprint.status === SprintStatus.ACTIVE) {
      throw BusinessException.invalidOperation(
        'Cannot delete an active sprint. Close it first.',
      );
    }

    await this.delete(id);
    this.logger.log(`Sprint deleted: ${id}`);
  }

  /**
   * Get all sprints for a project
   */
  async getProjectSprints(
    projectId: string,
    skip = 0,
    limit = 20,
  ) {
    // Verify project exists
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw BusinessException.resourceNotFound('Project', projectId);
    }

    return this.findWithPagination(
      { projectId: new Types.ObjectId(projectId) },
      { skip, limit },
      { createdAt: -1 },
    );
  }

  /**
   * Get sprints by status for a project
   */
  async getSprintsByStatus(
    projectId: string,
    status: SprintStatus,
    skip = 0,
    limit = 20,
  ) {
    // Verify project exists
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw BusinessException.resourceNotFound('Project', projectId);
    }

    return this.findWithPagination(
      {
        projectId: new Types.ObjectId(projectId),
        status,
      },
      { skip, limit },
      { createdAt: -1 },
    );
  }

  /**
   * Get active sprint for a project
   */
  async getActiveSprint(projectId: string): Promise<SprintDocument | null> {
    return this.findOne({
      projectId: new Types.ObjectId(projectId),
      status: SprintStatus.ACTIVE,
    });
  }

  /**
   * Start a sprint
   */
  async startSprint(id: string): Promise<SprintDocument> {
    const sprint = await this.findById(id);
    if (!sprint) {
      throw BusinessException.resourceNotFound('Sprint', id);
    }

    if (sprint.status !== SprintStatus.PLANNING) {
      throw BusinessException.invalidOperation(
        'Only sprints in planning status can be started',
      );
    }

    // Check if there's already an active sprint in the project
    const activeSprint = await this.getActiveSprint(sprint.projectId.toString());
    if (activeSprint) {
      throw BusinessException.invalidOperation(
        `There is already an active sprint: ${activeSprint.name}. Close it before starting a new one.`,
      );
    }

    const updateData: Record<string, unknown> = {
      status: SprintStatus.ACTIVE,
    };

    // Set start date if not already set
    if (!sprint.startDate) {
      updateData.startDate = new Date();
    }

    const updatedSprint = await this.update(id, updateData);
    this.logger.log(`Sprint started: ${id}`);
    return updatedSprint!;
  }

  /**
   * Close a sprint
   */
  async closeSprint(id: string): Promise<SprintDocument> {
    const sprint = await this.findById(id);
    if (!sprint) {
      throw BusinessException.resourceNotFound('Sprint', id);
    }

    if (sprint.status !== SprintStatus.ACTIVE) {
      throw BusinessException.invalidOperation(
        'Only active sprints can be closed',
      );
    }

    const updateData: Record<string, unknown> = {
      status: SprintStatus.CLOSED,
    };

    // Set end date if not already set
    if (!sprint.endDate) {
      updateData.endDate = new Date();
    }

    const updatedSprint = await this.update(id, updateData);
    this.logger.log(`Sprint closed: ${id}`);
    return updatedSprint!;
  }

  /**
   * Update sprint status
   */
  async updateSprintStatus(
    id: string,
    status: SprintStatus,
  ): Promise<SprintDocument> {
    const sprint = await this.findById(id);
    if (!sprint) {
      throw BusinessException.resourceNotFound('Sprint', id);
    }

    // Validate status transitions
    if (status === SprintStatus.ACTIVE) {
      return this.startSprint(id);
    }

    if (status === SprintStatus.CLOSED) {
      return this.closeSprint(id);
    }

    // Can only go back to planning if not closed
    if (status === SprintStatus.PLANNING && sprint.status === SprintStatus.CLOSED) {
      throw BusinessException.invalidOperation(
        'Cannot reopen a closed sprint',
      );
    }

    const updatedSprint = await this.update(id, { status });
    this.logger.log(`Sprint ${id} status updated to ${status}`);
    return updatedSprint!;
  }

  /**
   * Update sprint goal
   */
  async updateSprintGoal(
    id: string,
    goal: string,
  ): Promise<SprintDocument> {
    const sprint = await this.findById(id);
    if (!sprint) {
      throw BusinessException.resourceNotFound('Sprint', id);
    }

    const updatedSprint = await this.update(id, { goal });
    this.logger.log(`Sprint ${id} goal updated`);
    return updatedSprint!;
  }

  /**
   * Update sprint dates
   */
  async updateSprintDates(
    id: string,
    startDate?: string,
    endDate?: string,
  ): Promise<SprintDocument> {
    const sprint = await this.findById(id);
    if (!sprint) {
      throw BusinessException.resourceNotFound('Sprint', id);
    }

    const updateData: Record<string, unknown> = {};

    if (startDate) {
      updateData.startDate = new Date(startDate);
    }
    if (endDate) {
      updateData.endDate = new Date(endDate);
    }

    // Validate dates
    const finalStartDate = updateData.startDate || sprint.startDate;
    const finalEndDate = updateData.endDate || sprint.endDate;
    if (finalStartDate && finalEndDate && new Date(finalEndDate as Date) <= new Date(finalStartDate as Date)) {
      throw BusinessException.invalidOperation(
        'End date must be after start date',
      );
    }

    const updatedSprint = await this.update(id, updateData);
    this.logger.log(`Sprint ${id} dates updated`);
    return updatedSprint!;
  }

  /**
   * Get upcoming sprints (planning status)
   */
  async getUpcomingSprints(
    projectId: string,
    skip = 0,
    limit = 10,
  ) {
    return this.getSprintsByStatus(projectId, SprintStatus.PLANNING, skip, limit);
  }

  /**
   * Get closed sprints
   */
  async getClosedSprints(
    projectId: string,
    skip = 0,
    limit = 10,
  ) {
    return this.getSprintsByStatus(projectId, SprintStatus.CLOSED, skip, limit);
  }

  /**
   * Check if sprint belongs to project
   */
  async belongsToProject(
    sprintId: string,
    projectId: string,
  ): Promise<boolean> {
    const sprint = await this.findById(sprintId);
    return sprint?.projectId.toString() === projectId;
  }

  /**
   * Get sprint count for a project
   */
  async getSprintCount(projectId: string): Promise<number> {
    return this.count({ projectId: new Types.ObjectId(projectId) });
  }

  /**
   * Get sprint count by status for a project
   */
  async getSprintCountByStatus(projectId: string) {
    const result = await this.sprintModel.aggregate([
      { $match: { projectId: new Types.ObjectId(projectId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const counts: Record<string, number> = {};
    result.forEach((r) => {
      counts[r._id] = r.count;
    });

    return counts;
  }
}
