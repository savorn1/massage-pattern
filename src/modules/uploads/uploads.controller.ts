import {
  Controller, Post, Get, Delete, Param, Query,
  UseInterceptors, UploadedFile, UploadedFiles,
  BadRequestException, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { UploadsService } from './uploads.service';

/** 20 MB max file size */
const MAX_SIZE = 20 * 1024 * 1024;

const multerOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_SIZE },
};

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  // ─── Upload single file ───────────────────────────────────────────────────

  @Post('single')
  @ApiOperation({ summary: 'Upload a single file to MinIO' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async uploadSingle(
    @UploadedFile() file: Express.Multer.File,
    @Query('uploaderId') uploaderId: string,
    @Query('taskId') taskId?: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    if (!uploaderId) throw new BadRequestException('uploaderId is required');

    const saved = await this.uploadsService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      uploaderId,
      taskId,
    );

    return {
      success: true,
      data: saved,
      message: `File "${file.originalname}" uploaded successfully`,
    };
  }

  // ─── Upload multiple files ────────────────────────────────────────────────

  @Post('multiple')
  @ApiOperation({ summary: 'Upload multiple files (max 10)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('uploaderId') uploaderId: string,
    @Query('taskId') taskId?: string,
  ) {
    if (!files || files.length === 0) throw new BadRequestException('No files provided');
    if (!uploaderId) throw new BadRequestException('uploaderId is required');

    const results = await Promise.all(
      files.map((f) =>
        this.uploadsService.uploadFile(f.buffer, f.originalname, f.mimetype, uploaderId, taskId),
      ),
    );

    return {
      success: true,
      data: results,
      count: results.length,
    };
  }

  // ─── List & query ─────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all uploaded files' })
  async findAll(@Query('limit') limit = '50') {
    const files = await this.uploadsService.findAll(parseInt(limit, 10));
    return { success: true, data: files, total: files.length };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Storage stats (total files, size, bucket)' })
  async stats() {
    return this.uploadsService.getStats();
  }

  @Get('task/:taskId')
  @ApiOperation({ summary: 'Get all files attached to a task' })
  async findByTask(@Param('taskId') taskId: string) {
    const files = await this.uploadsService.findByTask(taskId);
    return { success: true, data: files };
  }

  @Get('user/:uploaderId')
  @ApiOperation({ summary: 'Get all files uploaded by a user' })
  async findByUploader(@Param('uploaderId') uploaderId: string) {
    const files = await this.uploadsService.findByUploader(uploaderId);
    return { success: true, data: files };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file metadata by ID' })
  async findOne(@Param('id') id: string) {
    const file = await this.uploadsService.findById(id);
    return { success: true, data: file };
  }

  @Get(':id/presigned')
  @ApiOperation({ summary: 'Generate presigned download URL (15 min expiry)' })
  async presigned(
    @Param('id') id: string,
    @Query('expiresIn') expiresIn = '900',
  ) {
    const url = await this.uploadsService.getPresignedUrl(id, parseInt(expiresIn, 10));
    return { success: true, url, expiresInSeconds: parseInt(expiresIn, 10) };
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a file from MinIO and MongoDB' })
  async deleteFile(@Param('id') id: string) {
    await this.uploadsService.deleteFile(id);
  }
}
