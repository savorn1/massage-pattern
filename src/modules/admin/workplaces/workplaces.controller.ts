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

  @Get(':id')
  @ApiOperation({ summary: 'Get a workplace by ID' })
  @ApiResponse({ status: 200, description: 'Workplace details' })
  @ApiResponse({ status: 404, description: 'Workplace not found' })
  async findOne(@Param('id') id: string) {
    return this.workplacesService.findWorkplaceById(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get a workplace by slug' })
  @ApiResponse({ status: 200, description: 'Workplace details' })
  @ApiResponse({ status: 404, description: 'Workplace not found' })
  async findBySlug(@Param('slug') slug: string) {
    return this.workplacesService.findWorkplaceBySlug(slug);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a workplace' })
  @ApiResponse({ status: 200, description: 'Workplace updated successfully' })
  @ApiResponse({ status: 404, description: 'Workplace not found' })
  async update(
    @Param('id') id: string,
    @Body() updateWorkplaceDto: UpdateWorkplaceDto,
  ) {
    return this.workplacesService.updateWorkplace(id, updateWorkplaceDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a workplace' })
  @ApiResponse({ status: 200, description: 'Workplace deleted successfully' })
  @ApiResponse({ status: 404, description: 'Workplace not found' })
  async remove(@Param('id') id: string) {
    return this.workplacesService.deleteWorkplace(id);
  }
}
