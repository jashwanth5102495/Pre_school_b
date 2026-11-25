"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const auth_service_1 = require("../services/auth.service");
const response_1 = require("../utils/response");
const auth_validator_1 = require("../validators/auth.validator");
class AuthController {
    async login(req, res, next) {
        try {
            const validated = auth_validator_1.loginSchema.parse(req.body);
            const ipAddress = req.ip || req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];
            const result = await auth_service_1.authService.login(validated.email, validated.password, ipAddress, userAgent);
            // Set HttpOnly refresh token cookie
            res.cookie('refreshToken', result.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            });
            return (0, response_1.successResponse)(res, result, 'Login successful');
        }
        catch (err) {
            if (err.name === 'ZodError')
                return next(err);
            return (0, response_1.errorResponse)(res, err.message, 401, 'AUTHENTICATION_FAILED');
        }
    }
    async refresh(req, res, next) {
        try {
            const token = req.cookies?.refreshToken || req.body?.refreshToken;
            if (!token) {
                return (0, response_1.errorResponse)(res, 'Refresh token missing', 401, 'TOKEN_MISSING');
            }
            const result = await auth_service_1.authService.rotateRefreshToken(token);
            res.cookie('refreshToken', result.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });
            return (0, response_1.successResponse)(res, result, 'Token refreshed successfully');
        }
        catch (err) {
            res.clearCookie('refreshToken');
            return (0, response_1.errorResponse)(res, err.message, 401, 'REFRESH_FAILED');
        }
    }
    async logout(req, res, next) {
        try {
            const token = req.cookies?.refreshToken || req.body?.refreshToken;
            await auth_service_1.authService.logout(token);
            res.clearCookie('refreshToken');
            return (0, response_1.successResponse)(res, null, 'Logged out successfully');
        }
        catch (err) {
            next(err);
        }
    }
    async me(req, res, next) {
        try {
            if (!req.user) {
                return (0, response_1.errorResponse)(res, 'Not authenticated', 401, 'UNAUTHORIZED');
            }
            const user = await auth_service_1.authService.getCurrentUser(req.user.userId, req.user.userType);
            return (0, response_1.successResponse)(res, user);
        }
        catch (err) {
            return (0, response_1.errorResponse)(res, err.message, 404, 'USER_NOT_FOUND');
        }
    }
    async forgotPassword(req, res, next) {
        try {
            const validated = auth_validator_1.forgotPasswordSchema.parse(req.body);
            const result = await auth_service_1.authService.forgotPassword(validated.email);
            return (0, response_1.successResponse)(res, result, 'Password reset instructions have been generated');
        }
        catch (err) {
            next(err);
        }
    }
    async resetPassword(req, res, next) {
        try {
            const validated = auth_validator_1.resetPasswordSchema.parse(req.body);
            const result = await auth_service_1.authService.resetPassword(validated.token, validated.password);
            return (0, response_1.successResponse)(res, result, 'Password has been successfully updated');
        }
        catch (err) {
            return (0, response_1.errorResponse)(res, err.message, 400, 'RESET_FAILED');
        }
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
