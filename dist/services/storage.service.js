"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageService = exports.StorageService = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const s3_config_1 = require("../config/s3.config");
class StorageService {
    localUploadDir = path_1.default.resolve(process.cwd(), 'uploads/documents');
    constructor() {
        // Ensure local fallback folder exists
        if (!fs_1.default.existsSync(this.localUploadDir)) {
            fs_1.default.mkdirSync(this.localUploadDir, { recursive: true });
        }
    }
    /**
     * Upload a student document to S3 (Railway S3 or AWS S3), with seamless local fallback
     */
    async uploadStudentDocument(params) {
        const { schoolId, studentId, documentType, originalFilename, buffer, mimetype, size } = params;
        // Sanitize filename
        const sanitizedExt = path_1.default.extname(originalFilename).toLowerCase() || '.bin';
        const baseName = path_1.default.basename(originalFilename, sanitizedExt).replace(/[^a-zA-Z0-9_-]/g, '_');
        const timestamp = Date.now();
        const finalFilename = `${timestamp}_${baseName}${sanitizedExt}`;
        // S3 Key Structure: schools/<schoolId>/students/<studentId>/<documentType>/<filename>
        const s3Key = `schools/${schoolId}/students/${studentId}/${documentType}/${finalFilename}`;
        // Attempt S3 upload if configured
        if (s3_config_1.s3Config.isConfigured) {
            try {
                console.log(`[StorageService] Uploading document to S3 (Bucket: ${s3_config_1.s3Config.bucketName}, Key: ${s3Key})...`);
                const command = new client_s3_1.PutObjectCommand({
                    Bucket: s3_config_1.s3Config.bucketName,
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
                await s3_config_1.s3Client.send(command);
                // Build file URL
                let fileUrl;
                if (s3_config_1.s3Config.publicUrl) {
                    fileUrl = `${s3_config_1.s3Config.publicUrl.replace(/\/$/, '')}/${s3Key}`;
                }
                else if (s3_config_1.s3Config.endpoint) {
                    fileUrl = `${s3_config_1.s3Config.endpoint.replace(/\/$/, '')}/${s3_config_1.s3Config.bucketName}/${s3Key}`;
                }
                else {
                    fileUrl = `https://${s3_config_1.s3Config.bucketName}.s3.${s3_config_1.s3Config.region}.amazonaws.com/${s3Key}`;
                }
                console.log(`[StorageService] S3 upload successful. URL: ${fileUrl}`);
                return {
                    fileUrl,
                    key: s3Key,
                    size,
                    storage: 'S3',
                    mimetype,
                };
            }
            catch (s3Error) {
                console.warn(`[StorageService] S3 upload failed (${s3Error.message}), falling back to local storage.`);
            }
        }
        else {
            console.log('[StorageService] S3 credentials not configured for remote cloud, using local storage.');
        }
        // Local Disk Fallback
        const targetDir = path_1.default.join(this.localUploadDir, schoolId, studentId, documentType);
        if (!fs_1.default.existsSync(targetDir)) {
            fs_1.default.mkdirSync(targetDir, { recursive: true });
        }
        const localFilePath = path_1.default.join(targetDir, finalFilename);
        await fs_1.default.promises.writeFile(localFilePath, buffer);
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
    async getDocumentViewUrl(keyOrUrl, expiresInSeconds = 3600) {
        if (!keyOrUrl)
            return '';
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
                if (pathname.startsWith(`${s3_config_1.s3Config.bucketName}/`)) {
                    pathname = pathname.substring(s3_config_1.s3Config.bucketName.length + 1);
                }
                s3Key = pathname;
            }
            catch {
                return keyOrUrl;
            }
        }
        if (s3_config_1.s3Config.isConfigured) {
            try {
                const command = new client_s3_1.GetObjectCommand({
                    Bucket: s3_config_1.s3Config.bucketName,
                    Key: s3Key,
                });
                const presignedUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3_config_1.s3Client, command, { expiresIn: expiresInSeconds });
                return presignedUrl;
            }
            catch (err) {
                console.warn(`[StorageService] Failed to generate presigned S3 URL (${err.message}), returning original URL.`);
            }
        }
        return keyOrUrl;
    }
    /**
     * Delete a document from S3 or local disk
     */
    async deleteDocument(keyOrUrl) {
        if (!keyOrUrl)
            return false;
        if (keyOrUrl.startsWith('/uploads/')) {
            try {
                const localPath = path_1.default.resolve(process.cwd(), keyOrUrl.replace(/^\//, ''));
                if (fs_1.default.existsSync(localPath)) {
                    await fs_1.default.promises.unlink(localPath);
                }
                return true;
            }
            catch (err) {
                console.warn('[StorageService] Failed to delete local file:', err);
                return false;
            }
        }
        if (s3_config_1.s3Config.isConfigured) {
            try {
                let s3Key = keyOrUrl;
                if (keyOrUrl.startsWith('http')) {
                    const urlObj = new URL(keyOrUrl);
                    let pathname = decodeURIComponent(urlObj.pathname.replace(/^\//, ''));
                    if (pathname.startsWith(`${s3_config_1.s3Config.bucketName}/`)) {
                        pathname = pathname.substring(s3_config_1.s3Config.bucketName.length + 1);
                    }
                    s3Key = pathname;
                }
                await s3_config_1.s3Client.send(new client_s3_1.DeleteObjectCommand({
                    Bucket: s3_config_1.s3Config.bucketName,
                    Key: s3Key,
                }));
                return true;
            }
            catch (err) {
                console.warn('[StorageService] Failed to delete S3 object:', err);
                return false;
            }
        }
        return true;
    }
}
exports.StorageService = StorageService;
exports.storageService = new StorageService();
