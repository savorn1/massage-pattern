import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/constants/roles.constant';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

/**
 * Admin controller for user management
 * Requires authentication and admin role
 */
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Create a new user
   */
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.createUser(createUserDto);
    // Don't return password in response
    const userObj = user.toObject() as Record<string, unknown> & {
      password?: string;
    };
    delete userObj.password;
    return {
      success: true,
      data: userObj,
      message: 'User created successfully',
    };
  }

  /**
   * Get all users with pagination
   */
  @Get()
  async findAll(@Query('skip') skip?: string, @Query('limit') limit?: string) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    const result = await this.usersService.getActiveUsers(skipNum, limitNum);

    // Remove passwords from response
    const usersWithoutPasswords = result.data.map((user) => {
      const userObj = user.toObject() as Record<string, unknown> & {
        password?: string;
      };
      delete userObj.password;
      return userObj;
    });

    return {
      success: true,
      data: usersWithoutPasswords,
      total: result.total,
      skip: skipNum,
      limit: limitNum,
    };
  }

  /**
   * Get user by ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
    }

    const userObj = user.toObject() as Record<string, unknown> & {
      password?: string;
    };
    delete userObj.password;
    return {
      success: true,
      data: userObj,
    };
  }

  /**
   * Update user
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: { userId: string },
  ) {
    const user = await this.usersService.updateUser(id, {
      ...updateUserDto,
      updatedBy: currentUser.userId,
    });

    const userObj = user!.toObject() as Record<string, unknown> & {
      password?: string;
    };
    delete userObj.password;
    return {
      success: true,
      data: userObj,
      message: 'User updated successfully',
    };
  }

  /**
   * Delete user (soft delete)
   */
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: { userId: string },
  ) {
    await this.usersService.deleteUser(id, currentUser.userId);
    return {
      success: true,
      message: 'User deleted successfully',
    };
  }
}
