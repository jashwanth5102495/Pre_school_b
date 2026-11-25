"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotificationSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.createNotificationSchema = zod_1.z.object({
    targetType: zod_1.z.nativeEnum(client_1.NotificationTargetType),
    targetSchoolId: zod_1.z.string().uuid().optional(),
    targetPlanId: zod_1.z.string().uuid().optional(),
    title: zod_1.z.string().min(3, 'Title is required'),
    message: zod_1.z.string().min(5, 'Message is required'),
    severity: zod_1.z.nativeEnum(client_1.NotificationSeverity).default(client_1.NotificationSeverity.INFO),
    channels: zod_1.z.string().default('IN_APP'),
});
