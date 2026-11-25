"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acceptInvitationSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Please enter a valid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
exports.forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Please enter a valid email address'),
});
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Reset token is required'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters long'),
});
exports.acceptInvitationSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Invitation token is required'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters long'),
    fullName: zod_1.z.string().min(2, 'Full name must be at least 2 characters').optional(),
});
