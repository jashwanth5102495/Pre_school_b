"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schoolFeatureOverrideSchema = exports.createFeatureSchema = exports.updatePlatformUserStatusSchema = exports.createPlatformUserSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.createPlatformUserSchema = zod_1.z.object({
    email: zod_1.z.string().email('Valid email address required'),
    fullName: zod_1.z.string().min(2, 'Full name must be at least 2 characters'),
    phone: zod_1.z.string().optional(),
    role: zod_1.z.nativeEnum(client_1.PlatformRole),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters long'),
});
exports.updatePlatformUserStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.UserStatus),
});
exports.createFeatureSchema = zod_1.z.object({
    code: zod_1.z.string().min(2).toLowerCase(),
    name: zod_1.z.string().min(2),
    description: zod_1.z.string().min(5),
    category: zod_1.z.string().min(2),
    defaultEnabled: zod_1.z.boolean().default(true),
});
exports.schoolFeatureOverrideSchema = zod_1.z.object({
    schoolId: zod_1.z.string().uuid(),
    featureCode: zod_1.z.string().min(2),
    isEnabled: zod_1.z.boolean(),
    reason: zod_1.z.string().optional(),
    validUntil: zod_1.z.string().optional(),
});
