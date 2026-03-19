import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Resume, ResumeDocument } from '@/modules/shared/entities';
import { UpsertResumeDto } from './dto/upsert-resume.dto';

@Injectable()
export class ResumesService {
  private readonly logger = new Logger(ResumesService.name);

  constructor(
    @InjectModel(Resume.name) private readonly resumeModel: Model<ResumeDocument>,
  ) {}

  /**
   * Get resume for a user. Returns null if not found.
   */
  async findByUserId(userId: string): Promise<ResumeDocument | null> {
    return this.resumeModel.findOne({ userId, isDeleted: { $ne: true } }).exec();
  }

  /**
   * Create or update (upsert) a resume for the given user.
   */
  async upsert(userId: string, dto: UpsertResumeDto): Promise<ResumeDocument> {
    const resume = await this.resumeModel
      .findOneAndUpdate(
        { userId },
        { $set: { userId, ...dto } },
        { upsert: true, new: true, runValidators: true },
      )
      .exec();

    this.logger.log(`Resume upserted for user: ${userId}`);
    return resume!;
  }

  /**
   * Delete a user's resume.
   */
  async delete(userId: string): Promise<void> {
    await this.resumeModel.deleteOne({ userId }).exec();
    this.logger.log(`Resume deleted for user: ${userId}`);
  }
}
