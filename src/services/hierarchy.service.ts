import { prisma } from '../config/database';
import { SchoolRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

export interface HierarchyMemberInput {
  schoolId: string;
  type: 'SCHOOL_ADMIN' | 'HEAD_MASTER' | 'OFFICE_ADMIN' | 'TEACHER' | 'STUDENT';
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  designation?: string;
  classId?: string;
  sectionId?: string;
  admissionNo?: string;
  studentCode?: string;
  teacherCode?: string;
}

export class HierarchyService {
  /**
   * Helper to ensure standard classes/sections exist for a school so allocations work
   */
  async ensureStarterClasses(schoolId: string) {
    const existingClasses = await prisma.schoolClass.findMany({ where: { schoolId } });
    if (existingClasses.length === 0) {
      const g10 = await prisma.schoolClass.create({
        data: {
          schoolId,
          name: 'Grade 10',
          code: 'G10',
          sections: {
            create: [
              { schoolId, name: 'Section A', capacity: 40 },
              { schoolId, name: 'Section B', capacity: 40 },
            ],
          },
        },
        include: { sections: true },
      });

      const g9 = await prisma.schoolClass.create({
        data: {
          schoolId,
          name: 'Grade 9',
          code: 'G9',
          sections: {
            create: [{ schoolId, name: 'Section A', capacity: 40 }],
          },
        },
        include: { sections: true },
      });

      return [g10, g9];
    }
    return existingClasses;
  }

  /**
   * Fetch hierarchical tree data tailored to the caller's role and permission scope
   */
  async getHierarchyTree(schoolId?: string, user?: any) {
    let targetSchoolId = schoolId;

    if (user?.userType === 'SCHOOL') {
      targetSchoolId = user.schoolId;
    }

    if (!targetSchoolId) {
      const firstSchool = await prisma.school.findFirst({
        where: { status: { not: 'ARCHIVED' } },
        orderBy: { createdAt: 'desc' },
      });
      targetSchoolId = firstSchool?.id;
    }

    if (!targetSchoolId) {
      return {
        schools: [],
        tree: null,
        classes: [],
      };
    }

    // Ensure classes exist for assignment
    await this.ensureStarterClasses(targetSchoolId);

    // Fetch school with profile, users, teachers, students, and classes
    const [school, allSchools, classes] = await Promise.all([
      prisma.school.findUnique({
        where: { id: targetSchoolId },
        include: {
          profile: true,
          users: {
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true,
              role: true,
              status: true,
              createdAt: true,
            },
          },
          teachers: {
            include: {
              allocations: {
                include: {
                  class: { select: { id: true, name: true, code: true } },
                  section: { select: { id: true, name: true } },
                  subject: { select: { id: true, name: true, code: true } },
                },
              },
            },
          },
          students: {
            include: {
              class: { select: { id: true, name: true } },
              section: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      prisma.school.findMany({
        where: { status: { not: 'ARCHIVED' } },
        select: { id: true, name: true, code: true, schoolId: true, status: true },
        orderBy: { name: 'asc' },
      }),
      prisma.schoolClass.findMany({
        where: { schoolId: targetSchoolId },
        include: {
          sections: {
            include: {
              _count: { select: { students: true } },
            },
            orderBy: { name: 'asc' },
          },
          teacherAllocations: {
            include: {
              teacher: {
                select: {
                  id: true,
                  userId: true,
                  teacherCode: true,
                  firstName: true,
                  lastName: true,
                  designation: true,
                },
              },
              section: { select: { id: true, name: true } },
              subject: { select: { id: true, name: true, code: true } },
            },
          },
        },
        orderBy: { code: 'asc' },
      }),
    ]);

    if (!school) {
      throw new Error('School not found');
    }

    // Categorize School Users
    const principalUsers = school.users.filter((u) => u.role === SchoolRole.SCHOOL_ADMIN);
    const academicUsers = school.users.filter((u) => u.role === SchoolRole.HEAD_MASTER);
    const officeUsers = school.users.filter((u) => u.role === SchoolRole.OFFICE_ADMIN);
    const teacherUsers = school.users.filter((u) => u.role === SchoolRole.TEACHER);

    // Map Teachers with their teacher profiles
    const teachersList = school.teachers.map((t) => {
      const linkedUser = school.users.find((u) => u.id === t.userId);
      return {
        id: t.id,
        userId: t.userId,
        teacherCode: t.teacherCode,
        fullName: `${t.firstName} ${t.lastName}`.trim(),
        email: t.email,
        phone: t.phone || linkedUser?.phone || '',
        designation: t.designation || 'Faculty Teacher',
        status: t.status,
        allocations: t.allocations,
      };
    });

    // If there are teacher school users without Teacher table records, include them
    teacherUsers.forEach((tu) => {
      if (!teachersList.some((t) => t.userId === tu.id)) {
        teachersList.push({
          id: tu.id,
          userId: tu.id,
          teacherCode: `TCH-${tu.id.slice(0, 4)}`,
          fullName: tu.fullName,
          email: tu.email,
          phone: tu.phone || '',
          designation: 'Faculty Teacher',
          status: tu.status,
          allocations: [],
        });
      }
    });

    // Map Students
    const studentsList = school.students.map((s) => ({
      id: s.id,
      studentCode: s.studentCode,
      admissionNo: s.admissionNo,
      fullName: `${s.firstName} ${s.lastName}`.trim(),
      email: s.email || '',
      phone: s.phone || s.parentPhone || '',
      className: s.class?.name || 'Unassigned',
      sectionName: s.section?.name || 'A',
      status: s.status,
      parentName: s.parentName || '',
    }));

    return {
      school: {
        id: school.id,
        name: school.name,
        code: school.code,
        schoolId: school.schoolId,
        type: school.type,
        board: school.board,
        status: school.status,
        profile: school.profile,
      },
      allSchools,
      classes,
      principals: principalUsers,
      academics: academicUsers,
      finances: officeUsers,
      teachers: teachersList,
      students: studentsList,
      stats: {
        totalStaff: school.users.length,
        totalTeachers: teachersList.length,
        totalStudents: studentsList.length,
        totalClasses: classes.length,
      },
    };
  }

  /**
   * Create a member or student in the hierarchy with validation and synchronization
   */
  async createMember(data: HierarchyMemberInput, actor: any) {
    const { schoolId, type } = data;
    if (!schoolId) throw new Error('schoolId is required');

    // 1. Role-based permission checks
    if (actor.userType === 'SCHOOL') {
      if (actor.schoolId !== schoolId) {
        throw new Error('Forbidden: Cannot modify another school tenant');
      }

      if (actor.role === SchoolRole.HEAD_MASTER) {
        if (type !== 'TEACHER' && type !== 'STUDENT') {
          throw new Error('Head Master can only manage Teacher Faculty and Students');
        }
      } else if (actor.role === SchoolRole.OFFICE_ADMIN) {
        if (type !== 'STUDENT') {
          throw new Error('Office Finance can only manage Student Profiles');
        }
      } else if (actor.role === SchoolRole.TEACHER) {
        if (type !== 'STUDENT') {
          throw new Error('Teacher Faculty can only manage Student Profiles');
        }
      }
    }

    // 2. Student Creation
    if (type === 'STUDENT') {
      const studentCount = await prisma.student.count({ where: { schoolId } });
      const studentCode = data.studentCode || `STU-${String(studentCount + 1).padStart(3, '0')}`;
      const admissionNo = data.admissionNo || `ADM-2026-${String(studentCount + 1).padStart(4, '0')}`;

      let firstName = data.firstName;
      let lastName = data.lastName;
      if (!firstName && data.fullName) {
        const parts = data.fullName.trim().split(' ');
        firstName = parts[0];
        lastName = parts.slice(1).join(' ') || '';
      }

      let assignedClassId: string | undefined = data.classId || undefined;
      let assignedSectionId: string | undefined = data.sectionId || undefined;

      if (!assignedClassId || !assignedSectionId) {
        const starter = await this.ensureStarterClasses(schoolId);
        const primaryClass = starter[0];
        if (!assignedClassId && primaryClass) assignedClassId = primaryClass.id;
        if (!assignedSectionId && primaryClass) {
          const section = await prisma.schoolSection.findFirst({
            where: { schoolId, classId: primaryClass.id },
          });
          assignedSectionId = section?.id || undefined;
        }
      }

      const student = await prisma.student.create({
        data: {
          schoolId,
          studentCode,
          admissionNo,
          firstName: firstName || 'New',
          lastName: lastName || 'Student',
          email: data.email?.toLowerCase().trim() || null,
          phone: data.phone || null,
          classId: assignedClassId || undefined,
          sectionId: assignedSectionId || undefined,
          status: 'ACTIVE',
        },
        include: {
          class: true,
          section: true,
        },
      });

      return { type: 'STUDENT', member: student };
    }

    // 3. Staff / Teacher Creation
    const email = data.email?.toLowerCase().trim();
    if (!email) throw new Error('Email is required for staff account');

    const existingUser = await prisma.schoolUser.findUnique({
      where: { schoolId_email: { schoolId, email } },
    });
    if (existingUser) {
      throw new Error(`A user with email ${email} already exists in this school.`);
    }

    const passwordHash = await bcrypt.hash(data.password || 'Staff@2026!', 12);
    const fullName = data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Staff Member';

    const schoolRole = type as SchoolRole;

    const user = await prisma.schoolUser.create({
      data: {
        schoolId,
        email,
        fullName,
        passwordHash,
        phone: data.phone || null,
        role: schoolRole,
        status: UserStatus.ACTIVE,
      },
    });

    // If teacher, also create Teacher table profile
    if (type === 'TEACHER') {
      const teacherCount = await prisma.teacher.count({ where: { schoolId } });
      const teacherCode = data.teacherCode || `TCH-${String(teacherCount + 1).padStart(3, '0')}`;
      const nameParts = fullName.split(' ');

      const teacher = await prisma.teacher.create({
        data: {
          schoolId,
          userId: user.id,
          teacherCode,
          firstName: nameParts[0] || 'Teacher',
          lastName: nameParts.slice(1).join(' ') || '',
          email: user.email,
          phone: user.phone,
          designation: data.designation || 'Faculty Teacher',
          status: 'ACTIVE',
        },
      });

      return { type: 'TEACHER', member: { ...user, teacherProfile: teacher } };
    }

    return { type, member: user };
  }

  /**
   * Update member profile
   */
  async updateMember(id: string, type: string, data: any, actor: any) {
    if (type === 'STUDENT') {
      const student = await prisma.student.update({
        where: { id },
        data: {
          firstName: data.firstName ?? undefined,
          lastName: data.lastName ?? undefined,
          email: data.email ?? undefined,
          phone: data.phone ?? undefined,
          classId: data.classId ?? undefined,
          sectionId: data.sectionId ?? undefined,
          status: data.status ?? undefined,
        },
      });
      return student;
    }

    // Staff user update
    const user = await prisma.schoolUser.update({
      where: { id },
      data: {
        fullName: data.fullName ?? undefined,
        phone: data.phone ?? undefined,
        status: data.status ?? undefined,
      },
    });

    if (user.role === SchoolRole.TEACHER) {
      const nameParts = (data.fullName || user.fullName).split(' ');
      await prisma.teacher.updateMany({
        where: { userId: user.id },
        data: {
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' '),
          phone: data.phone ?? undefined,
          designation: data.designation ?? undefined,
        },
      });
    }

    return user;
  }

  /**
   * Delete member from hierarchy safely handling relational dependencies
   */
  async deleteMember(id: string, type: string) {
    if (type === 'STUDENT') {
      await prisma.studentAttendance.deleteMany({ where: { studentId: id } });
      await prisma.studentMarks.deleteMany({ where: { studentId: id } });
      await prisma.studentFee.deleteMany({ where: { studentId: id } });
      await prisma.studentDocument.deleteMany({ where: { studentId: id } });
      await prisma.homeworkSubmission.deleteMany({ where: { studentId: id } });
      return prisma.student.delete({ where: { id } });
    }

    if (type === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: { OR: [{ id }, { userId: id }] },
      });

      if (teacher) {
        await prisma.teacherAllocation.deleteMany({ where: { teacherId: teacher.id } });
        await prisma.timetablePeriod.deleteMany({ where: { teacherId: teacher.id } });
        await prisma.teacherAttendance.deleteMany({ where: { teacherId: teacher.id } });
        await prisma.leaveBalance.deleteMany({ where: { teacherId: teacher.id } });
        await prisma.leaveApplication.deleteMany({ where: { teacherId: teacher.id } });
        await prisma.teacher.delete({ where: { id: teacher.id } });

        if (teacher.userId) {
          try {
            await prisma.schoolUser.delete({ where: { id: teacher.userId } });
          } catch (e) {}
        }
        return { success: true };
      }

      return prisma.schoolUser.delete({ where: { id } });
    }

    const linkedTeacher = await prisma.teacher.findFirst({
      where: { OR: [{ id }, { userId: id }] },
    });
    if (linkedTeacher) {
      await prisma.teacherAllocation.deleteMany({ where: { teacherId: linkedTeacher.id } });
      await prisma.timetablePeriod.deleteMany({ where: { teacherId: linkedTeacher.id } });
      await prisma.teacher.delete({ where: { id: linkedTeacher.id } });
    }

    return prisma.schoolUser.delete({ where: { id } });
  }

  /**
   * Create an Academic Class directly from the hierarchy tree
   */
  async createClass(schoolId: string, data: { name: string; code?: string; sections?: string[] }, actor: any) {
    if (!schoolId) throw new Error('schoolId is required');
    const name = data.name.trim();
    if (!name) throw new Error('Class name is required');
    const code = data.code?.trim() || name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) || 'CLS';

    const sectionNames = data.sections && data.sections.length > 0 ? data.sections : ['Section A'];

    const newClass = await prisma.schoolClass.create({
      data: {
        schoolId,
        name,
        code,
        sections: {
          create: sectionNames.map((sName) => ({
            schoolId,
            name: sName.trim() || 'Section A',
            capacity: 40,
          })),
        },
      },
      include: {
        sections: {
          include: {
            _count: { select: { students: true } },
          },
        },
        teacherAllocations: true,
      },
    });

    return newClass;
  }

  /**
   * Add a Section to an existing class
   */
  async createSection(schoolId: string, data: { classId: string; name: string; capacity?: number }, actor: any) {
    if (!schoolId) throw new Error('schoolId is required');
    if (!data.classId) throw new Error('classId is required');
    return prisma.schoolSection.create({
      data: {
        schoolId,
        classId: data.classId,
        name: data.name || 'Section',
        capacity: data.capacity || 40,
      },
    });
  }

  /**
   * Safely delete a class from the hierarchy
   */
  async deleteClass(schoolId: string, classId: string) {
    await prisma.student.updateMany({
      where: { schoolId, classId },
      data: { classId: null, sectionId: null },
    });
    await prisma.teacherAllocation.deleteMany({ where: { schoolId, classId } });
    await prisma.timetablePeriod.deleteMany({ where: { schoolId, classId } });
    await prisma.attendanceSession.deleteMany({ where: { schoolId, classId } });
    await prisma.classSubject.deleteMany({ where: { classId } });
    await prisma.schoolSection.deleteMany({ where: { schoolId, classId } });
    return prisma.schoolClass.delete({ where: { id: classId } });
  }

  /**
   * Connect / Allot a teacher to an Academic Class & Section
   */
  async allocateTeacher(
    schoolId: string,
    data: { teacherId: string; classId: string; sectionId?: string; subjectId?: string; isClassTeacher?: boolean },
    actor: any
  ) {
    if (!schoolId) throw new Error('schoolId is required');
    if (!data.teacherId) throw new Error('teacherId is required');
    if (!data.classId) throw new Error('classId is required');

    // 1. Resolve teacher record
    let teacher = await prisma.teacher.findFirst({
      where: { OR: [{ id: data.teacherId }, { userId: data.teacherId }] },
    });

    if (!teacher) {
      const user = await prisma.schoolUser.findUnique({ where: { id: data.teacherId } });
      if (user) {
        teacher = await prisma.teacher.create({
          data: {
            schoolId,
            userId: user.id,
            teacherCode: `TCH-${user.id.slice(0, 4)}`,
            firstName: user.fullName.split(' ')[0] || 'Teacher',
            lastName: user.fullName.split(' ').slice(1).join(' ') || '',
            email: user.email,
            phone: user.phone,
            designation: 'Faculty Teacher',
            status: 'ACTIVE',
          },
        });
      }
    }

    if (!teacher) {
      throw new Error('Teacher profile could not be found or initialized');
    }

    // 2. Resolve section
    let sectionId = data.sectionId;
    if (!sectionId) {
      const firstSec = await prisma.schoolSection.findFirst({
        where: { schoolId, classId: data.classId },
      });
      if (firstSec) {
        sectionId = firstSec.id;
      } else {
        const createdSec = await prisma.schoolSection.create({
          data: {
            schoolId,
            classId: data.classId,
            name: 'Section A',
            capacity: 40,
          },
        });
        sectionId = createdSec.id;
      }
    }

    // 3. Resolve subject
    let subjectId = data.subjectId;
    if (!subjectId) {
      let subj = await prisma.subject.findFirst({ where: { schoolId } });
      if (!subj) {
        subj = await prisma.subject.create({
          data: {
            schoolId,
            name: 'General Studies',
            code: 'GEN-01',
            category: 'CORE',
          },
        });
      }
      subjectId = subj.id;
    }

    // If marked as class teacher, unset previous class teacher for this section
    if (data.isClassTeacher) {
      await prisma.teacherAllocation.updateMany({
        where: {
          schoolId,
          classId: data.classId,
          sectionId,
          isClassTeacher: true,
        },
        data: { isClassTeacher: false },
      });
    }

    // 4. Create or update allocation
    const existing = await prisma.teacherAllocation.findFirst({
      where: {
        schoolId,
        teacherId: teacher.id,
        classId: data.classId,
        sectionId,
      },
    });

    if (existing) {
      return prisma.teacherAllocation.update({
        where: { id: existing.id },
        data: {
          isClassTeacher: data.isClassTeacher ?? existing.isClassTeacher,
          subjectId,
        },
        include: {
          teacher: true,
          class: true,
          section: true,
          subject: true,
        },
      });
    }

    return prisma.teacherAllocation.create({
      data: {
        schoolId,
        teacherId: teacher.id,
        classId: data.classId,
        sectionId,
        subjectId,
        isClassTeacher: !!data.isClassTeacher,
      },
      include: {
        teacher: true,
        class: true,
        section: true,
        subject: true,
      },
    });
  }

  /**
   * Remove teacher allocation
   */
  async deleteAllocation(schoolId: string, id: string) {
    const existing = await prisma.teacherAllocation.findFirst({
      where: { id, schoolId },
    });
    if (!existing) {
      return prisma.teacherAllocation.delete({ where: { id } }).catch(() => null);
    }
    return prisma.teacherAllocation.delete({ where: { id } });
  }
}

export const hierarchyService = new HierarchyService();
