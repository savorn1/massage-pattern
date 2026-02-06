import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Label,
  LabelDocument,
  Project,
  ProjectDocument,
} from '@/modules/shared/entities';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { BaseRepository } from '@/core/database/base/base.repository';
import { BusinessException } from '@/core/exceptions/business.exception';

/**
 * Service for managing labels within projects
 */
@Injectable()
export class LabelsService extends BaseRepository<LabelDocument> {
  private readonly logger = new Logger(LabelsService.name);

  constructor(
    @InjectModel(Label.name)
    private readonly labelModel: Model<LabelDocument>,
    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,
  ) {
    super(labelModel);
  }

  /**
   * Create a new label for a project
   */
  async createLabel(
    projectId: string,
    createLabelDto: CreateLabelDto,
  ): Promise<LabelDocument> {
    // Verify project exists
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw BusinessException.resourceNotFound('Project', projectId);
    }

    // Check if label with same name already exists in the project
    const existingLabel = await this.findOne({
      projectId: new Types.ObjectId(projectId),
      name: createLabelDto.name,
    });

    if (existingLabel) {
      throw BusinessException.duplicateResource('Label', 'name');
    }

    const labelData: Partial<Label> = {
      ...createLabelDto,
      projectId: new Types.ObjectId(projectId),
    };

    const label = await this.create(labelData as Partial<LabelDocument>);
    this.logger.log(
      `Label created: ${label.name} for project ${projectId}`,
    );
    return label;
  }

  /**
   * Find label by ID
   */
  async findLabelById(id: string): Promise<LabelDocument> {
    const label = await this.findById(id);
    if (!label) {
      throw BusinessException.resourceNotFound('Label', id);
    }
    return label;
  }

  /**
   * Update a label
   */
  async updateLabel(
    id: string,
    updateLabelDto: UpdateLabelDto,
  ): Promise<LabelDocument> {
    const label = await this.findById(id);
    if (!label) {
      throw BusinessException.resourceNotFound('Label', id);
    }

    // Check for duplicate name if name is being updated
    if (updateLabelDto.name && updateLabelDto.name !== label.name) {
      const existingLabel = await this.findOne({
        projectId: label.projectId,
        name: updateLabelDto.name,
        _id: { $ne: new Types.ObjectId(id) },
      });

      if (existingLabel) {
        throw BusinessException.duplicateResource('Label', 'name');
      }
    }

    const updatedLabel = await this.update(id, updateLabelDto);
    if (!updatedLabel) {
      throw BusinessException.resourceNotFound('Label', id);
    }

    this.logger.log(`Label updated: ${id}`);
    return updatedLabel;
  }

  /**
   * Delete a label
   */
  async deleteLabel(id: string): Promise<void> {
    const label = await this.findById(id);
    if (!label) {
      throw BusinessException.resourceNotFound('Label', id);
    }

    await this.delete(id);
    this.logger.log(`Label deleted: ${id}`);
  }

  /**
   * Get all labels for a project
   */
  async getProjectLabels(
    projectId: string,
    skip = 0,
    limit = 50,
  ) {
    // Verify project exists
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw BusinessException.resourceNotFound('Project', projectId);
    }

    return this.findWithPagination(
      { projectId: new Types.ObjectId(projectId) },
      { skip, limit },
      { name: 1 },
    );
  }

  /**
   * Get all labels for a project (no pagination)
   */
  async getAllProjectLabels(projectId: string): Promise<LabelDocument[]> {
    // Verify project exists
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw BusinessException.resourceNotFound('Project', projectId);
    }

    return this.findAll(
      { projectId: new Types.ObjectId(projectId) },
      undefined,
      { sort: { name: 1 } },
    );
  }

  /**
   * Find label by name in a project
   */
  async findByName(
    projectId: string,
    name: string,
  ): Promise<LabelDocument | null> {
    return this.findOne({
      projectId: new Types.ObjectId(projectId),
      name,
    });
  }

  /**
   * Search labels by name
   */
  async searchLabels(
    projectId: string,
    searchTerm: string,
    skip = 0,
    limit = 10,
  ) {
    // Verify project exists
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw BusinessException.resourceNotFound('Project', projectId);
    }

    return this.findWithPagination(
      {
        projectId: new Types.ObjectId(projectId),
        name: { $regex: searchTerm, $options: 'i' },
      },
      { skip, limit },
      { name: 1 },
    );
  }

  /**
   * Get labels by IDs
   */
  async getLabelsByIds(ids: string[]): Promise<LabelDocument[]> {
    return this.findAll({
      _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
    });
  }

  /**
   * Check if label belongs to project
   */
  async belongsToProject(
    labelId: string,
    projectId: string,
  ): Promise<boolean> {
    const label = await this.findById(labelId);
    return label?.projectId.toString() === projectId;
  }

  /**
   * Bulk create labels for a project
   */
  async bulkCreateLabels(
    projectId: string,
    labels: CreateLabelDto[],
  ): Promise<LabelDocument[]> {
    // Verify project exists
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw BusinessException.resourceNotFound('Project', projectId);
    }

    const createdLabels: LabelDocument[] = [];
    for (const labelDto of labels) {
      // Skip if label with same name exists
      const existingLabel = await this.findOne({
        projectId: new Types.ObjectId(projectId),
        name: labelDto.name,
      });

      if (!existingLabel) {
        const label = await this.create({
          ...labelDto,
          projectId: new Types.ObjectId(projectId),
        } as Partial<LabelDocument>);
        createdLabels.push(label);
      }
    }

    this.logger.log(
      `${createdLabels.length} labels created for project ${projectId}`,
    );
    return createdLabels;
  }

  /**
   * Delete all labels for a project
   */
  async deleteAllProjectLabels(projectId: string): Promise<number> {
    // Verify project exists
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw BusinessException.resourceNotFound('Project', projectId);
    }

    const result = await this.labelModel.deleteMany({
      projectId: new Types.ObjectId(projectId),
    });

    this.logger.log(
      `${result.deletedCount} labels deleted from project ${projectId}`,
    );
    return result.deletedCount || 0;
  }

  /**
   * Get label counts for a project
   */
  async getLabelCount(projectId: string): Promise<number> {
    return this.count({ projectId: new Types.ObjectId(projectId) });
  }

  /**
   * Create default labels for a new project
   */
  async createDefaultLabels(projectId: string): Promise<LabelDocument[]> {
    const defaultLabels: CreateLabelDto[] = [
      { name: 'Bug', color: '#ef4444' },
      { name: 'Feature', color: '#22c55e' },
      { name: 'Enhancement', color: '#3b82f6' },
      { name: 'Documentation', color: '#a855f7' },
      { name: 'Help Wanted', color: '#f59e0b' },
      { name: 'Question', color: '#ec4899' },
    ];

    return this.bulkCreateLabels(projectId, defaultLabels);
  }
}
