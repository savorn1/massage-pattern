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
  Request,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { WorkplacesService } from './workplaces.service';
import { CreateWorkplaceDto, UpdateWorkplaceDto } from './dto';

@ApiTags('Workplaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/workplaces')
export class WorkplacesController {
  constructor(private readonly workplacesService: WorkplacesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workplace' })
  @ApiResponse({ status: 201, description: 'Workplace created successfully' })
  async create(@Body() createWorkplaceDto: CreateWorkplaceDto, @Request() req) {
    return this.workplacesService.createWorkplace(createWorkplaceDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all workplaces for current user' })
  @ApiResponse({ status: 200, description: 'List of workplaces' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Request() req,
    @Query('skip') skip?: number,
    @Query('limit') limit?: number,
  ) {
    return this.workplacesService.getWorkplacesByMember(req.user.id, skip, limit);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get project and member counts for all workplaces' })
  @ApiResponse({ status: 200, description: 'Workplace stats' })
  async getStats(@Request() req) {
    const result = await this.workplacesService.getWorkplacesByMember(req.user.id, 0, 100);
    const workplaceIds = result.data.map((w: any) => w._id.toString());
    const stats = await this.workplacesService.getWorkplaceStats(workplaceIds);
    return { success: true, data: stats };
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get a workplace by slug' })
  @ApiResponse({ status: 200, description: 'Workplace details' })
  @ApiResponse({ status: 403, description: 'Not a member of this workplace' })
  @ApiResponse({ status: 404, description: 'Workplace not found' })
  async findBySlug(@Param('slug') slug: string, @Request() req) {
    const workplace = await this.workplacesService.findWorkplaceBySlug(slug);
    const access = await this.workplacesService.hasAccess((workplace._id as any).toString(), req.user.id);
    if (!access) throw new ForbiddenException('You are not a member of this workplace');
    return workplace;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workplace by ID' })
  @ApiResponse({ status: 200, description: 'Workplace details' })
  @ApiResponse({ status: 403, description: 'Not a member of this workplace' })
  @ApiResponse({ status: 404, description: 'Workplace not found' })
  async findOne(@Param('id') id: string, @Request() req) {
    const access = await this.workplacesService.hasAccess(id, req.user.id);
    if (!access) throw new ForbiddenException('You are not a member of this workplace');
    return this.workplacesService.findWorkplaceById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a workplace' })
  @ApiResponse({ status: 200, description: 'Workplace updated successfully' })
  @ApiResponse({ status: 403, description: 'Only admins or owners can update' })
  @ApiResponse({ status: 404, description: 'Workplace not found' })
  async update(
    @Param('id') id: string,
    @Body() updateWorkplaceDto: UpdateWorkplaceDto,
    @Request() req,
  ) {
    const allowed = await this.workplacesService.isAdminOrOwner(id, req.user.id);
    if (!allowed) throw new ForbiddenException('Only workspace admins or owners can update');
    return this.workplacesService.updateWorkplace(id, updateWorkplaceDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a workplace' })
  @ApiResponse({ status: 200, description: 'Workplace deleted successfully' })
  @ApiResponse({ status: 403, description: 'Only owners can delete' })
  @ApiResponse({ status: 404, description: 'Workplace not found' })
  async remove(@Param('id') id: string, @Request() req) {
    const allowed = await this.workplacesService.isAdminOrOwner(id, req.user.id);
    if (!allowed) throw new ForbiddenException('Only workspace admins or owners can delete');
    return this.workplacesService.deleteWorkplace(id);
  }
}
