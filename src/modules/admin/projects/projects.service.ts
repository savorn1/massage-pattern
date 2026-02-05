import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument } from '@/modules/shared/entities';
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
  ): Promise<ProjectDocument> {
    const { memberIds, startDate, endDate, dueDate, ...rest } = createProjectDto;

    const projectData: Partial<Project> = {
      ...rest,
      ownerId: new Types.ObjectId(userId),
      memberIds: memberIds?.map((id) => new Types.ObjectId(id)) || [],
      createdBy: userId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
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

    if (updateProjectDto.memberIds) {
      updateData.memberIds = updateProjectDto.memberIds.map(
        (id) => new Types.ObjectId(id),
      );
    }

    if (updateProjectDto.ownerId) {
      updateData.ownerId = new Types.ObjectId(updateProjectDto.ownerId);
    }

    const project = await this.update(id, updateData);
    if (!project) {
      throw BusinessException.resourceNotFound('Project', id);
    }

    this.logger.log(`Project updated: ${id}`);
    return project;
  }

  /**
   * Soft delete project
   */
  async deleteProject(
    id: string,
    userId?: string,
  ): Promise<ProjectDocument | null> {
    const project = await this.softDelete(id, userId);
    if (!project) {
      throw BusinessException.resourceNotFound('Project', id);
    }

    this.logger.log(`Project deleted: ${id}`);
    return project;
  }

  /**
   * Get projects by owner
   */
  async getProjectsByOwner(ownerId: string, skip = 0, limit = 10) {
    return this.findWithPagination(
      { ownerId: new Types.ObjectId(ownerId), isDeleted: false },
      { skip, limit },
      { createdAt: -1 },
    );
  }

  /**
   * Get projects where user is a member
   */
  async getProjectsByMember(userId: string, skip = 0, limit = 10) {
    return this.findWithPagination(
      {
        $or: [
          { ownerId: new Types.ObjectId(userId) },
          { memberIds: new Types.ObjectId(userId) },
        ],
        isDeleted: false,
      },
      { skip, limit },
      { createdAt: -1 },
    );
  }

  /**
   * Get all active projects with pagination
   */
  async getActiveProjects(skip = 0, limit = 10) {
    return this.findWithPagination(
      { isDeleted: false },
      { skip, limit },
      { createdAt: -1 },
    );
  }

  /**
   * Add member to project
   */
  async addMember(projectId: string, memberId: string): Promise<ProjectDocument | null> {
    const project = await this.update(projectId, {
      $addToSet: { memberIds: new Types.ObjectId(memberId) },
    });

    if (!project) {
      throw BusinessException.resourceNotFound('Project', projectId);
    }

    this.logger.log(`Member ${memberId} added to project ${projectId}`);
    return project;
  }

  /**
   * Remove member from project
   */
  async removeMember(projectId: string, memberId: string): Promise<ProjectDocument | null> {
    const project = await this.update(projectId, {
      $pull: { memberIds: new Types.ObjectId(memberId) },
    });

    if (!project) {
      throw BusinessException.resourceNotFound('Project', projectId);
    }

    this.logger.log(`Member ${memberId} removed from project ${projectId}`);
    return project;
  }
}
