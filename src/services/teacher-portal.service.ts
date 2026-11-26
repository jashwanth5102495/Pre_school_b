import { prisma } from '../config/database';
import { AttendanceStatus, LeaveStatus, MarksStatus } from '@prisma/client';

export class TeacherPortalService {
  async getTeacherByUserId(schoolId: string, userId: string, userEmail?: string) {
    let teacher = await prisma.teacher.findFirst({
      where: { schoolId, userId },
    });

    if (!teacher && userEmail) {
      teacher = await prisma.teacher.findFirst({
        where: { schoolId, email: userEmail },
      });
      if (teacher && !teacher.userId) {
        // Link it now
        await prisma.teacher.update({
          where: { id: teacher.id },
          data: { userId },
        });
      }
    }

    if (!teacher) {
      // Auto-create teacher profile on the fly if user has TEACHER role
      const user = await prisma.schoolUser.findUnique({ where: { id: userId } });
      const nameParts = (user?.fullName || 'Faculty Teacher').trim().split(' ');
      const firstName = nameParts[0] || 'Teacher';
      const lastName = nameParts.slice(1).join(' ') || 'Faculty';
      teacher = await prisma.teacher.create({
        data: {
          schoolId,
          userId,
          teacherCode: `TCH-${Math.floor(100 + Math.random() * 900)}`,
          firstName,
          lastName,
          email: userEmail || user?.email || `teacher-${userId.slice(0, 4)}@school.local`,
          phone: user?.phone || null,
          designation: 'Faculty Teacher',
        },
      });
    }

    return teacher;
  }

  async getDashboard(schoolId: string, teacherId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const currentDay = days[today.getDay()];

    const [teacher, allocations, todayPeriods, leaveBalances, activeHomework, pendingSubmissions] =
      await Promise.all([
        prisma.teacher.findUnique({
          where: { id: teacherId },
        }),
        prisma.teacherAllocation.findMany({
          where: { schoolId, teacherId },
          include: { class: true, section: true, subject: true },
        }),
        prisma.timetablePeriod.findMany({
          where: { schoolId, teacherId, dayOfWeek: currentDay },
          include: { class: true, section: true, subject: true },
          orderBy: { periodNumber: 'asc' },
        }),
        prisma.leaveBalance.findMany({
          where: { schoolId, teacherId },
          include: { leaveType: true },
        }),
        prisma.homework.count({
          where: { schoolId, teacherId, dueDate: { gte: today } },
        }),
        prisma.marksSubmission.count({
          where: { schoolId, teacherId, status: MarksStatus.SUBMITTED },
        }),
      ]);

    // Check attendance status for assigned classes where teacher is class teacher
    const classTeacherAllocations = allocations.filter((a) => a.isClassTeacher);
    const attendanceStatus = [];

    for (const alloc of classTeacherAllocations) {
      const session = await prisma.attendanceSession.findFirst({
        where: {
          schoolId,
          classId: alloc.classId,
          sectionId: alloc.sectionId,
          date: { gte: today, lt: tomorrow },
        },
        include: { records: true },
      });

      attendanceStatus.push({
        classId: alloc.classId,
        sectionId: alloc.sectionId,
        className: alloc.class.name,
        sectionName: alloc.section.name,
        isMarked: !!session,
        studentsCount: session ? session.records.length : 0,
        presentCount: session
          ? session.records.filter((r) => r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE).length
          : 0,
      });
    }

    return {
      teacher,
      allocations,
      todaySchedule: todayPeriods,
      leaveBalances,
      metrics: {
        totalAllocations: allocations.length,
        todayPeriodsCount: todayPeriods.length,
        activeHomeworkCount: activeHomework,
        pendingMarksReviewsCount: pendingSubmissions,
      },
      classTeacherAttendance: attendanceStatus,
    };
  }

