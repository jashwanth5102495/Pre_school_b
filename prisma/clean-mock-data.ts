import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanMockData() {
  console.log('--- CLEANING MOCK DUMMY DATA ACROSS ALL 5 PORTALS ---');

  // 1. Delete student attendances and sessions
  await prisma.studentAttendance.deleteMany({});
  await prisma.teacherAttendance.deleteMany({});
  await prisma.attendanceSession.deleteMany({});
  console.log('✓ Cleared mock attendance records');

  // 2. Delete marks, grading, and examinations
  await prisma.studentMarks.deleteMany({});
  await prisma.examination.deleteMany({});
  console.log('✓ Cleared mock examinations & marks');

  // 3. Delete fee payments, student fees, and fee structures instances
  await prisma.feePayment.deleteMany({});
  await prisma.studentFee.deleteMany({});
  console.log('✓ Cleared mock fee collections and student fees');

  // 4. Delete admission applications & student documents & certificates
  await prisma.certificate.deleteMany({});
  await prisma.studentDocument.deleteMany({});
  await prisma.admissionApplication.deleteMany({});
  await prisma.homeworkSubmission.deleteMany({});
  await prisma.homework.deleteMany({});
  await prisma.marksSubmission.deleteMany({});
  await prisma.examinationSubject.deleteMany({});
  await prisma.attendanceCorrectionRequest.deleteMany({});
  console.log('✓ Cleared mock admission applications, certificates & student documents');

  // 5. Delete teacher leaves
  await prisma.leaveApplication.deleteMany({});
  console.log('✓ Cleared mock teacher leaves');

  // 6. Delete academic events & calendar notices
  await prisma.academicEvent.deleteMany({});
  console.log('✓ Cleared mock academic events');

  // 7. Delete timetable periods & teacher allocations
  await prisma.timetablePeriod.deleteMany({});
  await prisma.teacherAllocation.deleteMany({});
  console.log('✓ Cleared mock timetable & teacher allocations');

  // 8. Delete all dummy students
  await prisma.student.deleteMany({});
  console.log('✓ Cleared mock student rosters');

  // 9. Remove extra dummy schools (keep only the primary Oakridge school for role auto-fill)
  const extraSchools = await prisma.school.findMany({
    where: {
      schoolId: { in: ['SCH-DPA-2026', 'SCH-GWH-2026', 'SCH-SXI-2026'] },
    },
    select: { id: true },
  });

  for (const s of extraSchools) {
    await prisma.invoice.deleteMany({ where: { schoolId: s.id } });
    await prisma.payment.deleteMany({ where: { schoolId: s.id } });
    await prisma.subscription.deleteMany({ where: { schoolId: s.id } });
    await prisma.schoolUser.deleteMany({ where: { schoolId: s.id } });
    await prisma.schoolProfile.deleteMany({ where: { schoolId: s.id } });
    await prisma.school.delete({ where: { id: s.id } });
  }
  console.log('✓ Cleared extra dummy schools');

  // 10. Delete dummy payments and invoices on the primary school to have 0 mock revenue
  await prisma.invoice.deleteMany({});
  await prisma.payment.deleteMany({});
  console.log('✓ Cleared mock platform payments & revenue history');

  // 11. Delete dummy audit logs that reference dummy operations
  await prisma.auditLog.deleteMany({});
  console.log('✓ Reset platform audit logs');

  console.log('--- ALL MOCK DUMMY DATA SUCCESSFULLY REMOVED ---');
  await prisma.$disconnect();
}

cleanMockData().catch((e) => {
  console.error('Error cleaning mock data:', e);
  process.exit(1);
});
