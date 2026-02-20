import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { File, FileDocument } from '@/modules/shared/entities/file.entity';
import { StorageService } from './storage.service';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    @InjectModel(File.name)
    private readonly fileModel: Model<FileDocument>,
    private readonly storageService: StorageService,
  ) {}

  // ─── Upload ───────────────────────────────────────────────────────────────

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    uploaderId: string,
    taskId?: string,
  ): Promise<FileDocument> {
    // Determine folder by type
    const folder = this.getFolderByMime(mimeType);

    // 1. Upload bytes to MinIO
    const result = await this.storageService.upload(buffer, originalName, mimeType, folder);

    // 2. Save metadata to MongoDB
    const file = new this.fileModel({
      filename: result.key.split('/').pop(),
      originalName,
      url: result.url,
      s3Key: result.key,
      mimeType,
      size: result.size,
      uploaderId,
      taskId: taskId || undefined,
    });

    const saved = await file.save();
    this.logger.log(`[Uploads] File saved: ${originalName} → ${result.key}`);
    return saved;
  }

  // ─── Query ────────────────────────────────────────────────────────────────

  async findAll(limit = 50): Promise<FileDocument[]> {
    return this.fileModel.find().sort({ createdAt: -1 }).limit(limit).exec();
  }

  async findByTask(taskId: string): Promise<FileDocument[]> {
    return this.fileModel
      .find({ taskId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByUploader(uploaderId: string): Promise<FileDocument[]> {
    return this.fileModel
      .find({ uploaderId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findById(id: string): Promise<FileDocument> {
    const file = await this.fileModel.findById(id).exec();
    if (!file) throw new NotFoundException(`File ${id} not found`);
    return file;
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async deleteFile(id: string): Promise<void> {
    const file = await this.findById(id);

    // 1. Delete from MinIO
    if (file.s3Key) {
      await this.storageService.delete(file.s3Key);
    }

    // 2. Remove metadata from MongoDB
    await this.fileModel.deleteOne({ _id: id });
    this.logger.log(`[Uploads] Deleted file: ${id}`);
  }

  // ─── Presigned URL ────────────────────────────────────────────────────────

  async getPresignedUrl(id: string, expiresIn = 900): Promise<string> {
    const file = await this.findById(id);
    if (!file.s3Key) throw new NotFoundException('File has no S3 key');
    return this.storageService.getPresignedUrl(file.s3Key, expiresIn);
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  async getStats() {
    const [total, totalSize] = await Promise.all([
      this.fileModel.countDocuments(),
      this.fileModel.aggregate([
        { $group: { _id: null, totalSize: { $sum: '$size' } } },
      ]),
    ]);

    return {
      totalFiles: total,
      totalSizeBytes: totalSize[0]?.totalSize ?? 0,
      bucket: this.storageService.getBucket(),
    };
  }

  // ─── Helper ───────────────────────────────────────────────────────────────

  private getFolderByMime(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'images';
    if (mimeType.startsWith('video/')) return 'videos';
    if (mimeType === 'application/pdf') return 'pdfs';
    return 'documents';
  }
}