  // Assigned Classes & Subjects
  async getAssignedClasses(schoolId: string, teacherId: string) {
    const allocations = await prisma.teacherAllocation.findMany({
      where: { schoolId, teacherId },
      include: {
        class: true,
        section: {
          include: {
            _count: { select: { students: true } },
          },
        },
        subject: true,
      },
      orderBy: [{ class: { code: 'asc' } }, { section: { name: 'asc' } }],
    });

    if (allocations.length > 0) {
      return allocations;
    }

    // Fallback: If no explicit allocations yet, load all school classes & sections
    // so faculty can immediately take attendance, add students, and evaluate marks
    const schoolClasses = await prisma.schoolClass.findMany({
      where: { schoolId },
      include: {
        sections: {
          include: {
            _count: { select: { students: true } },
          },
        },
        classSubjects: {
          include: { subject: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    const fallback: any[] = [];
    for (const cls of schoolClasses) {
      for (const sec of cls.sections) {
        fallback.push({
          id: `auto-${cls.id}-${sec.id}`,
          schoolId,
          teacherId,
          classId: cls.id,
          sectionId: sec.id,
          subjectId: cls.classSubjects[0]?.subjectId || null,
          isClassTeacher: true,
          class: cls,
          section: sec,
          subject: cls.classSubjects[0]?.subject || { id: 'gen', name: 'General', code: 'GEN' },
        });
      }
    }

    return fallback;
  }

  async getDefaultSectionForClass(schoolId: string, classId: string) {
    let section = await prisma.schoolSection.findFirst({
      where: { schoolId, classId },
      orderBy: { name: 'asc' },
    });
    if (!section) {
      section = await prisma.schoolSection.create({
        data: {
          schoolId,
          classId,
          name: 'Section A',
          capacity: 40,
        },
      });
    }
    return section;
  }

  // Attendance Taking
  async getAttendanceSession(
    schoolId: string,
    teacherId: string,
    query: { classId: string; sectionId: string; date?: string }
  ) {
    const targetDate = query.date ? new Date(query.date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    // Get all students enrolled in this section
    let students = await prisma.student.findMany({
      where: { schoolId, classId: query.classId, sectionId: query.sectionId, status: 'ACTIVE' },
      orderBy: { studentCode: 'asc' },
    });

    // If no students in this specific section, fallback to students in class
    if (students.length === 0) {
      students = await prisma.student.findMany({
        where: { schoolId, classId: query.classId, status: 'ACTIVE' },
        orderBy: { studentCode: 'asc' },
      });
    }

    // If still no students, fallback to all active students in the school
    if (students.length === 0) {
      students = await prisma.student.findMany({
        where: { schoolId, status: 'ACTIVE' },
        orderBy: { studentCode: 'asc' },
      });
    }

    // Check existing session
    const existingSession = await prisma.attendanceSession.findFirst({
      where: {
        schoolId,
        classId: query.classId,
        sectionId: query.sectionId,
        date: { gte: targetDate, lt: nextDate },
      },
      include: { records: true },
    });

    const recordsMap = new Map();
    if (existingSession) {
      existingSession.records.forEach((r) => recordsMap.set(r.studentId, r));
    }

    const roster = students.map((stu) => {
      const rec = recordsMap.get(stu.id);
      return {
        studentId: stu.id,
        studentCode: stu.studentCode,
        admissionNo: stu.admissionNo,
        firstName: stu.firstName,
        lastName: stu.lastName,
        gender: stu.gender,
        status: rec ? rec.status : AttendanceStatus.PRESENT,
        remarks: rec ? rec.remarks : '',
      };
    });

    return {
      date: targetDate,
      classId: query.classId,
      sectionId: query.sectionId,
      isMarked: !!existingSession,
      sessionId: existingSession?.id || null,
      studentsCount: students.length,
      roster,
    };
  }

  async markAttendance(
    schoolId: string,
    teacherId: string,
    data: {
      classId: string;
      sectionId: string;
      date?: string;
      records: Array<{ studentId: string; status: AttendanceStatus; remarks?: string }>;
    }
  ) {
    const targetDate = data.date ? new Date(data.date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const currentYear = await prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
    });
    if (!currentYear) throw new Error('Active academic year not found');

    // Upsert AttendanceSession
    const session = await prisma.attendanceSession.upsert({
      where: {
        schoolId_classId_sectionId_date: {
          schoolId,
          classId: data.classId,
          sectionId: data.sectionId,
          date: targetDate,
        },
      },
      update: {
        takenById: teacherId,
      },
      create: {
        schoolId,
        academicYearId: currentYear.id,
        classId: data.classId,
        sectionId: data.sectionId,
        date: targetDate,
        takenById: teacherId,
      },
    });

    // Save student records
    for (const record of data.records) {
      await prisma.studentAttendance.upsert({
        where: {
          sessionId_studentId: {
            sessionId: session.id,
            studentId: record.studentId,
          },
        },
        update: {
          status: record.status,
          remarks: record.remarks || null,
        },
        create: {
          schoolId,
          sessionId: session.id,
          studentId: record.studentId,
          status: record.status,
          remarks: record.remarks || null,
        },
      });
    }

    const presentCount = data.records.filter(
      (r) => r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE
    ).length;
    const absentCount = data.records.filter((r) => r.status === AttendanceStatus.ABSENT).length;

    return {
      sessionId: session.id,
      date: targetDate,
      totalMarked: data.records.length,
      presentCount,
      absentCount,
      attendancePercentage:
        data.records.length > 0 ? Math.round((presentCount / data.records.length) * 100) : 0,
    };
  }

  // Internal Marks Entry
  async getExamSubjectsForTeacher(schoolId: string, teacherId: string) {
    const allocations = await prisma.teacherAllocation.findMany({
      where: { schoolId, teacherId },
      select: { classId: true, subjectId: true },
    });

    const classIds = Array.from(new Set(allocations.map((a) => a.classId)));
    const subjectIds = Array.from(new Set(allocations.map((a) => a.subjectId)));

    return prisma.examinationSubject.findMany({
      where: {
        schoolId,
        classId: { in: classIds },
        subjectId: { in: subjectIds },
      },
      include: {
        exam: true,
        class: true,
        subject: true,
        submissions: {
          where: { teacherId },
          take: 1,
        },
      },
      orderBy: { examDate: 'desc' },
    });
  }

  async getMarksSheet(schoolId: string, teacherId: string, examSubjectId: string) {
    const examSubject = await prisma.examinationSubject.findFirst({
      where: { id: examSubjectId, schoolId },
      include: {
        exam: true,
        class: true,
        subject: true,
        submissions: {
          where: { teacherId },
          take: 1,
        },
      },
    });

    if (!examSubject) throw new Error('Examination subject not found');

    const students = await prisma.student.findMany({
      where: { schoolId, classId: examSubject.classId, status: 'ACTIVE' },
      include: { section: true },
      orderBy: { studentCode: 'asc' },
    });

    const existingMarks = await prisma.studentMarks.findMany({
      where: { schoolId, examSubjectId },
    });

    const marksMap = new Map();
    existingMarks.forEach((m) => marksMap.set(m.studentId, m));

    const roster = students.map((stu) => {
      const m = marksMap.get(stu.id);
      return {
        studentId: stu.id,
        studentCode: stu.studentCode,
        admissionNo: stu.admissionNo,
        studentName: `${stu.firstName} ${stu.lastName}`,
        sectionName: stu.section?.name || 'A',
        marksObtained: m ? m.marksObtained : '',
        grade: m ? m.grade : '',
        remarks: m ? m.remarks : '',
        status: m ? m.status : MarksStatus.DRAFT,
      };
    });

    return {
      examSubject,
      submission: examSubject.submissions[0] || null,
      studentsCount: students.length,
      roster,
    };
  }

  async saveMarks(
    schoolId: string,
    teacherId: string,
    data: {
      examSubjectId: string;
      marks: Array<{ studentId: string; marksObtained: number; remarks?: string }>;
      submitForReview?: boolean;
      comments?: string;
    }
  ) {
    const examSubject = await prisma.examinationSubject.findFirst({
      where: { id: data.examSubjectId, schoolId },
    });
    if (!examSubject) throw new Error('Examination subject not found');

    const markStatus = data.submitForReview ? MarksStatus.SUBMITTED : MarksStatus.DRAFT;

    for (const item of data.marks) {
      const score = parseFloat(item.marksObtained as any);
      const pct = (score / examSubject.maxMarks) * 100;
      let grade = 'F';
      if (pct >= 90) grade = 'A+';
      else if (pct >= 80) grade = 'A';
      else if (pct >= 70) grade = 'B+';
      else if (pct >= 60) grade = 'B';
      else if (pct >= 50) grade = 'C';
      else if (pct >= 35) grade = 'D';

      await prisma.studentMarks.upsert({
        where: {
          examSubjectId_studentId: {
            examSubjectId: examSubject.id,
            studentId: item.studentId,
          },
        },
        update: {
          marksObtained: score,
          grade,
          remarks: item.remarks || null,
          status: markStatus,
        },
        create: {
          schoolId,
          examSubjectId: examSubject.id,
          studentId: item.studentId,
          marksObtained: score,
          grade,
          remarks: item.remarks || null,
          status: markStatus,
        },
      });
    }

    if (data.submitForReview) {
      await prisma.marksSubmission.create({
        data: {
          schoolId,
          examSubjectId: examSubject.id,
          teacherId,
          status: MarksStatus.SUBMITTED,
          comments: data.comments || 'Internal marks submitted for moderation',
        },
      });
    }

    return {
      savedCount: data.marks.length,
      status: markStatus,
      submittedForReview: !!data.submitForReview,
    };
  }

  // Teacher Timetable
  async getTimetable(schoolId: string, teacherId: string) {
    return prisma.timetablePeriod.findMany({
      where: { schoolId, teacherId },
      include: {
        class: true,
        section: true,
        subject: true,
      },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
    });
  }

  // Homework
  async getHomework(schoolId: string, teacherId: string) {
    return prisma.homework.findMany({
      where: { schoolId, teacherId },
      orderBy: { createdAt: 'desc' },
      include: {
        class: true,
        section: true,
        subject: true,
        _count: { select: { submissions: true } },
      },
    });
  }

  async createHomework(schoolId: string, teacherId: string, data: any) {
    return prisma.homework.create({
      data: {
        schoolId,
        teacherId,
        classId: data.classId,
        sectionId: data.sectionId,
        subjectId: data.subjectId,
        title: data.title,
        description: data.description,
        dueDate: new Date(data.dueDate),
        attachmentUrl: data.attachmentUrl || null,
      },
      include: {
        class: true,
        section: true,
        subject: true,
      },
    });
  }

  // Leave Applications
  async getMyLeaves(schoolId: string, teacherId: string) {
    const [balances, applications] = await Promise.all([
      prisma.leaveBalance.findMany({
        where: { schoolId, teacherId },
        include: { leaveType: true },
      }),
      prisma.leaveApplication.findMany({
        where: { schoolId, teacherId },
        orderBy: { createdAt: 'desc' },
        include: {
          leaveType: true,
          substituteTeacher: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    return { balances, applications };
  }

  async applyLeave(schoolId: string, teacherId: string, data: any) {
    return prisma.leaveApplication.create({
      data: {
        schoolId,
        teacherId,
        leaveTypeId: data.leaveTypeId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason,
        substituteTeacherId: data.substituteTeacherId || null,
        status: LeaveStatus.PENDING,
      },
      include: { leaveType: true },
    });
  }
}

export const teacherPortalService = new TeacherPortalService();
