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
import { WorkplaceMembersService } from './workplace-members.service';
import { AddWorkplaceMemberDto, UpdateWorkplaceMemberRoleDto } from './dto';

@ApiTags('Workplace Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/workplaces/:workplaceId/members')
export class WorkplaceMembersController {
  constructor(private readonly membersService: WorkplaceMembersService) {}

  @Post()
  @ApiOperation({ summary: 'Add a member to workplace' })
  @ApiResponse({ status: 201, description: 'Member added successfully' })
  async addMember(
    @Param('workplaceId') workplaceId: string,
    @Body() addMemberDto: AddWorkplaceMemberDto,
  ) {
    return this.membersService.addMember(workplaceId, addMemberDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all members of a workplace' })
  @ApiResponse({ status: 200, description: 'List of workplace members' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Param('workplaceId') workplaceId: string,
    @Query('skip') skip?: number,
    @Query('limit') limit?: number,
  ) {
    return this.membersService.getWorkplaceMembers(workplaceId, skip, limit);
  }

  @Get('details')
  @ApiOperation({ summary: 'Get all members with user details' })
  @ApiResponse({ status: 200, description: 'List of workplace members with details' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAllWithDetails(
    @Param('workplaceId') workplaceId: string,
    @Query('skip') skip?: number,
    @Query('limit') limit?: number,
  ) {
    return this.membersService.getWorkplaceMembersWithDetails(workplaceId, skip, limit);
  }

  @Get(':userId/role')
  @ApiOperation({ summary: 'Get a member role' })
  @ApiResponse({ status: 200, description: 'Member role' })
  async getMemberRole(
    @Param('workplaceId') workplaceId: string,
    @Param('userId') userId: string,
  ) {
    return this.membersService.getMemberRole(workplaceId, userId);
  }

  @Put(':userId')
  @ApiOperation({ summary: 'Update member role' })
  @ApiResponse({ status: 200, description: 'Member updated successfully' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async updateRole(
    @Param('workplaceId') workplaceId: string,
    @Param('userId') userId: string,
    @Body() updateMemberDto: UpdateWorkplaceMemberRoleDto,
  ) {
    return this.membersService.updateMemberRole(workplaceId, userId, updateMemberDto);
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Remove a member from workplace' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async removeMember(
    @Param('workplaceId') workplaceId: string,
    @Param('userId') userId: string,
  ) {
    return this.membersService.removeMember(workplaceId, userId);
  }
}
