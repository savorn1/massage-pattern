import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { File, FileSchema } from '@/modules/shared/entities/file.entity';
import { StorageService } from './storage.service';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: File.name, schema: FileSchema }]),
  ],
  controllers: [UploadsController],
  providers: [StorageService, UploadsService],
  exports: [UploadsService, StorageService],
})
export class UploadsModule {}
