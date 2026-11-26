import { prisma } from '../config/database';

async function main() {
  const users = await prisma.schoolUser.findMany({
    select: { id: true, email: true, fullName: true, role: true, schoolId: true }
  });
  console.log('=== School Users in DB ===');
  console.table(users);

  const teachers = await prisma.teacher.findMany({
    include: { user: true }
  });
  console.log('=== Teachers in DB ===');
  console.table(teachers.map(t => ({
    id: t.id,
    code: t.teacherCode,
    name: `${t.firstName} ${t.lastName}`,
    email: t.email,
    userId: t.userId,
    userRole: t.user?.role
  })));

  const allocations = await prisma.teacherAllocation.findMany({
    include: {
      teacher: true,
      class: true,
      section: true,
      subject: true
    }
  });
  console.log('=== Teacher Allocations ===');
  console.table(allocations.map(a => ({
    id: a.id,
    teacher: `${a.teacher.firstName} ${a.teacher.lastName}`,
    class: a.class.name,
    classId: a.classId,
    section: a.section.name,
    sectionId: a.sectionId,
    subject: a.subject.name
  })));

  const students = await prisma.student.findMany({
    include: { class: true, section: true }
  });
  console.log('=== Students in DB ===');
  console.table(students.map(st => ({
    id: st.id,
    name: `${st.firstName} ${st.lastName}`,
    admissionNumber: st.admissionNumber,
    class: st.class?.name,
    classId: st.classId,
    section: st.section?.name,
    sectionId: st.sectionId
  })));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
