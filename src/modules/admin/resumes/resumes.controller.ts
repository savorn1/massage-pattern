import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ResumesService } from './resumes.service';
import { UpsertResumeDto } from './dto/upsert-resume.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@Controller('admin/resume')
@UseGuards(JwtAuthGuard)
export class ResumesController {
  constructor(private readonly resumesService: ResumesService) {}

  /**
   * Get the authenticated user's resume
   */
  @Get()
  async findMine(@CurrentUser() user: { userId: string }) {
    const resume = await this.resumesService.findByUserId(user.userId);
    return { success: true, data: resume ?? null };
  }

  /**
   * Create or update the authenticated user's resume
   */
  @Put()
  async upsert(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpsertResumeDto,
  ) {
    const resume = await this.resumesService.upsert(user.userId, dto);
    return { success: true, data: resume, message: 'Resume saved successfully' };
  }

  /**
   * Delete the authenticated user's resume
   */
  @Delete()
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: { userId: string }) {
    await this.resumesService.delete(user.userId);
    return { success: true, message: 'Resume deleted successfully' };
  }
}
