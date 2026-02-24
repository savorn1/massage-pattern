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
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { FundPoolsService } from './fund-pools.service';
import { CreateFundPoolDto, UpdateFundPoolDto } from './dto';

@ApiTags('Fund Pools')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/fund-pools')
export class FundPoolsController {
  constructor(private readonly fundPoolsService: FundPoolsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new fund pool' })
  @ApiResponse({ status: 201, description: 'Fund pool created successfully' })
  async create(@Body() dto: CreateFundPoolDto) {
    return this.fundPoolsService.createFundPool(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all fund pools' })
  @ApiResponse({ status: 200, description: 'List of fund pools' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query('skip') skip?: number,
    @Query('limit') limit?: number,
  ) {
    return this.fundPoolsService.getAllFundPools(skip, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a fund pool by ID' })
  @ApiResponse({ status: 200, description: 'Fund pool details' })
  @ApiResponse({ status: 404, description: 'Fund pool not found' })
  async findOne(@Param('id') id: string) {
    return this.fundPoolsService.findFundPoolById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a fund pool' })
  @ApiResponse({ status: 200, description: 'Fund pool updated successfully' })
  @ApiResponse({ status: 404, description: 'Fund pool not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateFundPoolDto) {
    return this.fundPoolsService.updateFundPool(id, dto);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle fund pool enabled/disabled' })
  @ApiResponse({ status: 200, description: 'Fund pool toggled successfully' })
  async toggle(@Param('id') id: string) {
    return this.fundPoolsService.toggleEnabled(id);
  }

  @Patch(':id/execute')
  @ApiOperation({ summary: 'Record execution timestamp for a fund pool' })
  @ApiResponse({ status: 200, description: 'Execution recorded' })
  async recordExecution(@Param('id') id: string) {
    return this.fundPoolsService.recordExecution(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a fund pool' })
  @ApiResponse({ status: 200, description: 'Fund pool deleted successfully' })
  @ApiResponse({ status: 404, description: 'Fund pool not found' })
  async remove(@Param('id') id: string) {
    return this.fundPoolsService.deleteFundPool(id);
  }
}
