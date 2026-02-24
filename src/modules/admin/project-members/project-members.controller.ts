import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AddProjectMemberDto, UpdateProjectMemberRoleDto } from './dto';
import { ProjectMembersService } from './project-members.service';

@ApiTags('Project Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@SkipThrottle({ short: true, medium: true, long: true })
@Controller('admin/projects/:projectId/members')
export class ProjectMembersController {
  constructor(private readonly membersService: ProjectMembersService) { }

  @Post('join')
  @ApiOperation({ summary: 'Join a project directly (self-join as developer)' })
  @ApiResponse({ status: 201, description: 'Joined project successfully' })
  async joinProject(@Param('projectId') projectId: string, @Request() req) {
    return this.membersService.addMember(projectId, { userId: req.user.id });
  }

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

  @SkipThrottle({ short: true, medium: true, long: true })
  @Get('me')
  @ApiOperation({ summary: 'Get my membership status for this project' })
  @ApiResponse({ status: 200, description: 'Membership status' })
  async getMyMembership(@Param('projectId') projectId: string, @Request() req) {
    const role = await this.membersService.getMemberRole(projectId, req.user.id);
    return { isMember: role !== null, role };
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
