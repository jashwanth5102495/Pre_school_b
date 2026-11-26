import { prisma } from '../config/database';
import { AttendanceStatus, FeeStatus, SchoolRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

export class SchoolAdminService {
  async getDashboardMetrics(schoolId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalStudents,
      totalTeachers,
      totalClasses,
      totalSections,
      activeAcademicYear,
      todayStudentAttendance,
      todayTeacherAttendance,
      feePaymentsAgg,
      pendingFeeAgg,
      totalAdmissions,
      recentAdmissions,
      recentTransactions,
      upcomingEvents,
      classesWithStrength,
    ] = await Promise.all([
      prisma.student.count({ where: { schoolId, status: 'ACTIVE' } }),
      prisma.teacher.count({ where: { schoolId, status: 'ACTIVE' } }),
      prisma.schoolClass.count({ where: { schoolId } }),
      prisma.schoolSection.count({ where: { schoolId } }),
      prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } }),
      prisma.studentAttendance.findMany({
        where: {
          schoolId,
          session: { date: { gte: today, lt: tomorrow } },
        },
        select: { status: true },
      }),
      prisma.teacherAttendance.findMany({
        where: {
          schoolId,
          date: { gte: today, lt: tomorrow },
        },
        select: { status: true },
      }),
      prisma.feePayment.aggregate({
        where: { schoolId },
        _sum: { amountPaid: true },
        _count: { id: true },
      }),
      prisma.studentFee.aggregate({
        where: { schoolId, status: { in: [FeeStatus.UNPAID, FeeStatus.PARTIAL, FeeStatus.OVERDUE] } },
        _sum: { balanceAmount: true },
      }),
      prisma.admissionApplication.count({ where: { schoolId } }),
      prisma.admissionApplication.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { applyingClass: { select: { name: true } } },
      }),
      prisma.feePayment.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          studentFee: {
            include: {
              student: { select: { firstName: true, lastName: true, studentCode: true } },
              feeStructure: { include: { category: true } },
            },
          },
        },
      }),
      prisma.academicEvent.findMany({
        where: { schoolId, startDate: { gte: today } },
        orderBy: { startDate: 'asc' },
        take: 5,
      }),
      prisma.schoolClass.findMany({
        where: { schoolId },
        include: {
          sections: {
            include: {
              _count: { select: { students: true } },
            },
          },
          _count: { select: { students: true } },
        },
      }),
    ]);

    const studentsPresent = todayStudentAttendance.filter(
      (a) => a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE
    ).length;
    const studentsAbsent = todayStudentAttendance.filter((a) => a.status === AttendanceStatus.ABSENT).length;
    const totalStudentAttendanceMarked = todayStudentAttendance.length;
    const studentAttendancePct =
      totalStudentAttendanceMarked > 0 ? Math.round((studentsPresent / totalStudentAttendanceMarked) * 100) : 0;

    const teachersPresent = todayTeacherAttendance.filter((a) => a.status === AttendanceStatus.PRESENT).length;
    const teachersAbsent = todayTeacherAttendance.filter((a) => a.status === AttendanceStatus.ABSENT).length;

    // Class-wise strength data
    const classDistribution = classesWithStrength.map((c) => ({
      classId: c.id,
      className: c.name,
      totalStudents: c._count.students,
      sections: c.sections.map((s) => ({
        sectionId: s.id,
        sectionName: s.name,
        studentsCount: s._count.students,
      })),
    }));

    return {
      summary: {
        totalStudents,
        totalTeachers,
        totalClasses,
        totalSections,
        activeAcademicYear: activeAcademicYear?.name || '2025-2026',
        studentsPresentToday: studentsPresent,
        studentsAbsentToday: studentsAbsent,
        studentAttendancePercentage: studentAttendancePct,
        teachersPresentToday: teachersPresent,
        teachersAbsentToday: teachersAbsent,
        totalFeeCollection: feePaymentsAgg._sum.amountPaid || 0,
        pendingFeeAmount: pendingFeeAgg._sum.balanceAmount || 0,
        totalAdmissions,
      },
      classDistribution,
      recentAdmissions,
      recentTransactions,
      upcomingEvents,
    };
  }

  async getStudents(
    schoolId: string,
    query: {
      search?: string;
      classId?: string;
      sectionId?: string;
      status?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const { search, classId, sectionId, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { schoolId };
    if (status) where.status = status;
    if (classId) where.classId = classId;
    if (sectionId) where.sectionId = sectionId;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { studentCode: { contains: search, mode: 'insensitive' } },
        { admissionNo: { contains: search, mode: 'insensitive' } },
        { parentName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          class: { select: { id: true, name: true, code: true } },
          section: { select: { id: true, name: true } },
        },
      }),
      prisma.student.count({ where }),
    ]);

    return {
      students,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStudentById(schoolId: string, studentId: string) {
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId },
      include: {
        class: true,
        section: true,
        attendances: {
          take: 30,
          orderBy: { createdAt: 'desc' },
          include: { session: true },
        },
        marks: {
          include: {
            examSubject: {
              include: {
                exam: true,
                subject: true,
              },
            },
          },
        },
        fees: {
          include: {
            feeStructure: { include: { category: true } },
            payments: { orderBy: { paymentDate: 'desc' } },
          },
        },
        documents: true,
        certificates: true,
      },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    return student;
  }

  async createStudent(schoolId: string, data: any) {
    const count = await prisma.student.count({ where: { schoolId } });
    const studentCode = data.studentCode || `STU-${String(count + 1).padStart(4, '0')}`;
    const admissionNo = data.admissionNo || `ADM-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    // Auto-resolve sectionId if only classId was provided
    let sectionId = data.sectionId;
    if (!sectionId && data.classId) {
      const firstSection = await prisma.schoolSection.findFirst({
        where: { schoolId, classId: data.classId },
      });
      if (firstSection) {
        sectionId = firstSection.id;
      }
    }

    return prisma.student.create({
      data: {
        schoolId,
        studentCode,
        admissionNo,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        phone: data.phone || null,
        gender: data.gender || null,
        dob: data.dob ? new Date(data.dob) : null,
        classId: data.classId || null,
        sectionId: sectionId || null,
        parentName: data.parentName || null,
        parentPhone: data.parentPhone || null,
        parentEmail: data.parentEmail || null,
        address: data.address || null,
        bloodGroup: data.bloodGroup || null,
        status: 'ACTIVE',
      },
    });
  }

  async updateStudent(schoolId: string, studentId: string, data: any) {
    const existing = await prisma.student.findFirst({
      where: { id: studentId, schoolId },
    });
    if (!existing) throw new Error('Student not found');

    return prisma.student.update({
      where: { id: studentId },
      data: {
        firstName: data.firstName ?? existing.firstName,
        lastName: data.lastName ?? existing.lastName,
        email: data.email ?? existing.email,
        phone: data.phone ?? existing.phone,
        gender: data.gender ?? existing.gender,
        dob: data.dob ? new Date(data.dob) : existing.dob,
        classId: data.classId ?? existing.classId,
        sectionId: data.sectionId ?? existing.sectionId,
        parentName: data.parentName ?? existing.parentName,
        parentPhone: data.parentPhone ?? existing.parentPhone,
        parentEmail: data.parentEmail ?? existing.parentEmail,
        address: data.address ?? existing.address,
        bloodGroup: data.bloodGroup ?? existing.bloodGroup,
        status: data.status ?? existing.status,
      },
    });
  }

  async getStaff(schoolId: string) {
    const [teachers, schoolUsers] = await Promise.all([
      prisma.teacher.findMany({
        where: { schoolId },
        include: {
          user: { select: { id: true, email: true, role: true, status: true, lastLoginAt: true } },
          allocations: {
            include: {
              class: { select: { name: true } },
              section: { select: { name: true } },
              subject: { select: { name: true } },
            },
          },
        },
      }),
      prisma.schoolUser.findMany({
        where: { schoolId },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          phone: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
    ]);

    return { teachers, schoolUsers };
  }

  async createStaff(schoolId: string, data: any) {
    const passwordHash = await bcrypt.hash(data.password || 'Staff@2026!', 12);
    const user = await prisma.schoolUser.create({
      data: {
        schoolId,
        email: data.email.toLowerCase().trim(),
        fullName: data.fullName,
        passwordHash,
        role: data.role as SchoolRole,
        phone: data.phone || null,
        status: UserStatus.ACTIVE,
      },
    });

    if (data.role === SchoolRole.TEACHER) {
      const teacherCount = await prisma.teacher.count({ where: { schoolId } });
      const teacherCode = data.teacherCode || `TCH-${String(teacherCount + 1).padStart(3, '0')}`;
      const nameParts = data.fullName.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      await prisma.teacher.create({
        data: {
          schoolId,
          userId: user.id,
          teacherCode,
          firstName,
          lastName,
          email: user.email,
          phone: user.phone,
          designation: data.designation || 'Faculty Teacher',
          qualification: data.qualification || null,
          specialization: data.specialization || null,
          joiningDate: new Date(),
          status: 'ACTIVE',
        },
      });
    }

    return user;
  }

  async getClasses(schoolId: string) {
    return prisma.schoolClass.findMany({
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
        _count: { select: { students: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async getFeesOverview(schoolId: string) {
    const [totalCollected, totalPending, structures, recentPayments] = await Promise.all([
      prisma.feePayment.aggregate({
        where: { schoolId },
        _sum: { amountPaid: true },
        _count: { id: true },
      }),
      prisma.studentFee.aggregate({
        where: { schoolId, status: { in: [FeeStatus.UNPAID, FeeStatus.PARTIAL, FeeStatus.OVERDUE] } },
        _sum: { balanceAmount: true },
      }),
      prisma.feeStructure.findMany({
        where: { schoolId },
        include: {
          category: true,
          class: true,
          _count: { select: { studentFees: true } },
        },
      }),
      prisma.feePayment.findMany({
        where: { schoolId },
        take: 10,
        orderBy: { paymentDate: 'desc' },
        include: {
          studentFee: {
            include: {
              student: { select: { firstName: true, lastName: true, studentCode: true } },
              feeStructure: { include: { category: true } },
            },
          },
        },
      }),
    ]);

    return {
      totalCollected: totalCollected._sum.amountPaid || 0,
      totalPending: totalPending._sum.balanceAmount || 0,
      paymentCount: totalCollected._count.id || 0,
      structures,
      recentPayments,
    };
  }

  async getAttendanceOverview(schoolId: string, dateStr?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const sessions = await prisma.attendanceSession.findMany({
      where: {
        schoolId,
        date: { gte: targetDate, lt: nextDate },
      },
      include: {
        class: true,
        section: true,
        records: {
          select: { status: true },
        },
      },
    });

    const breakdown = sessions.map((s) => {
      const present = s.records.filter((r) => r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE).length;
      const absent = s.records.filter((r) => r.status === AttendanceStatus.ABSENT).length;
      const total = s.records.length;
      return {
        sessionId: s.id,
        className: s.class.name,
        sectionName: s.section.name,
        present,
        absent,
        total,
        percentage: total > 0 ? Math.round((present / total) * 100) : 0,
      };
    });

    return {
      date: targetDate,
      sessionsCount: sessions.length,
      breakdown,
    };
  }

  async getSchoolProfile(schoolId: string) {
    return prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        profile: true,
        subscription: { include: { plan: true } },
      },
    });
  }

  async updateSchoolProfile(schoolId: string, data: any) {
    if (data.name) {
      await prisma.school.update({
        where: { id: schoolId },
        data: { name: data.name, website: data.website, logoUrl: data.logoUrl },
      });
    }

    if (data.profile) {
      await prisma.schoolProfile.upsert({
        where: { schoolId },
        update: data.profile,
        create: { ...data.profile, schoolId },
      });
    }

    return this.getSchoolProfile(schoolId);
  }
}

export const schoolAdminService = new SchoolAdminService();
