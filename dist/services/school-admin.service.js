"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schoolAdminService = exports.SchoolAdminService = void 0;
const database_1 = require("../config/database");
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
class SchoolAdminService {
    async getDashboardMetrics(schoolId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const [totalStudents, totalTeachers, totalClasses, totalSections, activeAcademicYear, todayStudentAttendance, todayTeacherAttendance, feePaymentsAgg, pendingFeeAgg, totalAdmissions, recentAdmissions, recentTransactions, upcomingEvents, classesWithStrength,] = await Promise.all([
            database_1.prisma.student.count({ where: { schoolId, status: 'ACTIVE' } }),
            database_1.prisma.teacher.count({ where: { schoolId, status: 'ACTIVE' } }),
            database_1.prisma.schoolClass.count({ where: { schoolId } }),
            database_1.prisma.schoolSection.count({ where: { schoolId } }),
            database_1.prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } }),
            database_1.prisma.studentAttendance.findMany({
                where: {
                    schoolId,
                    session: { date: { gte: today, lt: tomorrow } },
                },
                select: { status: true },
            }),
            database_1.prisma.teacherAttendance.findMany({
                where: {
                    schoolId,
                    date: { gte: today, lt: tomorrow },
                },
                select: { status: true },
            }),
            database_1.prisma.feePayment.aggregate({
                where: { schoolId },
                _sum: { amountPaid: true },
                _count: { id: true },
            }),
            database_1.prisma.studentFee.aggregate({
                where: { schoolId, status: { in: [client_1.FeeStatus.UNPAID, client_1.FeeStatus.PARTIAL, client_1.FeeStatus.OVERDUE] } },
                _sum: { balanceAmount: true },
            }),
            database_1.prisma.admissionApplication.count({ where: { schoolId } }),
            database_1.prisma.admissionApplication.findMany({
                where: { schoolId },
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: { applyingClass: { select: { name: true } } },
            }),
            database_1.prisma.feePayment.findMany({
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
            database_1.prisma.academicEvent.findMany({
                where: { schoolId, startDate: { gte: today } },
                orderBy: { startDate: 'asc' },
                take: 5,
            }),
            database_1.prisma.schoolClass.findMany({
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
        const studentsPresent = todayStudentAttendance.filter((a) => a.status === client_1.AttendanceStatus.PRESENT || a.status === client_1.AttendanceStatus.LATE).length;
        const studentsAbsent = todayStudentAttendance.filter((a) => a.status === client_1.AttendanceStatus.ABSENT).length;
        const totalStudentAttendanceMarked = todayStudentAttendance.length;
        const studentAttendancePct = totalStudentAttendanceMarked > 0 ? Math.round((studentsPresent / totalStudentAttendanceMarked) * 100) : 0;
        const teachersPresent = todayTeacherAttendance.filter((a) => a.status === client_1.AttendanceStatus.PRESENT).length;
        const teachersAbsent = todayTeacherAttendance.filter((a) => a.status === client_1.AttendanceStatus.ABSENT).length;
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
    async getStudents(schoolId, query) {
        const { search, classId, sectionId, status, page = 1, limit = 20 } = query;
        const skip = (page - 1) * limit;
        const where = { schoolId };
        if (status)
            where.status = status;
        if (classId)
            where.classId = classId;
        if (sectionId)
            where.sectionId = sectionId;
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
            database_1.prisma.student.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    class: { select: { id: true, name: true, code: true } },
                    section: { select: { id: true, name: true } },
                },
            }),
            database_1.prisma.student.count({ where }),
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
    async getStudentById(schoolId, studentId) {
        const student = await database_1.prisma.student.findFirst({
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
    async createStudent(schoolId, data) {
        const count = await database_1.prisma.student.count({ where: { schoolId } });
        const studentCode = data.studentCode || `STU-${String(count + 1).padStart(4, '0')}`;
        const admissionNo = data.admissionNo || `ADM-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
        return database_1.prisma.student.create({
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
                sectionId: data.sectionId || null,
                parentName: data.parentName || null,
                parentPhone: data.parentPhone || null,
                parentEmail: data.parentEmail || null,
                address: data.address || null,
                bloodGroup: data.bloodGroup || null,
                status: 'ACTIVE',
            },
        });
    }
    async updateStudent(schoolId, studentId, data) {
        const existing = await database_1.prisma.student.findFirst({
            where: { id: studentId, schoolId },
        });
        if (!existing)
            throw new Error('Student not found');
        return database_1.prisma.student.update({
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
    async getStaff(schoolId) {
        const [teachers, schoolUsers] = await Promise.all([
            database_1.prisma.teacher.findMany({
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
            database_1.prisma.schoolUser.findMany({
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
    async createStaff(schoolId, data) {
        const passwordHash = await bcryptjs_1.default.hash(data.password || 'Staff@2026!', 12);
        const user = await database_1.prisma.schoolUser.create({
            data: {
                schoolId,
                email: data.email.toLowerCase().trim(),
                fullName: data.fullName,
                passwordHash,
                role: data.role,
                phone: data.phone || null,
                status: client_1.UserStatus.ACTIVE,
            },
        });
        if (data.role === client_1.SchoolRole.TEACHER) {
            const teacherCount = await database_1.prisma.teacher.count({ where: { schoolId } });
            const teacherCode = data.teacherCode || `TCH-${String(teacherCount + 1).padStart(3, '0')}`;
            const nameParts = data.fullName.split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || '';
            await database_1.prisma.teacher.create({
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
    async getClasses(schoolId) {
        return database_1.prisma.schoolClass.findMany({
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
    async getFeesOverview(schoolId) {
        const [totalCollected, totalPending, structures, recentPayments] = await Promise.all([
            database_1.prisma.feePayment.aggregate({
                where: { schoolId },
                _sum: { amountPaid: true },
                _count: { id: true },
            }),
            database_1.prisma.studentFee.aggregate({
                where: { schoolId, status: { in: [client_1.FeeStatus.UNPAID, client_1.FeeStatus.PARTIAL, client_1.FeeStatus.OVERDUE] } },
                _sum: { balanceAmount: true },
            }),
            database_1.prisma.feeStructure.findMany({
                where: { schoolId },
                include: {
                    category: true,
                    class: true,
                    _count: { select: { studentFees: true } },
                },
            }),
            database_1.prisma.feePayment.findMany({
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
    async getAttendanceOverview(schoolId, dateStr) {
        const targetDate = dateStr ? new Date(dateStr) : new Date();
        targetDate.setHours(0, 0, 0, 0);
        const nextDate = new Date(targetDate);
        nextDate.setDate(nextDate.getDate() + 1);
        const sessions = await database_1.prisma.attendanceSession.findMany({
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
            const present = s.records.filter((r) => r.status === client_1.AttendanceStatus.PRESENT || r.status === client_1.AttendanceStatus.LATE).length;
            const absent = s.records.filter((r) => r.status === client_1.AttendanceStatus.ABSENT).length;
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
    async getSchoolProfile(schoolId) {
        return database_1.prisma.school.findUnique({
            where: { id: schoolId },
            include: {
                profile: true,
                subscription: { include: { plan: true } },
            },
        });
    }
    async updateSchoolProfile(schoolId, data) {
        if (data.name) {
            await database_1.prisma.school.update({
                where: { id: schoolId },
                data: { name: data.name, website: data.website, logoUrl: data.logoUrl },
            });
        }
        if (data.profile) {
            await database_1.prisma.schoolProfile.upsert({
                where: { schoolId },
                update: data.profile,
                create: { ...data.profile, schoolId },
            });
        }
        return this.getSchoolProfile(schoolId);
    }
}
exports.SchoolAdminService = SchoolAdminService;
exports.schoolAdminService = new SchoolAdminService();
