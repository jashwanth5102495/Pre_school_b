import { z } from 'zod';
import { PlatformRole, UserStatus } from '@prisma/client';

export const createPlatformUserSchema = z.object({
  email: z.string().email('Valid email address required'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().optional(),
  role: z.nativeEnum(PlatformRole),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export const updatePlatformUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

export const createFeatureSchema = z.object({
  code: z.string().min(2).toLowerCase(),
  name: z.string().min(2),
  description: z.string().min(5),
  category: z.string().min(2),
  defaultEnabled: z.boolean().default(true),
});

export const schoolFeatureOverrideSchema = z.object({
  schoolId: z.string().uuid(),
  featureCode: z.string().min(2),
  isEnabled: z.boolean(),
  reason: z.string().optional(),
  validUntil: z.string().optional(),
});
