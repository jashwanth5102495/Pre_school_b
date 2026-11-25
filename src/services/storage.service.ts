import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import { s3Client, s3Config } from '../config/s3.config';

export interface UploadResult {
  fileUrl: string;
  key: string;
  size: number;
  storage: 'S3' | 'LOCAL';
  mimetype: string;
}

export class StorageService {
  private localUploadDir = path.resolve(process.cwd(), 'uploads/documents');

  constructor() {
    // Ensure local fallback folder exists
    if (!fs.existsSync(this.localUploadDir)) {
      fs.mkdirSync(this.localUploadDir, { recursive: true });
    }
  }

  /**
   * Upload a student document to S3 (Railway S3 or AWS S3), with seamless local fallback
   */
  async uploadStudentDocument(params: {
    schoolId: string;
    studentId: string;
    documentType: string;
    originalFilename: string;
    buffer: Buffer;
    mimetype: string;
    size: number;
  }): Promise<UploadResult> {
    const { schoolId, studentId, documentType, originalFilename, buffer, mimetype, size } = params;

    // Sanitize filename
    const sanitizedExt = path.extname(originalFilename).toLowerCase() || '.bin';
    const baseName = path.basename(originalFilename, sanitizedExt).replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();
    const finalFilename = `${timestamp}_${baseName}${sanitizedExt}`;

    // S3 Key Structure: schools/<schoolId>/students/<studentId>/<documentType>/<filename>
    const s3Key = `schools/${schoolId}/students/${studentId}/${documentType}/${finalFilename}`;

    // Attempt S3 upload if configured
    if (s3Config.isConfigured) {
      try {
        console.log(`[StorageService] Uploading document to S3 (Bucket: ${s3Config.bucketName}, Key: ${s3Key})...`);
        const command = new PutObjectCommand({
          Bucket: s3Config.bucketName,
          Key: s3Key,
          Body: buffer,
          ContentType: mimetype,
          Metadata: {
            schoolid: schoolId,
            studentid: studentId,
            documenttype: documentType,
            originalfilename: encodeURIComponent(originalFilename),
          },
        });

        await s3Client.send(command);

        // Build file URL
        let fileUrl: string;
        if (s3Config.publicUrl) {
          fileUrl = `${s3Config.publicUrl.replace(/\/$/, '')}/${s3Key}`;
        } else if (s3Config.endpoint) {
          fileUrl = `${s3Config.endpoint.replace(/\/$/, '')}/${s3Config.bucketName}/${s3Key}`;
        } else {
          fileUrl = `https://${s3Config.bucketName}.s3.${s3Config.region}.amazonaws.com/${s3Key}`;
        }

        console.log(`[StorageService] S3 upload successful. URL: ${fileUrl}`);

        return {
          fileUrl,
          key: s3Key,
          size,
          storage: 'S3',
          mimetype,
        };
      } catch (s3Error: any) {
        console.warn(`[StorageService] S3 upload failed (${s3Error.message}), falling back to local storage.`);
      }
    } else {
      console.log('[StorageService] S3 credentials not configured for remote cloud, using local storage.');
    }

    // Local Disk Fallback
    const targetDir = path.join(this.localUploadDir, schoolId, studentId, documentType);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const localFilePath = path.join(targetDir, finalFilename);
    await fs.promises.writeFile(localFilePath, buffer);

    const relativePath = `/uploads/documents/${schoolId}/${studentId}/${documentType}/${finalFilename}`;

    return {
      fileUrl: relativePath,
      key: s3Key,
      size,
      storage: 'LOCAL',
      mimetype,
    };
  }

  /**
   * Generate a secure presigned URL or direct link for document viewing/downloading
   */
  async getDocumentViewUrl(keyOrUrl: string, expiresInSeconds = 3600): Promise<string> {
    if (!keyOrUrl) return '';

    // If it's a local relative path, return as is
    if (keyOrUrl.startsWith('/uploads/') || keyOrUrl.startsWith('http://localhost') || keyOrUrl.startsWith('https://storage.edusaas.com/docs/placeholder')) {
      return keyOrUrl;
    }

    // Extract S3 key
    let s3Key = keyOrUrl;
    if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) {
      // Extract key from URL
      try {
        const urlObj = new URL(keyOrUrl);
        // Path might be /bucket/schools/... or /schools/...
        let pathname = decodeURIComponent(urlObj.pathname.replace(/^\//, ''));
        if (pathname.startsWith(`${s3Config.bucketName}/`)) {
          pathname = pathname.substring(s3Config.bucketName.length + 1);
        }
        s3Key = pathname;
      } catch {
        return keyOrUrl;
      }
    }

    if (s3Config.isConfigured) {
      try {
        const command = new GetObjectCommand({
          Bucket: s3Config.bucketName,
          Key: s3Key,
        });
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
        return presignedUrl;
      } catch (err: any) {
        console.warn(`[StorageService] Failed to generate presigned S3 URL (${err.message}), returning original URL.`);
      }
    }

    return keyOrUrl;
  }

  /**
   * Delete a document from S3 or local disk
   */
  async deleteDocument(keyOrUrl: string): Promise<boolean> {
    if (!keyOrUrl) return false;

    if (keyOrUrl.startsWith('/uploads/')) {
      try {
        const localPath = path.resolve(process.cwd(), keyOrUrl.replace(/^\//, ''));
        if (fs.existsSync(localPath)) {
          await fs.promises.unlink(localPath);
        }
        return true;
      } catch (err) {
        console.warn('[StorageService] Failed to delete local file:', err);
        return false;
      }
    }

    if (s3Config.isConfigured) {
      try {
        let s3Key = keyOrUrl;
        if (keyOrUrl.startsWith('http')) {
          const urlObj = new URL(keyOrUrl);
          let pathname = decodeURIComponent(urlObj.pathname.replace(/^\//, ''));
          if (pathname.startsWith(`${s3Config.bucketName}/`)) {
            pathname = pathname.substring(s3Config.bucketName.length + 1);
          }
          s3Key = pathname;
        }

        await s3Client.send(new DeleteObjectCommand({
          Bucket: s3Config.bucketName,
          Key: s3Key,
        }));
        return true;
      } catch (err: any) {
        console.warn('[StorageService] Failed to delete S3 object:', err);
        return false;
      }
    }

    return true;
  }
}

export const storageService = new StorageService();
