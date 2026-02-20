import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import * as crypto from 'crypto';
import * as path from 'path';

export interface UploadResult {
  key: string;       // S3 object key
  url: string;       // public URL
  bucket: string;
  size: number;
  mimeType: string;
  etag?: string;
}

export interface S3ObjectInfo {
  key: string;
  size: number;
  lastModified?: Date;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const endpoint = this.configService.get<string>('s3.endpoint')!;
    const region = this.configService.get<string>('s3.region')!;
    const accessKeyId = this.configService.get<string>('s3.accessKeyId')!;
    const secretAccessKey = this.configService.get<string>('s3.secretAccessKey')!;

    this.bucket = this.configService.get<string>('s3.bucket')!;
    this.publicUrl = this.configService.get<string>('s3.publicUrl')!;

    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      // Required for MinIO: force path-style URLs (bucket in path, not subdomain)
      forcePathStyle: true,
    });

    await this.ensureBucketExists();
  }

  // ─── Upload ───────────────────────────────────────────────────────────────

  /**
   * Upload a file buffer to MinIO/S3.
   * Generates a unique key: uploads/{folder}/{uuid}.{ext}
   */
  async upload(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder = 'general',
  ): Promise<UploadResult> {
    const ext = path.extname(originalName).toLowerCase();
    const uuid = crypto.randomUUID();
    const key = `uploads/${folder}/${uuid}${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ContentLength: buffer.length,
        Metadata: {
          originalName,
          uploadedAt: new Date().toISOString(),
        },
      }),
    );

    const url = `${this.publicUrl}/${this.bucket}/${key}`;
    this.logger.log(`[Storage] Uploaded: ${key} (${buffer.length} bytes)`);

    return { key, url, bucket: this.bucket, size: buffer.length, mimeType };
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    this.logger.log(`[Storage] Deleted: ${key}`);
  }

  // ─── Presigned URL ────────────────────────────────────────────────────────

  /**
   * Generate a temporary presigned URL for direct browser download.
   * The URL expires after `expiresIn` seconds (default 15 minutes).
   */
  async getPresignedUrl(key: string, expiresIn = 900): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  async listObjects(prefix = 'uploads/', maxKeys = 100): Promise<S3ObjectInfo[]> {
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
      }),
    );

    return (response.Contents ?? []).map((obj) => ({
      key: obj.Key ?? '',
      size: obj.Size ?? 0,
      lastModified: obj.LastModified,
    }));
  }

  // ─── Bucket management ────────────────────────────────────────────────────

  private async ensureBucketExists(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`[Storage] Bucket "${this.bucket}" exists`);
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`[Storage] Bucket "${this.bucket}" created`);
      } catch (err: unknown) {
        this.logger.error(`[Storage] Failed to create bucket: ${(err as Error).message}`);
      }
    }
  }

  async headObject(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  getBucket(): string {
    return this.bucket;
  }
}
