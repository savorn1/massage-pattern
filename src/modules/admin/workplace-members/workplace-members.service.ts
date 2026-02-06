import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WorkplaceMember,
  WorkplaceMemberDocument,
  WorkplaceMemberRole,
  Workplace,
  WorkplaceDocument,
  User,
  UserDocument,
} from '@/modules/shared/entities';
import { AddWorkplaceMemberDto } from './dto/add-member.dto';
import { UpdateWorkplaceMemberRoleDto } from './dto/update-member-role.dto';
import { BaseRepository } from '@/core/database/base/base.repository';
import { BusinessException } from '@/core/exceptions/business.exception';

/**
 * Service for managing workplace members
 */
@Injectable()
export class WorkplaceMembersService extends BaseRepository<WorkplaceMemberDocument> {
  private readonly logger = new Logger(WorkplaceMembersService.name);

  constructor(
    @InjectModel(WorkplaceMember.name)
    private readonly workplaceMemberModel: Model<WorkplaceMemberDocument>,
    @InjectModel(Workplace.name)
    private readonly workplaceModel: Model<WorkplaceDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {
    super(workplaceMemberModel);
  }

  /**
   * Add a member to a workplace
   */
  async addMember(
    workplaceId: string,
    addMemberDto: AddWorkplaceMemberDto,
  ): Promise<WorkplaceMemberDocument> {
    // Verify workplace exists
    const workplace = await this.workplaceModel.findById(workplaceId);
    if (!workplace) {
      throw BusinessException.resourceNotFound('Workplace', workplaceId);
    }

    // Verify user exists
    const user = await this.userModel.findById(addMemberDto.userId);
    if (!user) {
      throw BusinessException.resourceNotFound('User', addMemberDto.userId);
    }

    // Check if member already exists
    const existingMember = await this.findOne({
      workplaceId: new Types.ObjectId(workplaceId),
      userId: new Types.ObjectId(addMemberDto.userId),
    });

    if (existingMember) {
      throw BusinessException.duplicateResource('WorkplaceMember', 'userId');
    }

    // Cannot add another owner
    if (addMemberDto.role === WorkplaceMemberRole.OWNER) {
      const existingOwner = await this.findOne({
        workplaceId: new Types.ObjectId(workplaceId),
        role: WorkplaceMemberRole.OWNER,
      });
      if (existingOwner) {
        throw BusinessException.invalidOperation(
          'Workplace already has an owner. Transfer ownership instead.',
        );
      }
    }

    const memberData: Partial<WorkplaceMember> = {
      workplaceId: new Types.ObjectId(workplaceId),
      userId: new Types.ObjectId(addMemberDto.userId),
      role: addMemberDto.role || WorkplaceMemberRole.MEMBER,
    };

    const member = await this.create(memberData as Partial<WorkplaceMemberDocument>);
    this.logger.log(
      `Member ${addMemberDto.userId} added to workplace ${workplaceId} with role ${member.role}`,
    );
    return member;
  }

  /**
   * Remove a member from a workplace
   */
  async removeMember(
    workplaceId: string,
    userId: string,
  ): Promise<void> {
    const member = await this.findOne({
      workplaceId: new Types.ObjectId(workplaceId),
      userId: new Types.ObjectId(userId),
    });

    if (!member) {
      throw BusinessException.resourceNotFound('WorkplaceMember');
    }

    // Cannot remove the owner
    if (member.role === WorkplaceMemberRole.OWNER) {
      throw BusinessException.invalidOperation(
        'Cannot remove the workplace owner. Transfer ownership first.',
      );
    }

    await this.workplaceMemberModel.deleteOne({
      workplaceId: new Types.ObjectId(workplaceId),
      userId: new Types.ObjectId(userId),
    });

    this.logger.log(`Member ${userId} removed from workplace ${workplaceId}`);
  }

  /**
   * Update a member's role
   */
  async updateMemberRole(
    workplaceId: string,
    userId: string,
    updateRoleDto: UpdateWorkplaceMemberRoleDto,
  ): Promise<WorkplaceMemberDocument> {
    const member = await this.findOne({
      workplaceId: new Types.ObjectId(workplaceId),
      userId: new Types.ObjectId(userId),
    });

    if (!member) {
      throw BusinessException.resourceNotFound('WorkplaceMember');
    }

    // Cannot change owner role directly
    if (member.role === WorkplaceMemberRole.OWNER) {
      throw BusinessException.invalidOperation(
        'Cannot change owner role. Transfer ownership instead.',
      );
    }

    // Cannot promote to owner
    if (updateRoleDto.role === WorkplaceMemberRole.OWNER) {
      throw BusinessException.invalidOperation(
        'Cannot promote to owner. Use transfer ownership instead.',
      );
    }

    const updatedMember = await this.updateOne(
      {
        workplaceId: new Types.ObjectId(workplaceId),
        userId: new Types.ObjectId(userId),
      },
      { role: updateRoleDto.role },
    );

    this.logger.log(
      `Member ${userId} role updated to ${updateRoleDto.role} in workplace ${workplaceId}`,
    );
    return updatedMember!;
  }

  /**
   * Get member by ID
   */
  async getMemberById(id: string): Promise<WorkplaceMemberDocument> {
    const member = await this.findById(id);
    if (!member) {
      throw BusinessException.resourceNotFound('WorkplaceMember', id);
    }
    return member;
  }

  /**
   * Get all members of a workplace
   */
  async getWorkplaceMembers(
    workplaceId: string,
    skip = 0,
    limit = 50,
  ) {
    // Verify workplace exists
    const workplace = await this.workplaceModel.findById(workplaceId);
    if (!workplace) {
      throw BusinessException.resourceNotFound('Workplace', workplaceId);
    }

    return this.findWithPagination(
      { workplaceId: new Types.ObjectId(workplaceId) },
      { skip, limit },
      { role: 1, joinedAt: 1 },
    );
  }

  /**
   * Get all members of a workplace with user details populated
   */
  async getWorkplaceMembersWithDetails(
    workplaceId: string,
    skip = 0,
    limit = 50,
  ) {
    // Verify workplace exists
    const workplace = await this.workplaceModel.findById(workplaceId);
    if (!workplace) {
      throw BusinessException.resourceNotFound('Workplace', workplaceId);
    }

    const members = await this.workplaceMemberModel
      .find({ workplaceId: new Types.ObjectId(workplaceId) })
      .populate('userId', 'name email avatar')
      .sort({ role: 1, joinedAt: 1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.count({
      workplaceId: new Types.ObjectId(workplaceId),
    });

    return { data: members, total };
  }

  /**
   * Get member's role in a workplace
   */
  async getMemberRole(
    workplaceId: string,
    userId: string,
  ): Promise<WorkplaceMemberRole | null> {
    const member = await this.findOne({
      workplaceId: new Types.ObjectId(workplaceId),
      userId: new Types.ObjectId(userId),
    });

    return member?.role || null;
  }

  /**
   * Check if user is a member of the workplace
   */
  async isMember(workplaceId: string, userId: string): Promise<boolean> {
    const member = await this.findOne({
      workplaceId: new Types.ObjectId(workplaceId),
      userId: new Types.ObjectId(userId),
    });
    return !!member;
  }

  /**
   * Check if user has admin or owner privileges
   */
  async hasAdminPrivileges(
    workplaceId: string,
    userId: string,
  ): Promise<boolean> {
    const member = await this.findOne({
      workplaceId: new Types.ObjectId(workplaceId),
      userId: new Types.ObjectId(userId),
      role: { $in: [WorkplaceMemberRole.OWNER, WorkplaceMemberRole.ADMIN] },
    });
    return !!member;
  }

  /**
   * Get all workplaces a user is a member of
   */
  async getUserWorkplaces(userId: string) {
    const memberships = await this.workplaceMemberModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('workplaceId')
      .exec();

    return memberships.map((m) => ({
      workplace: m.workplaceId,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  /**
   * Get members count by role
   */
  async getMembersCountByRole(workplaceId: string) {
    const result = await this.workplaceMemberModel.aggregate([
      { $match: { workplaceId: new Types.ObjectId(workplaceId) } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    const counts: Record<string, number> = {};
    result.forEach((r) => {
      counts[r._id] = r.count;
    });

    return counts;
  }
}
