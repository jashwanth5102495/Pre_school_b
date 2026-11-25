"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teacherPortalService = exports.TeacherPortalService = void 0;
const database_1 = require("../config/database");
const client_1 = require("@prisma/client");
class TeacherPortalService {
    async getTeacherByUserId(schoolId, userId, userEmail) {
        let teacher = await database_1.prisma.teacher.findFirst({
            where: { schoolId, userId },
        });
        if (!teacher && userEmail) {
            teacher = await database_1.prisma.teacher.findFirst({
                where: { schoolId, email: userEmail },
            });
            if (teacher && !teacher.userId) {
                // Link it now
                await database_1.prisma.teacher.update({
                    where: { id: teacher.id },
                    data: { userId },
                });
            }
        }
        if (!teacher) {
            throw new Error('Teacher profile not found for this account');
        }
        return teacher;
    }
    async getDashboard(schoolId, teacherId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        const currentDay = days[today.getDay()];
        const [teacher, allocations, todayPeriods, leaveBalances, activeHomework, pendingSubmissions] = await Promise.all([
            database_1.prisma.teacher.findUnique({
                where: { id: teacherId },
            }),
            database_1.prisma.teacherAllocation.findMany({
                where: { schoolId, teacherId },
                include: { class: true, section: true, subject: true },
            }),
            database_1.prisma.timetablePeriod.findMany({
                where: { schoolId, teacherId, dayOfWeek: currentDay },
                include: { class: true, section: true, subject: true },
                orderBy: { periodNumber: 'asc' },
            }),
            database_1.prisma.leaveBalance.findMany({
                where: { schoolId, teacherId },
                include: { leaveType: true },
            }),
            database_1.prisma.homework.count({
                where: { schoolId, teacherId, dueDate: { gte: today } },
            }),
            database_1.prisma.marksSubmission.count({
                where: { schoolId, teacherId, status: client_1.MarksStatus.SUBMITTED },
            }),
        ]);
        // Check attendance status for assigned classes where teacher is class teacher
        const classTeacherAllocations = allocations.filter((a) => a.isClassTeacher);
        const attendanceStatus = [];
        for (const alloc of classTeacherAllocations) {
            const session = await database_1.prisma.attendanceSession.findFirst({
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
                    ? session.records.filter((r) => r.status === client_1.AttendanceStatus.PRESENT || r.status === client_1.AttendanceStatus.LATE).length
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
    async getAssignedClasses(schoolId, teacherId) {
        return database_1.prisma.teacherAllocation.findMany({
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
    }
    // Attendance Taking
    async getAttendanceSession(schoolId, teacherId, query) {
        const targetDate = query.date ? new Date(query.date) : new Date();
        targetDate.setHours(0, 0, 0, 0);
        const nextDate = new Date(targetDate);
        nextDate.setDate(nextDate.getDate() + 1);
        // Verify teacher is allocated to this class & section
        const allocation = await database_1.prisma.teacherAllocation.findFirst({
            where: { schoolId, teacherId, classId: query.classId, sectionId: query.sectionId },
        });
        if (!allocation) {
            // Check if user is School Admin / Head Master (will have supervisory access)
            // If not, allow taking attendance if general teacher allocation exists
        }
        // Get all students enrolled in this section
        const students = await database_1.prisma.student.findMany({
            where: { schoolId, classId: query.classId, sectionId: query.sectionId, status: 'ACTIVE' },
            orderBy: { studentCode: 'asc' },
        });
        // Check existing session
        const existingSession = await database_1.prisma.attendanceSession.findFirst({
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
                status: rec ? rec.status : client_1.AttendanceStatus.PRESENT,
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
    async markAttendance(schoolId, teacherId, data) {
        const targetDate = data.date ? new Date(data.date) : new Date();
        targetDate.setHours(0, 0, 0, 0);
        const currentYear = await database_1.prisma.academicYear.findFirst({
            where: { schoolId, isCurrent: true },
        });
        if (!currentYear)
            throw new Error('Active academic year not found');
        // Upsert AttendanceSession
        const session = await database_1.prisma.attendanceSession.upsert({
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
            await database_1.prisma.studentAttendance.upsert({
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
        const presentCount = data.records.filter((r) => r.status === client_1.AttendanceStatus.PRESENT || r.status === client_1.AttendanceStatus.LATE).length;
        const absentCount = data.records.filter((r) => r.status === client_1.AttendanceStatus.ABSENT).length;
        return {
            sessionId: session.id,
            date: targetDate,
            totalMarked: data.records.length,
            presentCount,
            absentCount,
            attendancePercentage: data.records.length > 0 ? Math.round((presentCount / data.records.length) * 100) : 0,
        };
    }
    // Internal Marks Entry
    async getExamSubjectsForTeacher(schoolId, teacherId) {
        const allocations = await database_1.prisma.teacherAllocation.findMany({
            where: { schoolId, teacherId },
            select: { classId: true, subjectId: true },
        });
        const classIds = Array.from(new Set(allocations.map((a) => a.classId)));
        const subjectIds = Array.from(new Set(allocations.map((a) => a.subjectId)));
        return database_1.prisma.examinationSubject.findMany({
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
    async getMarksSheet(schoolId, teacherId, examSubjectId) {
        const examSubject = await database_1.prisma.examinationSubject.findFirst({
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
        if (!examSubject)
            throw new Error('Examination subject not found');
        const students = await database_1.prisma.student.findMany({
            where: { schoolId, classId: examSubject.classId, status: 'ACTIVE' },
            include: { section: true },
            orderBy: { studentCode: 'asc' },
        });
        const existingMarks = await database_1.prisma.studentMarks.findMany({
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
                status: m ? m.status : client_1.MarksStatus.DRAFT,
            };
        });
        return {
            examSubject,
            submission: examSubject.submissions[0] || null,
            studentsCount: students.length,
            roster,
        };
    }
    async saveMarks(schoolId, teacherId, data) {
        const examSubject = await database_1.prisma.examinationSubject.findFirst({
            where: { id: data.examSubjectId, schoolId },
        });
        if (!examSubject)
            throw new Error('Examination subject not found');
        const markStatus = data.submitForReview ? client_1.MarksStatus.SUBMITTED : client_1.MarksStatus.DRAFT;
        for (const item of data.marks) {
            const score = parseFloat(item.marksObtained);
            const pct = (score / examSubject.maxMarks) * 100;
            let grade = 'F';
            if (pct >= 90)
                grade = 'A+';
            else if (pct >= 80)
                grade = 'A';
            else if (pct >= 70)
                grade = 'B+';
            else if (pct >= 60)
                grade = 'B';
            else if (pct >= 50)
                grade = 'C';
            else if (pct >= 35)
                grade = 'D';
            await database_1.prisma.studentMarks.upsert({
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
            await database_1.prisma.marksSubmission.create({
                data: {
                    schoolId,
                    examSubjectId: examSubject.id,
                    teacherId,
                    status: client_1.MarksStatus.SUBMITTED,
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
    async getTimetable(schoolId, teacherId) {
        return database_1.prisma.timetablePeriod.findMany({
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
    async getHomework(schoolId, teacherId) {
        return database_1.prisma.homework.findMany({
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
    async createHomework(schoolId, teacherId, data) {
        return database_1.prisma.homework.create({
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
    async getMyLeaves(schoolId, teacherId) {
        const [balances, applications] = await Promise.all([
            database_1.prisma.leaveBalance.findMany({
                where: { schoolId, teacherId },
                include: { leaveType: true },
            }),
            database_1.prisma.leaveApplication.findMany({
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
    async applyLeave(schoolId, teacherId, data) {
        return database_1.prisma.leaveApplication.create({
            data: {
                schoolId,
                teacherId,
                leaveTypeId: data.leaveTypeId,
                startDate: new Date(data.startDate),
                endDate: new Date(data.endDate),
                reason: data.reason,
                substituteTeacherId: data.substituteTeacherId || null,
                status: client_1.LeaveStatus.PENDING,
            },
            include: { leaveType: true },
        });
    }
}
exports.TeacherPortalService = TeacherPortalService;
exports.teacherPortalService = new TeacherPortalService();
