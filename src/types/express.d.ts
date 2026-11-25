import { PlatformRole, SchoolRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: PlatformRole | SchoolRole;
        userType: 'PLATFORM' | 'SCHOOL';
        schoolId?: string;
        tenantId?: string;
      };
      tenantId?: string;
    }
  }
}
