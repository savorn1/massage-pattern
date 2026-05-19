import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Resume, ResumeDocument } from '@/modules/shared/entities';
import { UpsertResumeDto } from './dto/upsert-resume.dto';

@Injectable()
export class ResumesService {
  private readonly logger = new Logger(ResumesService.name);

  constructor(
    @InjectModel(Resume.name)
    private readonly resumeModel: Model<ResumeDocument>,
  ) {}

  async findAllByUserId(
    userId: string,
  ): Promise<
    Pick<ResumeDocument, '_id' | 'cvName' | 'fullName' | 'updatedAt'>[]
  > {
    const docs = await this.resumeModel
      .find({ userId, isDeleted: { $ne: true } })
      .select('_id cvName fullName updatedAt')
      .sort({ updatedAt: -1 })
      .exec();
    return docs as unknown as Pick<
      ResumeDocument,
      '_id' | 'cvName' | 'fullName' | 'updatedAt'
    >[];
  }

  async findById(userId: string, id: string): Promise<ResumeDocument> {
    const resume = await this.resumeModel
      .findOne({
        _id: new Types.ObjectId(id),
        userId,
        isDeleted: { $ne: true },
      })
      .exec();
    if (!resume) throw new NotFoundException('Resume not found');
    return resume;
  }

  async create(userId: string, dto: UpsertResumeDto): Promise<ResumeDocument> {
    const resume = await this.resumeModel.create({ userId, ...dto });
    this.logger.log(`Resume created for user: ${userId}`);
    return resume;
  }

  async update(
    userId: string,
    id: string,
    dto: UpsertResumeDto,
  ): Promise<ResumeDocument> {
    const resume = await this.resumeModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), userId },
        { $set: dto },
        { new: true, runValidators: true },
      )
      .exec();
    if (!resume) throw new NotFoundException('Resume not found');
    this.logger.log(`Resume ${id} updated for user: ${userId}`);
    return resume;
  }

  async clone(userId: string, id: string): Promise<ResumeDocument> {
    const src = await this.findById(userId, id);
    const dto: UpsertResumeDto = {
      cvName: `Copy of ${src.cvName || src.fullName || 'CV'}`,
      fullName: src.fullName,
      title: src.title,
      phone: src.phone,
      email: src.email,
      location: src.location,
      profileUrl: src.profileUrl,
      photo: src.photo,
      summary: src.summary,
      skills: [...(src.skills ?? [])],
      experiences: src.experiences.map((e) => ({
        title: e.title,
        company: e.company,
        location: e.location,
        startDate: e.startDate,
        endDate: e.endDate,
        isCurrent: e.isCurrent,
        responsibilities: [...e.responsibilities],
      })),
      education: src.education.map((e) => ({
        degree: e.degree,
        institution: e.institution,
        year: e.year,
        highlights: [...e.highlights],
      })),
      languages: src.languages.map((l) => ({ name: l.name, level: l.level })),
      awards: src.awards.map((a) => ({
        title: a.title,
        organization: a.organization,
        year: a.year,
      })),
      references: src.references.map((r) => ({
        name: r.name,
        jobTitle: r.jobTitle,
        organization: r.organization,
        email: r.email,
        phone: r.phone,
      })),
      hobbies: [...(src.hobbies ?? [])],
    };
    this.logger.log(`Resume ${id} cloned for user: ${userId}`);
    return this.create(userId, dto);
  }

  async rename(userId: string, id: string, cvName: string): Promise<void> {
    const result = await this.resumeModel
      .updateOne({ _id: new Types.ObjectId(id), userId }, { $set: { cvName } })
      .exec();
    if (result.matchedCount === 0)
      throw new NotFoundException('Resume not found');
    this.logger.log(`Resume ${id} renamed for user: ${userId}`);
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await this.resumeModel
      .deleteOne({ _id: new Types.ObjectId(id), userId })
      .exec();
    if (result.deletedCount === 0)
      throw new NotFoundException('Resume not found');
    this.logger.log(`Resume ${id} deleted for user: ${userId}`);
  }
}
