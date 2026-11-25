"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.s3Client = exports.s3Config = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const env_1 = require("./env");
const region = env_1.env.AWS_REGION || env_1.env.S3_REGION || process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1';
const bucketName = env_1.env.AWS_S3_BUCKET || env_1.env.S3_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || 'school-saas-storage';
const accessKeyId = env_1.env.AWS_ACCESS_KEY_ID || env_1.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || '';
const secretAccessKey = env_1.env.AWS_SECRET_ACCESS_KEY || env_1.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || '';
const endpoint = env_1.env.AWS_ENDPOINT || env_1.env.S3_ENDPOINT || process.env.AWS_ENDPOINT || process.env.S3_ENDPOINT || undefined;
const forcePathStyle = env_1.env.S3_FORCE_PATH_STYLE === 'true' || process.env.S3_FORCE_PATH_STYLE === 'true' || Boolean(endpoint);
const publicUrl = env_1.env.S3_PUBLIC_URL || process.env.S3_PUBLIC_URL || undefined;
exports.s3Config = {
    region,
    bucketName,
    accessKeyId,
    secretAccessKey,
    endpoint,
    forcePathStyle,
    publicUrl,
    isConfigured: Boolean(accessKeyId && secretAccessKey && accessKeyId !== 'dummy_aws_key'),
};
exports.s3Client = new client_s3_1.S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: exports.s3Config.isConfigured
        ? {
            accessKeyId,
            secretAccessKey,
        }
        : undefined,
});
