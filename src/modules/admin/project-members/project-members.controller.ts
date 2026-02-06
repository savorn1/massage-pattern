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
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ProjectMembersService } from './project-members.service';
import { AddProjectMemberDto, UpdateProjectMemberRoleDto } from './dto';

@ApiTags('Project Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/projects/:projectId/members')
export class ProjectMembersController {
  constructor(private readonly membersService: ProjectMembersService) {}

  @Post()
  @ApiOperation({ summary: 'Add a member to project' })
  @ApiResponse({ status: 201, description: 'Member added successfully' })
  async addMember(
    @Param('projectId') projectId: string,
    @Body() addMemberDto: AddProjectMemberDto,
  ) {
    return this.membersService.addMember(projectId, addMemberDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all members of a project' })
  @ApiResponse({ status: 200, description: 'List of project members' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Param('projectId') projectId: string,
    @Query('skip') skip?: number,
    @Query('limit') limit?: number,
  ) {
    return this.membersService.getProjectMembers(projectId, skip, limit);
  }

  @Get('details')
  @ApiOperation({ summary: 'Get all members with user details' })
  @ApiResponse({ status: 200, description: 'List of project members with details' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAllWithDetails(
    @Param('projectId') projectId: string,
    @Query('skip') skip?: number,
    @Query('limit') limit?: number,
  ) {
    return this.membersService.getProjectMembersWithDetails(projectId, skip, limit);
  }

  @Get(':userId/role')
  @ApiOperation({ summary: 'Get a member role' })
  @ApiResponse({ status: 200, description: 'Member role' })
  async getMemberRole(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ) {
    return this.membersService.getMemberRole(projectId, userId);
  }

  @Put(':userId')
  @ApiOperation({ summary: 'Update member role' })
  @ApiResponse({ status: 200, description: 'Member updated successfully' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async updateRole(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() updateMemberDto: UpdateProjectMemberRoleDto,
  ) {
    return this.membersService.updateMemberRole(projectId, userId, updateMemberDto);
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Remove a member from project' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async removeMember(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ) {
    return this.membersService.removeMember(projectId, userId);
  }
}
