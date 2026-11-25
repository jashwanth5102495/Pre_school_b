import { prisma } from '../config/database';

export async function generateUniqueSchoolId(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `SCH-${currentYear}-`;

  const lastSchool = await prisma.school.findFirst({
    where: {
      schoolId: {
        startsWith: prefix,
      },
    },
    orderBy: {
      schoolId: 'desc',
    },
    select: {
      schoolId: true,
    },
  });

  if (!lastSchool) {
    return `${prefix}0001`;
  }

  const parts = lastSchool.schoolId.split('-');
  const lastNumber = parseInt(parts[2], 10);
  const nextNumber = isNaN(lastNumber) ? 1 : lastNumber + 1;
  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}
