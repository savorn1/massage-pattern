import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument, ProjectStatus } from '@/modules/shared/entities';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { BaseRepository } from '@/core/database/base/base.repository';
import { BusinessException } from '@/core/exceptions/business.exception';

/**
 * Service for managing projects
 */
@Injectable()
export class ProjectsService extends BaseRepository<ProjectDocument> {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,
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
    this.logger.log(`Project created: ${project.name} by user ${userId}`);
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
   */
  async getProjectsByOwner(ownerId: string, skip = 0, limit = 10) {
    return this.findWithPagination(
      { ownerId: new Types.ObjectId(ownerId), status: ProjectStatus.ACTIVE },
      { skip, limit },
      { createdAt: -1 },
    );
  }

  /**
   * Get projects by workplace
   */
  async getProjectsByWorkplace(workplaceId: string, skip = 0, limit = 10) {
    return this.findWithPagination(
      { workplaceId: new Types.ObjectId(workplaceId), status: ProjectStatus.ACTIVE },
      { skip, limit },
      { createdAt: -1 },
    );
  }

  /**
   * Get all active projects with pagination
   */
  async getActiveProjects(skip = 0, limit = 10) {
    return this.findWithPagination(
      { status: ProjectStatus.ACTIVE },
      { skip, limit },
      { createdAt: -1 },
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
    return project;
  }
}
