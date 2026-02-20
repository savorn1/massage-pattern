import { registerAs } from '@nestjs/config';

export default registerAs('s3', () => ({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin',
  bucket: process.env.S3_BUCKET || 'task-attachments',
  /** Public base URL for direct object access (used to build file URLs) */
  publicUrl: process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT || 'http://localhost:9000',
}));
