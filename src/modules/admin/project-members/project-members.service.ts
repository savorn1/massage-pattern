import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ProjectMember,
  ProjectMemberDocument,
  ProjectMemberRole,
  Project,
  ProjectDocument,
  User,
  UserDocument,
} from '@/modules/shared/entities';
import { AddProjectMemberDto } from './dto/add-member.dto';
import { UpdateProjectMemberRoleDto } from './dto/update-member-role.dto';
import { BaseRepository } from '@/core/database/base/base.repository';
import { BusinessException } from '@/core/exceptions/business.exception';

/**
 * Service for managing project members
 */
@Injectable()
export class ProjectMembersService extends BaseRepository<ProjectMemberDocument> {
  private readonly logger = new Logger(ProjectMembersService.name);

  constructor(
    @InjectModel(ProjectMember.name)
    private readonly projectMemberModel: Model<ProjectMemberDocument>,
    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {
    super(projectMemberModel);
  }

  /**
   * Add a member to a project
   */
  async addMember(
    projectId: string,
    addMemberDto: AddProjectMemberDto,
  ): Promise<ProjectMemberDocument> {
    // Verify project exists
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw BusinessException.resourceNotFound('Project', projectId);
    }

    // Verify user exists
    const user = await this.userModel.findById(addMemberDto.userId);
    if (!user) {
      throw BusinessException.resourceNotFound('User', addMemberDto.userId);
    }

    // Check if member already exists
    const existingMember = await this.findOne({
      projectId: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(addMemberDto.userId),
    });

    if (existingMember) {
      throw BusinessException.duplicateResource('ProjectMember', 'userId');
    }

    const memberData: Partial<ProjectMember> = {
      projectId: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(addMemberDto.userId),
      role: addMemberDto.role || ProjectMemberRole.DEVELOPER,
    };

    const member = await this.create(memberData as Partial<ProjectMemberDocument>);
    this.logger.log(
      `Member ${addMemberDto.userId} added to project ${projectId} with role ${member.role}`,
    );
    return member;
  }

  /**
   * Remove a member from a project
   */
  async removeMember(
    projectId: string,
    userId: string,
  ): Promise<void> {
    const member = await this.findOne({
      projectId: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(userId),
    });

    if (!member) {
      throw BusinessException.resourceNotFound('ProjectMember');
    }

    // Check if this is the project owner
    const project = await this.projectModel.findById(projectId);
    if (project && project.ownerId.toString() === userId) {
      throw BusinessException.invalidOperation(
        'Cannot remove the project owner. Transfer ownership first.',
      );
    }

    await this.projectMemberModel.deleteOne({
      projectId: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(userId),
    });

    this.logger.log(`Member ${userId} removed from project ${projectId}`);
  }

  /**
   * Update a member's role
   */
  async updateMemberRole(
    projectId: string,
    userId: string,
    updateRoleDto: UpdateProjectMemberRoleDto,
  ): Promise<ProjectMemberDocument> {
    const member = await this.findOne({
      projectId: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(userId),
    });

    if (!member) {
      throw BusinessException.resourceNotFound('ProjectMember');
    }

    const updatedMember = await this.updateOne(
      {
        projectId: new Types.ObjectId(projectId),
        userId: new Types.ObjectId(userId),
      },
      { role: updateRoleDto.role },
    );

    this.logger.log(
      `Member ${userId} role updated to ${updateRoleDto.role} in project ${projectId}`,
    );
    return updatedMember!;
  }

  /**
   * Get member by ID
   */
  async getMemberById(id: string): Promise<ProjectMemberDocument> {
    const member = await this.findById(id);
    if (!member) {
      throw BusinessException.resourceNotFound('ProjectMember', id);
    }
    return member;
  }

