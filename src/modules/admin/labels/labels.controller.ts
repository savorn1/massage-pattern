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
import { LabelsService } from './labels.service';
import { CreateLabelDto, UpdateLabelDto } from './dto';

@ApiTags('Labels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/projects/:projectId/labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new label' })
  @ApiResponse({ status: 201, description: 'Label created successfully' })
  async create(
    @Param('projectId') projectId: string,
    @Body() createLabelDto: CreateLabelDto,
  ) {
    return this.labelsService.createLabel(projectId, createLabelDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all labels for a project' })
  @ApiResponse({ status: 200, description: 'List of labels' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Param('projectId') projectId: string,
    @Query('skip') skip?: number,
    @Query('limit') limit?: number,
  ) {
    return this.labelsService.getProjectLabels(projectId, skip, limit);
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all labels for a project (no pagination)' })
  @ApiResponse({ status: 200, description: 'List of all labels' })
  async findAllNoPagination(@Param('projectId') projectId: string) {
    return this.labelsService.getAllProjectLabels(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a label by ID' })
  @ApiResponse({ status: 200, description: 'Label details' })
  @ApiResponse({ status: 404, description: 'Label not found' })
  async findOne(@Param('id') id: string) {
    return this.labelsService.findLabelById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a label' })
  @ApiResponse({ status: 200, description: 'Label updated successfully' })
  @ApiResponse({ status: 404, description: 'Label not found' })
  async update(
    @Param('id') id: string,
    @Body() updateLabelDto: UpdateLabelDto,
  ) {
    return this.labelsService.updateLabel(id, updateLabelDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a label' })
  @ApiResponse({ status: 200, description: 'Label deleted successfully' })
  @ApiResponse({ status: 404, description: 'Label not found' })
  async remove(@Param('id') id: string) {
    return this.labelsService.deleteLabel(id);
  }
}
