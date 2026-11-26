import { prisma } from '../config/database';
import bcrypt from 'bcryptjs';

async function check() {
  const users = await prisma.schoolUser.findMany();
  for (const u of users) {
    const isOakridge = await bcrypt.compare('OakridgeAdmin@2026!', u.passwordHash);
    const isOffice = await bcrypt.compare('OfficeAdmin@2026!', u.passwordHash);
    const isMaster = await bcrypt.compare('HeadMaster@2026!', u.passwordHash);
    const isTeacher = await bcrypt.compare('Teacher@2026!', u.passwordHash);
    const isPass2026 = await bcrypt.compare('Password@2026!', u.passwordHash);
    console.log(u.email, u.role, { isOakridge, isOffice, isMaster, isTeacher, isPass2026 });
  }
}
check().finally(() => prisma.$disconnect());
