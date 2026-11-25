"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDocumentMiddleware = void 0;
const multer_1 = __importDefault(require("multer"));
// Use Memory Storage so file buffers are kept in RAM and streamed directly to S3
const storage = multer_1.default.memoryStorage();
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed types: PDF, JPEG, PNG, WEBP, DOC, DOCX`));
    }
};
exports.uploadDocumentMiddleware = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 25 * 1024 * 1024, // 25 MB max file size
    },
    fileFilter,
});
