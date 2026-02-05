import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { MilestonesService } from './milestones.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/constants/roles.constant';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('admin/milestones')
@ApiBearerAuth('JWT-auth')
@Controller('admin/milestones')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CLIENT, UserRole.VENDOR)
  @ApiOperation({ summary: 'Create a new milestone' })
  @ApiResponse({ status: 201, description: 'Milestone created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() createMilestoneDto: CreateMilestoneDto,
    @CurrentUser() currentUser: { userId: string },
  ) {
    const milestone = await this.milestonesService.createMilestone(
      createMilestoneDto,
      currentUser.userId,
    );
    return {
      success: true,
      data: milestone,
      message: 'Milestone created successfully',
    };
  }

  @Get('project/:projectId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CLIENT, UserRole.VENDOR)
  @ApiOperation({ summary: 'Get milestones by project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Number of records to skip' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of records to return' })
  @ApiResponse({ status: 200, description: 'Milestones retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getByProject(
    @Param('projectId') projectId: string,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    const result = await this.milestonesService.getMilestonesByProject(
      projectId,
      skipNum,
      limitNum,
    );

    return {
      success: true,
      data: result.data,
      total: result.total,
      skip: skipNum,
      limit: limitNum,
    };
  }

  @Get('project/:projectId/upcoming')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CLIENT, UserRole.VENDOR)
  @ApiOperation({ summary: 'Get upcoming milestones for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Number of records to skip' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of records to return' })
  @ApiResponse({ status: 200, description: 'Upcoming milestones retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUpcoming(
    @Param('projectId') projectId: string,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    const result = await this.milestonesService.getUpcomingMilestones(
      projectId,
      skipNum,
      limitNum,
    );

    return {
      success: true,
      data: result.data,
      total: result.total,
      skip: skipNum,
      limit: limitNum,
    };
  }

  @Get('project/:projectId/overdue')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CLIENT, UserRole.VENDOR)
  @ApiOperation({ summary: 'Get overdue milestones for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Number of records to skip' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of records to return' })
  @ApiResponse({ status: 200, description: 'Overdue milestones retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getOverdue(
    @Param('projectId') projectId: string,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    const result = await this.milestonesService.getOverdueMilestones(
      projectId,
      skipNum,
      limitNum,
    );

    return {
      success: true,
      data: result.data,
      total: result.total,
      skip: skipNum,
      limit: limitNum,
    };
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CLIENT, UserRole.VENDOR)
  @ApiOperation({ summary: 'Get milestone by ID' })
  @ApiParam({ name: 'id', description: 'Milestone ID' })
  @ApiResponse({ status: 200, description: 'Milestone retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Milestone not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(@Param('id') id: string) {
    const milestone = await this.milestonesService.findById(id);
    if (!milestone) {
      return {
        success: false,
        message: 'Milestone not found',
      };
    }

    return {
      success: true,
      data: milestone,
    };
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CLIENT, UserRole.VENDOR)
  @ApiOperation({ summary: 'Update milestone' })
  @ApiParam({ name: 'id', description: 'Milestone ID' })
  @ApiResponse({ status: 200, description: 'Milestone updated successfully' })
  @ApiResponse({ status: 404, description: 'Milestone not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Param('id') id: string,
    @Body() updateMilestoneDto: UpdateMilestoneDto,
    @CurrentUser() currentUser: { userId: string },
  ) {
    const milestone = await this.milestonesService.updateMilestone(id, {
      ...updateMilestoneDto,
      updatedBy: currentUser.userId,
    });

    return {
      success: true,
      data: milestone,
      message: 'Milestone updated successfully',
    };
  }

  @Patch(':id/progress')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CLIENT, UserRole.VENDOR)
  @ApiOperation({ summary: 'Update milestone progress' })
  @ApiParam({ name: 'id', description: 'Milestone ID' })
  @ApiBody({ schema: { type: 'object', properties: { progress: { type: 'number', minimum: 0, maximum: 100, example: 75 } } } })
  @ApiResponse({ status: 200, description: 'Milestone progress updated successfully' })
  @ApiResponse({ status: 404, description: 'Milestone not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProgress(
    @Param('id') id: string,
    @Body('progress') progress: number,
  ) {
    const milestone = await this.milestonesService.updateProgress(id, progress);
    return {
      success: true,
      data: milestone,
      message: 'Milestone progress updated successfully',
    };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete milestone (soft delete)' })
  @ApiParam({ name: 'id', description: 'Milestone ID' })
  @ApiResponse({ status: 200, description: 'Milestone deleted successfully' })
  @ApiResponse({ status: 404, description: 'Milestone not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: { userId: string },
  ) {
    await this.milestonesService.deleteMilestone(id, currentUser.userId);
    return {
      success: true,
      message: 'Milestone deleted successfully',
    };
  }
}
