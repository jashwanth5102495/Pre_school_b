import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, 'Reset token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(1, 'Invitation token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').optional(),
});
