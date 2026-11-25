import { z } from 'zod';
import { NotificationTargetType, NotificationSeverity } from '@prisma/client';

export const createNotificationSchema = z.object({
  targetType: z.nativeEnum(NotificationTargetType),
  targetSchoolId: z.string().uuid().optional(),
  targetPlanId: z.string().uuid().optional(),
  title: z.string().min(3, 'Title is required'),
  message: z.string().min(5, 'Message is required'),
  severity: z.nativeEnum(NotificationSeverity).default(NotificationSeverity.INFO),
  channels: z.string().default('IN_APP'),
});
