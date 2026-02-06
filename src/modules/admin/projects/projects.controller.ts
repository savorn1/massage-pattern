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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/constants/roles.constant';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('admin/projects')
@ApiBearerAuth('JWT-auth')
@Controller('admin/projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, description: 'Project created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQuery({ name: 'workplaceId', required: true, description: 'Workplace ID' })
  async create(
    @Body() createProjectDto: CreateProjectDto,
    @Query('workplaceId') workplaceId: string,
    @CurrentUser() currentUser: { userId: string },
  ) {
    const project = await this.projectsService.createProject(
      createProjectDto,
      currentUser.userId,
      workplaceId,
    );
    return {
      success: true,
      data: project,
      message: 'Project created successfully',
    };
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all projects with pagination' })
  @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Number of records to skip' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of records to return' })
  @ApiResponse({ status: 200, description: 'Projects retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Query('skip') skip?: string, @Query('limit') limit?: string) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    const result = await this.projectsService.getActiveProjects(skipNum, limitNum);

    return {
      success: true,
      data: result.data,
      total: result.total,
      skip: skipNum,
      limit: limitNum,
    };
  }

  @Get('by-workplace/:workplaceId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get projects by workplace' })
  @ApiParam({ name: 'workplaceId', description: 'Workplace ID' })
  @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Number of records to skip' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of records to return' })
  @ApiResponse({ status: 200, description: 'Projects retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getByWorkplace(
    @Param('workplaceId') workplaceId: string,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    const result = await this.projectsService.getProjectsByWorkplace(
      workplaceId,
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

  @Get('my-projects')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get current user\'s projects' })
  @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Number of records to skip' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of records to return' })
  @ApiResponse({ status: 200, description: 'User projects retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyProjects(
    @CurrentUser() currentUser: { userId: string },
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    const result = await this.projectsService.getProjectsByOwner(
      currentUser.userId,
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(@Param('id') id: string) {
    const project = await this.projectsService.findById(id);
    if (!project) {
      return {
        success: false,
        message: 'Project not found',
      };
    }

    return {
      success: true,
      data: project,
    };
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update project' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project updated successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    const project = await this.projectsService.updateProject(id, updateProjectDto);

    return {
      success: true,
      data: project,
      message: 'Project updated successfully',
    };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete project (archive)' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project deleted successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(@Param('id') id: string) {
    await this.projectsService.deleteProject(id);
    return {
      success: true,
      message: 'Project deleted successfully',
    };
  }

  @Put(':id/archive')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Archive project' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project archived successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async archive(@Param('id') id: string) {
    const project = await this.projectsService.archiveProject(id);
    return {
      success: true,
      data: project,
      message: 'Project archived successfully',
    };
  }

  @Put(':id/activate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Activate project' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project activated successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async activate(@Param('id') id: string) {
    const project = await this.projectsService.activateProject(id);
    return {
      success: true,
      data: project,
      message: 'Project activated successfully',
    };
  }
}
