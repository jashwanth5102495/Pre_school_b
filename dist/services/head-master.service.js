"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.headMasterService = exports.HeadMasterService = void 0;
const database_1 = require("../config/database");
const client_1 = require("@prisma/client");
class HeadMasterService {
    async getDashboard(schoolId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const [classesCount, sectionsCount, teachersCount, pendingLeavesCount, pendingMarksCount, todaySessions, upcomingExams, upcomingEvents,] = await Promise.all([
            database_1.prisma.schoolClass.count({ where: { schoolId } }),
            database_1.prisma.schoolSection.count({ where: { schoolId } }),
            database_1.prisma.teacher.count({ where: { schoolId, status: 'ACTIVE' } }),
            database_1.prisma.leaveApplication.count({ where: { schoolId, status: client_1.LeaveStatus.PENDING } }),
            database_1.prisma.marksSubmission.count({ where: { schoolId, status: client_1.MarksStatus.SUBMITTED } }),
            database_1.prisma.attendanceSession.findMany({
                where: { schoolId, date: { gte: today, lt: tomorrow } },
                include: {
                    class: true,
                    section: true,
                    records: { select: { status: true } },
                },
            }),
            database_1.prisma.examination.findMany({
                where: { schoolId },
                orderBy: { startDate: 'asc' },
                take: 3,
            }),
            database_1.prisma.academicEvent.findMany({
                where: { schoolId, startDate: { gte: today } },
                orderBy: { startDate: 'asc' },
                take: 4,
            }),
        ]);
        let totalStudentsMarked = 0;
        let totalStudentsPresent = 0;
        for (const session of todaySessions) {
            totalStudentsMarked += session.records.length;
            totalStudentsPresent += session.records.filter((r) => r.status === client_1.AttendanceStatus.PRESENT || r.status === client_1.AttendanceStatus.LATE).length;
        }
        const overallAttendancePct = totalStudentsMarked > 0 ? Math.round((totalStudentsPresent / totalStudentsMarked) * 100) : 0;
        return {
            summary: {
                classesCount,
                sectionsCount,
                teachersCount,
                pendingLeavesCount,
                pendingMarksCount,
                overallAttendancePct,
                sessionsMarkedToday: todaySessions.length,
            },
            todaySessions: todaySessions.map((s) => ({
                sessionId: s.id,
                className: s.class.name,
                sectionName: s.section.name,
                total: s.records.length,
                present: s.records.filter((r) => r.status === client_1.AttendanceStatus.PRESENT || r.status === client_1.AttendanceStatus.LATE).length,
            })),
            upcomingExams,
            upcomingEvents,
        };
    }
    // Teacher Leaves
    async getLeaveApplications(schoolId, status) {
        const where = { schoolId };
        if (status)
            where.status = status;
        return database_1.prisma.leaveApplication.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                teacher: { select: { id: true, firstName: true, lastName: true, teacherCode: true, designation: true } },
                leaveType: true,
                substituteTeacher: { select: { id: true, firstName: true, lastName: true, teacherCode: true } },
            },
        });
    }
    async reviewLeaveApplication(schoolId, leaveId, reviewerId, data) {
        const leave = await database_1.prisma.leaveApplication.findFirst({
            where: { id: leaveId, schoolId },
            include: { leaveType: true },
        });
        if (!leave)
            throw new Error('Leave application not found');
        if (leave.status !== client_1.LeaveStatus.PENDING)
            throw new Error('Leave application has already been processed');
        const isApproved = data.action === 'APPROVE';
        const status = isApproved ? client_1.LeaveStatus.APPROVED : client_1.LeaveStatus.REJECTED;
        const updated = await database_1.prisma.leaveApplication.update({
            where: { id: leaveId },
            data: {
                status,
                reviewedById: reviewerId,
                reviewedAt: new Date(),
                substituteTeacherId: data.substituteTeacherId || leave.substituteTeacherId,
                rejectionReason: !isApproved ? data.rejectionReason || 'Rejected by administration' : null,
            },
            include: { teacher: true, leaveType: true },
        });
        // If approved, update teacher's leave balance
        if (isApproved) {
            const diffTime = Math.abs(new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime());
            const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            await database_1.prisma.leaveBalance.updateMany({
                where: {
                    schoolId,
                    teacherId: leave.teacherId,
                    leaveTypeId: leave.leaveTypeId,
                },
                data: {
                    usedDays: { increment: daysCount },
                },
            });
        }
        return updated;
    }
    // Classes & Sections
    async getClassesAndSections(schoolId) {
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
            },
            orderBy: { code: 'asc' },
        });
    }
    async createClass(schoolId, data) {
        return database_1.prisma.schoolClass.create({
            data: {
                schoolId,
                name: data.name,
                code: data.code,
            },
        });
    }
    async createSection(schoolId, data) {
        return database_1.prisma.schoolSection.create({
            data: {
                schoolId,
                classId: data.classId,
                name: data.name,
                capacity: data.capacity || 40,
            },
        });
    }
    // Teacher Allocations
    async getAllocations(schoolId) {
        const [allocations, teachers, classes, subjects] = await Promise.all([
            database_1.prisma.teacherAllocation.findMany({
                where: { schoolId },
                include: {
                    teacher: true,
                    class: true,
                    section: true,
                    subject: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            database_1.prisma.teacher.findMany({
                where: { schoolId, status: 'ACTIVE' },
                orderBy: { firstName: 'asc' },
            }),
            database_1.prisma.schoolClass.findMany({
                where: { schoolId },
                include: { sections: true },
                orderBy: { code: 'asc' },
            }),
            database_1.prisma.subject.findMany({
                where: { schoolId },
                orderBy: { name: 'asc' },
            }),
        ]);
        return { allocations, teachers, classes, subjects };
    }
    async createAllocation(schoolId, data) {
        // Check if class teacher already exists for this class & section
        if (data.isClassTeacher) {
            await database_1.prisma.teacherAllocation.updateMany({
                where: {
                    schoolId,
                    classId: data.classId,
                    sectionId: data.sectionId,
                    isClassTeacher: true,
                },
                data: { isClassTeacher: false },
            });
        }
        return database_1.prisma.teacherAllocation.create({
            data: {
                schoolId,
                teacherId: data.teacherId,
                classId: data.classId,
                sectionId: data.sectionId,
                subjectId: data.subjectId,
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
    async deleteAllocation(schoolId, id) {
        const existing = await database_1.prisma.teacherAllocation.findFirst({
            where: { id, schoolId },
        });
        if (!existing)
            throw new Error('Allocation not found');
        return database_1.prisma.teacherAllocation.delete({ where: { id } });
    }
    // Timetable with Conflict Detection
    async getTimetable(schoolId, query) {
        const where = { schoolId };
        if (query.academicYearId)
            where.academicYearId = query.academicYearId;
        if (query.classId)
            where.classId = query.classId;
        if (query.sectionId)
            where.sectionId = query.sectionId;
        if (query.teacherId)
            where.teacherId = query.teacherId;
        return database_1.prisma.timetablePeriod.findMany({
            where,
            include: {
                class: true,
                section: true,
                subject: true,
                teacher: true,
            },
            orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
        });
    }
    async createTimetablePeriod(schoolId, data) {
        const { academicYearId, classId, sectionId, dayOfWeek, periodNumber, startTime, endTime, subjectId, teacherId, classroom, isBreak, } = data;
        // Check Academic Year
        let targetYearId = academicYearId;
        if (!targetYearId) {
            const currentYear = await database_1.prisma.academicYear.findFirst({
                where: { schoolId, isCurrent: true },
            });
            targetYearId = currentYear?.id;
        }
        if (!targetYearId)
            throw new Error('No active academic year found');
        if (!isBreak) {
            // 1. Conflict Check: Class & Section already scheduled
            const classClash = await database_1.prisma.timetablePeriod.findFirst({
                where: {
                    schoolId,
                    academicYearId: targetYearId,
                    classId,
                    sectionId,
                    dayOfWeek,
                    periodNumber,
                },
                include: { subject: true },
            });
            if (classClash) {
                throw new Error(`Schedule Conflict: Class & Section already has Period ${periodNumber} scheduled (${classClash.subject?.name || 'Assigned'}).`);
            }
            // 2. Conflict Check: Teacher clash
            if (teacherId) {
                const teacherClash = await database_1.prisma.timetablePeriod.findFirst({
                    where: {
                        schoolId,
                        academicYearId: targetYearId,
                        teacherId,
                        dayOfWeek,
                        periodNumber,
                    },
                    include: { class: true, section: true },
                });
                if (teacherClash) {
                    throw new Error(`Teacher Conflict: Teacher is already teaching ${teacherClash.class.name} (${teacherClash.section.name}) during Period ${periodNumber} on ${dayOfWeek}.`);
                }
            }
            // 3. Conflict Check: Classroom clash
            if (classroom) {
                const roomClash = await database_1.prisma.timetablePeriod.findFirst({
                    where: {
                        schoolId,
                        academicYearId: targetYearId,
                        classroom,
                        dayOfWeek,
                        periodNumber,
                    },
                    include: { class: true, section: true },
                });
                if (roomClash) {
                    throw new Error(`Classroom Conflict: Room "${classroom}" is already booked by ${roomClash.class.name} (${roomClash.section.name}) during Period ${periodNumber}.`);
                }
            }
        }
        return database_1.prisma.timetablePeriod.create({
            data: {
                schoolId,
                academicYearId: targetYearId,
                classId,
                sectionId,
                dayOfWeek,
                periodNumber,
                startTime,
                endTime,
                subjectId: subjectId || null,
                teacherId: teacherId || null,
                classroom: classroom || null,
                isBreak: !!isBreak,
            },
            include: {
                class: true,
                section: true,
                subject: true,
                teacher: true,
            },
        });
    }
    async deleteTimetablePeriod(schoolId, id) {
        const existing = await database_1.prisma.timetablePeriod.findFirst({
            where: { id, schoolId },
        });
        if (!existing)
            throw new Error('Timetable period not found');
        return database_1.prisma.timetablePeriod.delete({ where: { id } });
    }
    // Attendance Supervision
    async getAttendanceSupervision(schoolId, dateStr) {
        const targetDate = dateStr ? new Date(dateStr) : new Date();
        targetDate.setHours(0, 0, 0, 0);
        const nextDate = new Date(targetDate);
        nextDate.setDate(nextDate.getDate() + 1);
        const [allSections, recordedSessions] = await Promise.all([
            database_1.prisma.schoolSection.findMany({
                where: { schoolId },
                include: {
                    class: true,
                    _count: { select: { students: true } },
                },
            }),
            database_1.prisma.attendanceSession.findMany({
                where: {
                    schoolId,
                    date: { gte: targetDate, lt: nextDate },
                },
                include: {
                    class: true,
                    section: true,
                    records: { select: { status: true } },
                },
            }),
        ]);
        const recordedMap = new Map();
        recordedSessions.forEach((s) => {
            recordedMap.set(`${s.classId}_${s.sectionId}`, s);
        });
        const report = allSections.map((sec) => {
            const session = recordedMap.get(`${sec.classId}_${sec.id}`);
            if (session) {
                const present = session.records.filter((r) => r.status === client_1.AttendanceStatus.PRESENT || r.status === client_1.AttendanceStatus.LATE).length;
                const absent = session.records.filter((r) => r.status === client_1.AttendanceStatus.ABSENT).length;
                const total = session.records.length;
                return {
                    sectionId: sec.id,
                    classId: sec.classId,
                    className: sec.class.name,
                    sectionName: sec.name,
                    isMarked: true,
                    totalStudents: total,
                    present,
                    absent,
                    attendancePct: total > 0 ? Math.round((present / total) * 100) : 0,
                };
            }
            else {
                return {
                    sectionId: sec.id,
                    classId: sec.classId,
                    className: sec.class.name,
                    sectionName: sec.name,
                    isMarked: false,
                    totalStudents: sec._count.students,
                    present: 0,
                    absent: 0,
                    attendancePct: 0,
                };
            }
        });
        return {
            date: targetDate,
            totalSections: allSections.length,
            markedSections: recordedSessions.length,
            missingSections: allSections.length - recordedSessions.length,
            report,
        };
    }
    // Marks Moderation
    async getMarksSubmissions(schoolId, status) {
        const where = { schoolId };
        if (status)
            where.status = status;
        return database_1.prisma.marksSubmission.findMany({
            where,
            orderBy: { submittedAt: 'desc' },
            include: {
                teacher: { select: { id: true, firstName: true, lastName: true, teacherCode: true } },
                examSubject: {
                    include: {
                        exam: true,
                        class: true,
                        subject: true,
                        _count: { select: { studentMarks: true } },
                    },
                },
            },
        });
    }
    async getSubmissionDetails(schoolId, submissionId) {
        const submission = await database_1.prisma.marksSubmission.findFirst({
            where: { id: submissionId, schoolId },
            include: {
                teacher: true,
                examSubject: {
                    include: {
                        exam: true,
                        class: true,
                        subject: true,
                        studentMarks: {
                            include: {
                                student: { select: { id: true, studentCode: true, firstName: true, lastName: true, admissionNo: true } },
                            },
                            orderBy: { student: { studentCode: 'asc' } },
                        },
                    },
                },
            },
        });
        if (!submission)
            throw new Error('Submission not found');
        return submission;
    }
    async reviewMarksSubmission(schoolId, submissionId, reviewerId, data) {
        const submission = await database_1.prisma.marksSubmission.findFirst({
            where: { id: submissionId, schoolId },
        });
        if (!submission)
            throw new Error('Submission not found');
        const isApproved = data.action === 'APPROVE';
        const newStatus = isApproved ? client_1.MarksStatus.APPROVED : client_1.MarksStatus.DRAFT;
        const updated = await database_1.prisma.marksSubmission.update({
            where: { id: submissionId },
            data: {
                status: newStatus,
                reviewedById: reviewerId,
                reviewedAt: new Date(),
                comments: data.comments || null,
            },
        });
        // If approved, publish the student marks; if rejected, revert to DRAFT for revision
        await database_1.prisma.studentMarks.updateMany({
            where: {
                schoolId,
                examSubjectId: submission.examSubjectId,
            },
            data: {
                status: isApproved ? client_1.MarksStatus.PUBLISHED : client_1.MarksStatus.DRAFT,
            },
        });
        return updated;
    }
}
exports.HeadMasterService = HeadMasterService;
exports.headMasterService = new HeadMasterService();
