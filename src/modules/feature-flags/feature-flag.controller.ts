import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FeatureFlagService, CreateFlagDto, UpdateFlagDto } from './feature-flag.service';

@ApiTags('Feature Flags')
@Controller('feature-flags')
export class FeatureFlagController {
  constructor(private readonly flagService: FeatureFlagService) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all feature flags' })
  async findAll() {
    const flags = await this.flagService.findAll();
    return { success: true, data: flags, total: flags.length };
  }

  @Get('evaluate')
  @ApiOperation({ summary: 'Evaluate multiple flags for a user' })
  async evaluateMany(
    @Query('keys') keys: string,
    @Query('userId') userId?: string,
  ) {
    const keyList = keys ? keys.split(',').map((k) => k.trim()) : [];
    const result = await this.flagService.evaluateMany(keyList, userId);
    return { success: true, flags: result };
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a single feature flag by key' })
  async findOne(@Param('key') key: string) {
    const flag = await this.flagService.findByKey(key);
    return { success: true, data: flag };
  }

  @Get(':key/evaluate')
  @ApiOperation({ summary: 'Evaluate a single flag for a user' })
  async evaluate(
    @Param('key') key: string,
    @Query('userId') userId?: string,
  ) {
    const result = await this.flagService.evaluate(key, userId);
    return { success: true, ...result };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new feature flag' })
  async create(@Body() dto: CreateFlagDto) {
    const flag = await this.flagService.create(dto);
    return { success: true, data: flag };
  }

  @Post('seed')
  @ApiOperation({ summary: 'Seed default feature flags' })
  async seed() {
    await this.flagService.seedDefaults();
    const flags = await this.flagService.findAll();
    return { success: true, message: 'Default flags seeded', data: flags };
  }

  @Put(':key')
  @ApiOperation({ summary: 'Update a feature flag' })
  async update(@Param('key') key: string, @Body() dto: UpdateFlagDto) {
    const flag = await this.flagService.update(key, dto);
    return { success: true, data: flag };
  }

  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a feature flag' })
  async delete(@Param('key') key: string) {
    await this.flagService.delete(key);
  }

  // ─── Toggle shortcuts ────────────────────────────────────────────────────

  @Patch(':key/toggle')
  @ApiOperation({ summary: 'Toggle a flag on/off' })
  async toggle(@Param('key') key: string) {
    const flag = await this.flagService.toggle(key);
    return { success: true, data: flag, enabled: flag.enabled };
  }

  @Patch(':key/enable')
  @ApiOperation({ summary: 'Enable a flag' })
  async enable(@Param('key') key: string) {
    const flag = await this.flagService.enable(key);
    return { success: true, data: flag };
  }

  @Patch(':key/disable')
  @ApiOperation({ summary: 'Disable a flag' })
  async disable(@Param('key') key: string) {
    const flag = await this.flagService.disable(key);
    return { success: true, data: flag };
  }
}
