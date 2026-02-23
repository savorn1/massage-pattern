import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument, ProjectStatus, ProjectMember, ProjectMemberDocument, ProjectMemberRole } from '@/modules/shared/entities';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { BaseRepository } from '@/core/database/base/base.repository';
import { BusinessException } from '@/core/exceptions/business.exception';
import { EventsService, EventType } from '../events/events.service';
import { CacheService } from '@/modules/cache/cache.service';

// ─── Cache TTL (seconds) ──────────────────────────────────────────────────────
const PROJECT_LIST_TTL = 60;  // projects change less often than tasks

/**
 * Service for managing projects
 */
@Injectable()
export class ProjectsService extends BaseRepository<ProjectDocument> {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(ProjectMember.name)
    private readonly projectMemberModel: Model<ProjectMemberDocument>,
    private readonly eventsService: EventsService,
    private readonly cacheService: CacheService,
  ) {
    super(projectModel);
  }

  /**
   * Create a new project
   */
  async createProject(
    createProjectDto: CreateProjectDto,
    userId: string,
    workplaceId: string,
  ): Promise<ProjectDocument> {
    const { startDate, endDate, ...rest } = createProjectDto;

    // Check if key is already taken in the workplace
    const existingProject = await this.findOne({
      workplaceId: new Types.ObjectId(workplaceId),
      key: createProjectDto.key,
    });
    if (existingProject) {
      throw BusinessException.duplicateResource('Project', 'key');
    }

    const projectData: Partial<Project> = {
      ...rest,
      ownerId: new Types.ObjectId(userId),
      workplaceId: new Types.ObjectId(workplaceId),
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const project = await this.create(projectData as Partial<ProjectDocument>);

    // Auto-add creator as manager
    await this.projectMemberModel.create({
      projectId: project._id,
      userId: new Types.ObjectId(userId),
      role: ProjectMemberRole.MANAGER,
      joinedAt: new Date(),
    });

    this.logger.log(`Project created: ${project.name} by user ${userId}`);

    // ── Cache invalidation ──────────────────────────────────────────────────
    await Promise.all([
      this.cacheService.delPattern(`projects:workplace:${workplaceId}:*`),
      this.cacheService.delPattern(`projects:owner:${userId}:*`),
      this.cacheService.delPattern(`projects:active:*`),
    ]);

    // Emit real-time event
    await this.eventsService.emitProjectEvent({
      type: EventType.PROJECT_CREATED,
      project: project.toObject(),
      workplaceId,
      userId,
      timestamp: new Date().toISOString(),
    });

    return project;
  }

  /**
   * Update project
   */
  async updateProject(
    id: string,
    updateProjectDto: UpdateProjectDto,
  ): Promise<ProjectDocument | null> {
    const updateData: Record<string, unknown> = { ...updateProjectDto };

    if (updateProjectDto.startDate) {
      updateData.startDate = new Date(updateProjectDto.startDate);
    }

    if (updateProjectDto.endDate) {
      updateData.endDate = new Date(updateProjectDto.endDate);
    }

    const project = await this.update(id, updateData);
    if (!project) {
      throw BusinessException.resourceNotFound('Project', id);
    }

    this.logger.log(`Project updated: ${id}`);

    // ── Cache invalidation ──────────────────────────────────────────────────
    const workplaceId = project.workplaceId.toString();
    await Promise.all([
      this.cacheService.del(`projects:id:${id}`),
      this.cacheService.delPattern(`projects:workplace:${workplaceId}:*`),
      this.cacheService.delPattern(`projects:active:*`),
    ]);

    // Emit real-time event
    await this.eventsService.emitProjectEvent({
      type: EventType.PROJECT_UPDATED,
      project: project.toObject(),
      workplaceId: project.workplaceId.toString(),
      timestamp: new Date().toISOString(),
    });

    return project;
  }

  /**
   * Delete project (archive)
   */
  async deleteProject(id: string): Promise<ProjectDocument | null> {
    return this.archiveProject(id);
  }

  /**
   * Get projects by owner
   *
   * Cache-aside: busted when a project is created / archived in this workplace.
   */
  async getProjectsByOwner(ownerId: string, skip = 0, limit = 10) {
    const key = `projects:owner:${ownerId}:${skip}:${limit}`;
    return this.cacheService.getOrSet(
      key,
      () => this.findWithPagination(
        { ownerId: new Types.ObjectId(ownerId), status: ProjectStatus.ACTIVE },
        { skip, limit },
        { createdAt: -1 },
      ),
      PROJECT_LIST_TTL,
    );
  }

  /**
   * Get projects by workplace
   */
  async getProjectsByWorkplace(workplaceId: string, skip = 0, limit = 10) {
    const key = `projects:workplace:${workplaceId}:${skip}:${limit}`;
    return this.cacheService.getOrSet(
      key,
      () => this.findWithPagination(
        { workplaceId: new Types.ObjectId(workplaceId), status: ProjectStatus.ACTIVE },
        { skip, limit },
        { createdAt: -1 },
      ),
      PROJECT_LIST_TTL,
    );
  }

  /**
   * Get all active projects with pagination
   */
  async getActiveProjects(skip = 0, limit = 10) {
    const key = `projects:active:${skip}:${limit}`;
    return this.cacheService.getOrSet(
      key,
      () => this.findWithPagination(
        { status: ProjectStatus.ACTIVE },
        { skip, limit },
        { createdAt: -1 },
      ),
      PROJECT_LIST_TTL,
    );
  }

  /**
   * Find project by key within a workplace
   */
  async findByKey(workplaceId: string, key: string): Promise<ProjectDocument | null> {
    return this.findOne({
      workplaceId: new Types.ObjectId(workplaceId),
      key,
      status: ProjectStatus.ACTIVE,
    });
  }

  /**
   * Archive project
   */
  async archiveProject(id: string): Promise<ProjectDocument | null> {
    const project = await this.update(id, { status: ProjectStatus.ARCHIVED });
    if (!project) {
      throw BusinessException.resourceNotFound('Project', id);
    }

    this.logger.log(`Project archived: ${id}`);

    // ── Cache invalidation ──────────────────────────────────────────────────
    const workplaceId = project.workplaceId.toString();
    await Promise.all([
      this.cacheService.del(`projects:id:${id}`),
      this.cacheService.delPattern(`projects:workplace:${workplaceId}:*`),
      this.cacheService.delPattern(`projects:owner:${project.ownerId.toString()}:*`),
      this.cacheService.delPattern(`projects:active:*`),
    ]);

    // Emit real-time event
    await this.eventsService.emitProjectEvent({
      type: EventType.PROJECT_DELETED,
      project: project.toObject(),
      workplaceId,
      timestamp: new Date().toISOString(),
    });

    return project;
  }

  /**
   * Activate project
   */
  async activateProject(id: string): Promise<ProjectDocument | null> {
    const project = await this.update(id, { status: ProjectStatus.ACTIVE });
    if (!project) {
      throw BusinessException.resourceNotFound('Project', id);
    }

    this.logger.log(`Project activated: ${id}`);

    // ── Cache invalidation ──────────────────────────────────────────────────
    await Promise.all([
      this.cacheService.del(`projects:id:${id}`),
      this.cacheService.delPattern(`projects:workplace:${project.workplaceId.toString()}:*`),
      this.cacheService.delPattern(`projects:active:*`),
    ]);

    return project;
  }
}
