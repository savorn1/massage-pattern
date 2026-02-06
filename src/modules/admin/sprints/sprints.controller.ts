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
import { SprintsService } from './sprints.service';
import { CreateSprintDto, UpdateSprintDto } from './dto';

@ApiTags('Sprints')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/projects/:projectId/sprints')
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new sprint' })
  @ApiResponse({ status: 201, description: 'Sprint created successfully' })
  async create(
    @Param('projectId') projectId: string,
    @Body() createSprintDto: CreateSprintDto,
  ) {
    return this.sprintsService.createSprint(projectId, createSprintDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all sprints for a project' })
  @ApiResponse({ status: 200, description: 'List of sprints' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Param('projectId') projectId: string,
    @Query('skip') skip?: number,
    @Query('limit') limit?: number,
  ) {
    return this.sprintsService.getProjectSprints(projectId, skip, limit);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get the active sprint for a project' })
  @ApiResponse({ status: 200, description: 'Active sprint details' })
  @ApiResponse({ status: 404, description: 'No active sprint found' })
  async findActive(@Param('projectId') projectId: string) {
    return this.sprintsService.getActiveSprint(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a sprint by ID' })
  @ApiResponse({ status: 200, description: 'Sprint details' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  async findOne(@Param('id') id: string) {
    return this.sprintsService.findSprintById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a sprint' })
  @ApiResponse({ status: 200, description: 'Sprint updated successfully' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  async update(
    @Param('id') id: string,
    @Body() updateSprintDto: UpdateSprintDto,
  ) {
    return this.sprintsService.updateSprint(id, updateSprintDto);
  }

  @Put(':id/start')
  @ApiOperation({ summary: 'Start a sprint' })
  @ApiResponse({ status: 200, description: 'Sprint started successfully' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  async start(@Param('id') id: string) {
    return this.sprintsService.startSprint(id);
  }

  @Put(':id/close')
  @ApiOperation({ summary: 'Close a sprint' })
  @ApiResponse({ status: 200, description: 'Sprint closed successfully' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  async close(@Param('id') id: string) {
    return this.sprintsService.closeSprint(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a sprint' })
  @ApiResponse({ status: 200, description: 'Sprint deleted successfully' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  async remove(@Param('id') id: string) {
    return this.sprintsService.deleteSprint(id);
  }
}
