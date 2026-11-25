import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { successResponse, errorResponse } from '../utils/response';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../validators/auth.validator';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = loginSchema.parse(req.body);
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.login(validated.email, validated.password, ipAddress, userAgent);

      // Set HttpOnly refresh token cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return successResponse(res, result, 'Login successful');
    } catch (err: any) {
      if (err.name === 'ZodError') return next(err);
      return errorResponse(res, err.message, 401, 'AUTHENTICATION_FAILED');
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.refreshToken || req.body?.refreshToken;
      if (!token) {
        return errorResponse(res, 'Refresh token missing', 401, 'TOKEN_MISSING');
      }

      const result = await authService.rotateRefreshToken(token);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return successResponse(res, result, 'Token refreshed successfully');
    } catch (err: any) {
      res.clearCookie('refreshToken');
      return errorResponse(res, err.message, 401, 'REFRESH_FAILED');
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.refreshToken || req.body?.refreshToken;
      await authService.logout(token);
      res.clearCookie('refreshToken');
      return successResponse(res, null, 'Logged out successfully');
    } catch (err) {
      next(err);
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return errorResponse(res, 'Not authenticated', 401, 'UNAUTHORIZED');
      }
      const user = await authService.getCurrentUser(req.user.userId, req.user.userType);
      return successResponse(res, user);
    } catch (err: any) {
      return errorResponse(res, err.message, 404, 'USER_NOT_FOUND');
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = forgotPasswordSchema.parse(req.body);
      const result = await authService.forgotPassword(validated.email);
      return successResponse(res, result, 'Password reset instructions have been generated');
    } catch (err) {
      next(err);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = resetPasswordSchema.parse(req.body);
      const result = await authService.resetPassword(validated.token, validated.password);
      return successResponse(res, result, 'Password has been successfully updated');
    } catch (err: any) {
      return errorResponse(res, err.message, 400, 'RESET_FAILED');
    }
  }
}

export const authController = new AuthController();
