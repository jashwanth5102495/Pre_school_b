import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env';

const region = env.AWS_REGION || env.S3_REGION || process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1';
const bucketName = env.AWS_S3_BUCKET || env.S3_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || 'school-saas-storage';
const accessKeyId = env.AWS_ACCESS_KEY_ID || env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || '';
const secretAccessKey = env.AWS_SECRET_ACCESS_KEY || env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || '';
const endpoint = env.AWS_ENDPOINT || env.S3_ENDPOINT || process.env.AWS_ENDPOINT || process.env.S3_ENDPOINT || undefined;
const forcePathStyle = env.S3_FORCE_PATH_STYLE === 'true' || process.env.S3_FORCE_PATH_STYLE === 'true' || Boolean(endpoint);
const publicUrl = env.S3_PUBLIC_URL || process.env.S3_PUBLIC_URL || undefined;

export const s3Config = {
  region,
  bucketName,
  accessKeyId,
  secretAccessKey,
  endpoint,
  forcePathStyle,
  publicUrl,
  isConfigured: Boolean(accessKeyId && secretAccessKey && accessKeyId !== 'dummy_aws_key'),
};

export const s3Client = new S3Client({
  region,
  endpoint,
  forcePathStyle,
  credentials: s3Config.isConfigured
    ? {
        accessKeyId,
        secretAccessKey,
      }
    : undefined,
});