  /**
   * Get all members of a project
   */
  async getProjectMembers(
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
      { role: 1, joinedAt: 1 },
    );
  }

  /**
   * Get all members of a project with user details populated
   */
  async getProjectMembersWithDetails(
    projectId: string,
    skip = 0,
    limit = 50,
  ) {
    // Verify project exists
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw BusinessException.resourceNotFound('Project', projectId);
    }

    const members = await this.projectMemberModel
      .find({ projectId: new Types.ObjectId(projectId) })
      .populate('userId', 'name email avatar')
      .sort({ role: 1, joinedAt: 1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.count({
      projectId: new Types.ObjectId(projectId),
    });

    return { data: members, total };
  }

  /**
   * Get member's role in a project
   */
  async getMemberRole(
    projectId: string,
    userId: string,
  ): Promise<ProjectMemberRole | null> {
    const member = await this.findOne({
      projectId: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(userId),
    });

    return member?.role || null;
  }

  /**
   * Check if user is a member of the project
   */
  async isMember(projectId: string, userId: string): Promise<boolean> {
    const member = await this.findOne({
      projectId: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(userId),
    });
    return !!member;
  }

  /**
   * Check if user has manager privileges
   */
  async hasManagerPrivileges(
    projectId: string,
    userId: string,
  ): Promise<boolean> {
    // Check if user is the project owner
    const project = await this.projectModel.findById(projectId);
    if (project && project.ownerId.toString() === userId) {
      return true;
    }

    // Check if user is a manager member
    const member = await this.findOne({
      projectId: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(userId),
      role: ProjectMemberRole.MANAGER,
    });
    return !!member;
  }

  /**
   * Check if user can edit (manager or developer)
   */
  async canEdit(projectId: string, userId: string): Promise<boolean> {
    // Check if user is the project owner
    const project = await this.projectModel.findById(projectId);
    if (project && project.ownerId.toString() === userId) {
      return true;
    }

    // Check if user is a manager or developer member
    const member = await this.findOne({
      projectId: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(userId),
      role: { $in: [ProjectMemberRole.MANAGER, ProjectMemberRole.DEVELOPER] },
    });
    return !!member;
  }

  /**
   * Get all projects a user is a member of
   */
  async getUserProjects(userId: string) {
    const memberships = await this.projectMemberModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('projectId')
      .exec();

    return memberships.map((m) => ({
      project: m.projectId,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  /**
   * Get members count by role
   */
  async getMembersCountByRole(projectId: string) {
    const result = await this.projectMemberModel.aggregate([
      { $match: { projectId: new Types.ObjectId(projectId) } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    const counts: Record<string, number> = {};
    result.forEach((r) => {
      counts[r._id] = r.count;
    });

    return counts;
  }

  /**
   * Bulk add members to a project
   */
  async bulkAddMembers(
    projectId: string,
    userIds: string[],
    role: ProjectMemberRole = ProjectMemberRole.DEVELOPER,
  ): Promise<ProjectMemberDocument[]> {
    // Verify project exists
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw BusinessException.resourceNotFound('Project', projectId);
    }

    const members: ProjectMemberDocument[] = [];
    for (const userId of userIds) {
      // Skip if already a member
      const existingMember = await this.findOne({
        projectId: new Types.ObjectId(projectId),
        userId: new Types.ObjectId(userId),
      });

      if (!existingMember) {
        const member = await this.create({
          projectId: new Types.ObjectId(projectId),
          userId: new Types.ObjectId(userId),
          role,
        } as Partial<ProjectMemberDocument>);
        members.push(member);
      }
    }

    this.logger.log(
      `${members.length} members added to project ${projectId}`,
    );
    return members;
  }

  /**
   * Bulk remove members from a project
   */
  async bulkRemoveMembers(
    projectId: string,
    userIds: string[],
  ): Promise<number> {
    // Verify project exists
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw BusinessException.resourceNotFound('Project', projectId);
    }

    // Filter out the project owner
    const filteredUserIds = userIds.filter(
      (id) => id !== project.ownerId.toString(),
    );

    const result = await this.projectMemberModel.deleteMany({
      projectId: new Types.ObjectId(projectId),
      userId: { $in: filteredUserIds.map((id) => new Types.ObjectId(id)) },
    });

    this.logger.log(
      `${result.deletedCount} members removed from project ${projectId}`,
    );
    return result.deletedCount || 0;
  }
}
