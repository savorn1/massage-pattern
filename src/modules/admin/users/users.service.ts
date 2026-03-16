import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '@/modules/shared/entities';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BaseRepository } from '@/core/database/base/base.repository';
import { BusinessException } from '@/core/exceptions/business.exception';
import { UserRole } from '@/common/constants/roles.constant';
import * as bcrypt from 'bcrypt';

/**
 * Service for managing users in the admin module
 */
@Injectable()
export class UsersService extends BaseRepository<UserDocument> implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);
  private readonly saltRounds = 10;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    super(userModel);
  }

  async onModuleInit() {
    const adminEmail = 'admin@admin.com';
    const existing = await this.findOne({ email: adminEmail });
    if (!existing) {
      await this.createUser({
        email: adminEmail,
        password: 'admin123',
        name: 'Admin',
        role: UserRole.SUPER_ADMIN,
      });
      this.logger.log(`Default admin user created: ${adminEmail}`);
    }
  }

  /**
   * Create a new user with hashed password
   */
  async createUser(createUserDto: CreateUserDto): Promise<UserDocument> {
    // Check if email already exists
    const existingUser = await this.findOne({ email: createUserDto.email });
    if (existingUser) {
      throw BusinessException.duplicateResource('User', 'email');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      this.saltRounds,
    );

    // Create user
    const userData = {
      ...createUserDto,
      password: hashedPassword,
      isActive: true,
      isEmailVerified: false,
    };

    const user = await this.create(userData);
    this.logger.log(`User created: ${user.email}`);
    return user;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.findOne({ email });
  }

  /**
   * Update user
   */
  async updateUser(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserDocument | null> {
    // If password is being updated, hash it
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(
        updateUserDto.password,
        this.saltRounds,
      );
    }

    const user = await this.update(id, updateUserDto);
    if (!user) {
      throw BusinessException.resourceNotFound('User', id);
    }

    this.logger.log(`User updated: ${id}`);
    return user;
  }

  /**
   * Soft delete user
   */
  async deleteUser(id: string, userId?: string): Promise<UserDocument | null> {
    const user = await this.softDelete(id, userId);
    if (!user) {
      throw BusinessException.resourceNotFound('User', id);
    }

    this.logger.log(`User deleted: ${id}`);
    return user;
  }

  /**
   * Verify user password
   */
  async verifyPassword(user: UserDocument, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }

  /**
   * Atomically increment a user's points and return the new total
   */
  async addPoints(userId: string, amount: number): Promise<number> {
    const updated = await this.userModel.findByIdAndUpdate(
      userId,
      { $inc: { points: amount } },
      { new: true, select: 'points' },
    ).lean();
    return (updated as any)?.points ?? 0;
  }

  /**
   * Get multiple users by their IDs (used to resolve conversation participants)
   */
  async getByIds(ids: string[]) {
    if (!ids.length) return [];
    const { Types } = await import('mongoose');
    const objectIds = ids.map((id) => new Types.ObjectId(id));
    return this.userModel
      .find({ _id: { $in: objectIds }, isDeleted: false })
      .select('_id name email role avatar')
      .lean();
  }

  /**
   * Get all active users with pagination and optional filters
   */
  async getActiveUsers(
    skip = 0,
    limit = 10,
    filters: { name?: string; email?: string; role?: string } = {},
  ) {
    const query: Record<string, unknown> = { isActive: true, isDeleted: false };
    if (filters.name) query['name'] = { $regex: filters.name, $options: 'i' };
    if (filters.email) query['email'] = { $regex: filters.email, $options: 'i' };
    if (filters.role) query['role'] = filters.role;
    return this.findWithPagination(query, { skip, limit }, { createdAt: -1 });
  }
}
