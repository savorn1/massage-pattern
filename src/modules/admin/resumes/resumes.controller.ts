import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ResumesService } from './resumes.service';
import { UpsertResumeDto } from './dto/upsert-resume.dto';
import { RenameCvDto } from './dto/rename-cv.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@Controller('admin/resumes')
@UseGuards(JwtAuthGuard)
export class ResumesController {
  constructor(private readonly resumesService: ResumesService) {}

  @Get()
  async findAll(@CurrentUser() user: { userId: string }) {
    const data = await this.resumesService.findAllByUserId(user.userId);
    return { success: true, data };
  }

  @Post()
  async create(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpsertResumeDto,
  ) {
    const resume = await this.resumesService.create(user.userId, dto);
    return {
      success: true,
      data: resume,
      message: 'Resume created successfully',
    };
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    const resume = await this.resumesService.findById(user.userId, id);
    return { success: true, data: resume };
  }

  @Put(':id')
  async update(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpsertResumeDto,
  ) {
    const resume = await this.resumesService.update(user.userId, id, dto);
    return {
      success: true,
      data: resume,
      message: 'Resume saved successfully',
    };
  }

  @Patch(':id/name')
  @HttpCode(HttpStatus.OK)
  async rename(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: RenameCvDto,
  ) {
    await this.resumesService.rename(user.userId, id, dto.cvName);
    return { success: true, message: 'CV renamed successfully' };
  }

  @Post(':id/clone')
  async clone(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    const resume = await this.resumesService.clone(user.userId, id);
    return {
      success: true,
      data: resume,
      message: 'Resume cloned successfully',
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    await this.resumesService.delete(user.userId, id);
    return { success: true, message: 'Resume deleted successfully' };
  }
}
