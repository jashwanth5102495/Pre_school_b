"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.officeAdminService = exports.OfficeAdminService = void 0;
const database_1 = require("../config/database");
const client_1 = require("@prisma/client");
const storage_service_1 = require("./storage.service");
class OfficeAdminService {
    async getDashboard(schoolId) {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const [pendingAdmissionsCount, approvedAdmissionsCount, totalStudents, monthFeeAgg, totalPendingFeeAgg, pendingDocumentsCount, recentAdmissions, recentPayments,] = await Promise.all([
            database_1.prisma.admissionApplication.count({ where: { schoolId, status: client_1.AdmissionStatus.PENDING } }),
            database_1.prisma.admissionApplication.count({ where: { schoolId, status: client_1.AdmissionStatus.APPROVED } }),
            database_1.prisma.student.count({ where: { schoolId, status: 'ACTIVE' } }),
            database_1.prisma.feePayment.aggregate({
                where: { schoolId, paymentDate: { gte: firstDayOfMonth } },
                _sum: { amountPaid: true },
                _count: { id: true },
            }),
            database_1.prisma.studentFee.aggregate({
                where: { schoolId, status: { in: [client_1.FeeStatus.UNPAID, client_1.FeeStatus.PARTIAL, client_1.FeeStatus.OVERDUE] } },
                _sum: { balanceAmount: true },
                _count: { id: true },
            }),
            database_1.prisma.studentDocument.count({ where: { schoolId, status: client_1.DocumentStatus.PENDING } }),
            database_1.prisma.admissionApplication.findMany({
                where: { schoolId },
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: { applyingClass: true },
            }),
            database_1.prisma.feePayment.findMany({
                where: { schoolId },
                orderBy: { paymentDate: 'desc' },
                take: 5,
                include: {
                    studentFee: {
                        include: {
                            student: true,
                            feeStructure: { include: { category: true } },
                        },
                    },
                },
            }),
        ]);
        return {
            summary: {
                pendingAdmissions: pendingAdmissionsCount,
                approvedAdmissions: approvedAdmissionsCount,
                totalActiveStudents: totalStudents,
                monthFeeCollected: monthFeeAgg._sum.amountPaid || 0,
                monthTransactions: monthFeeAgg._count.id || 0,
                outstandingFeeAmount: totalPendingFeeAgg._sum.balanceAmount || 0,
                defaultersCount: totalPendingFeeAgg._count.id || 0,
                pendingDocuments: pendingDocumentsCount,
            },
            recentAdmissions,
            recentPayments,
        };
    }
    // Admissions
    async getAdmissions(schoolId, query) {
        const where = { schoolId };
        if (query.status)
            where.status = query.status;
        if (query.search) {
            where.OR = [
                { firstName: { contains: query.search, mode: 'insensitive' } },
                { lastName: { contains: query.search, mode: 'insensitive' } },
                { applicationNumber: { contains: query.search, mode: 'insensitive' } },
                { parentName: { contains: query.search, mode: 'insensitive' } },
            ];
        }
        return database_1.prisma.admissionApplication.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: { applyingClass: true },
        });
    }
    async createAdmission(schoolId, data) {
        const count = await database_1.prisma.admissionApplication.count({ where: { schoolId } });
        const year = new Date().getFullYear();
        const appNum = `APP-${year}-${String(count + 1).padStart(4, '0')}`;
        return database_1.prisma.admissionApplication.create({
            data: {
                schoolId,
                applicationNumber: appNum,
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email || null,
                phone: data.phone || null,
                gender: data.gender || null,
                dob: data.dob ? new Date(data.dob) : null,
                parentName: data.parentName,
                parentPhone: data.parentPhone,
                parentEmail: data.parentEmail || null,
                applyingClassId: data.applyingClassId,
                status: client_1.AdmissionStatus.PENDING,
                remarks: data.remarks || null,
            },
            include: { applyingClass: true },
        });
    }
    async updateAdmissionStatus(schoolId, id, reviewerId, data) {
        const existing = await database_1.prisma.admissionApplication.findFirst({
            where: { id, schoolId },
        });
        if (!existing)
            throw new Error('Admission application not found');
        return database_1.prisma.admissionApplication.update({
            where: { id },
            data: {
                status: data.status,
                reviewedById: reviewerId,
                remarks: data.remarks || existing.remarks,
            },
            include: { applyingClass: true },
        });
    }
    async enrollStudent(schoolId, admissionId, data) {
        const app = await database_1.prisma.admissionApplication.findFirst({
            where: { id: admissionId, schoolId },
        });
        if (!app)
            throw new Error('Admission application not found');
        const studentCount = await database_1.prisma.student.count({ where: { schoolId } });
        const year = new Date().getFullYear();
        const studentCode = `STU-${String(studentCount + 1).padStart(4, '0')}`;
        const admissionNo = `ADM-${year}-${String(studentCount + 1).padStart(3, '0')}`;
        // Create student
        const student = await database_1.prisma.student.create({
            data: {
                schoolId,
                studentCode,
                admissionNo,
                firstName: app.firstName,
                lastName: app.lastName,
                email: app.email,
                phone: app.phone,
                gender: app.gender,
                dob: app.dob,
                classId: data.classId,
                sectionId: data.sectionId,
                parentName: app.parentName,
                parentPhone: app.parentPhone,
                parentEmail: app.parentEmail,
                status: 'ACTIVE',
            },
        });
        // Mark application as ADMITTED
        await database_1.prisma.admissionApplication.update({
            where: { id: admissionId },
            data: { status: client_1.AdmissionStatus.ADMITTED },
        });
        // Attach fee structures if provided or auto-attach active class fee structures
        const currentYear = await database_1.prisma.academicYear.findFirst({
            where: { schoolId, isCurrent: true },
        });
        if (currentYear) {
            let structuresToAttach = data.feeStructureIds;
            if (!structuresToAttach || structuresToAttach.length === 0) {
                const classStructures = await database_1.prisma.feeStructure.findMany({
                    where: { schoolId, classId: data.classId, academicYearId: currentYear.id },
                });
                structuresToAttach = classStructures.map((s) => s.id);
            }
            for (const structureId of structuresToAttach) {
                const struct = await database_1.prisma.feeStructure.findUnique({ where: { id: structureId } });
                if (struct) {
                    await database_1.prisma.studentFee.create({
                        data: {
                            schoolId,
                            studentId: student.id,
                            feeStructureId: struct.id,
                            academicYearId: currentYear.id,
                            amount: struct.amount,
                            paidAmount: 0,
                            balanceAmount: struct.amount,
                            status: client_1.FeeStatus.UNPAID,
                            dueDate: struct.dueDate,
                        },
                    });
                }
            }
        }
        return student;
    }
    // Fees
    async getFeeStructures(schoolId) {
        const [structures, categories, classes, academicYears] = await Promise.all([
            database_1.prisma.feeStructure.findMany({
                where: { schoolId },
                include: {
                    category: true,
                    class: true,
                    academicYear: true,
                    _count: { select: { studentFees: true } },
                },
                orderBy: { dueDate: 'asc' },
            }),
            database_1.prisma.feeCategory.findMany({ where: { schoolId } }),
            database_1.prisma.schoolClass.findMany({ where: { schoolId } }),
            database_1.prisma.academicYear.findMany({ where: { schoolId } }),
        ]);
        return { structures, categories, classes, academicYears };
    }
    async createFeeStructure(schoolId, data) {
        let academicYearId = data.academicYearId;
        if (!academicYearId) {
            const cur = await database_1.prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } });
            academicYearId = cur?.id;
        }
        return database_1.prisma.feeStructure.create({
            data: {
                schoolId,
                academicYearId,
                classId: data.classId,
                categoryId: data.categoryId,
                amount: parseFloat(data.amount),
                frequency: data.frequency || 'ANNUAL',
                dueDate: new Date(data.dueDate),
            },
            include: {
                category: true,
                class: true,
            },
        });
    }
    async getStudentFees(schoolId, query) {
        const where = { schoolId };
        if (query.status)
            where.status = query.status;
        if (query.isDefaulter) {
            where.status = { in: [client_1.FeeStatus.UNPAID, client_1.FeeStatus.PARTIAL, client_1.FeeStatus.OVERDUE] };
        }
        if (query.classId) {
            where.student = { classId: query.classId };
        }
        if (query.search) {
            where.student = {
                ...where.student,
                OR: [
                    { firstName: { contains: query.search, mode: 'insensitive' } },
                    { lastName: { contains: query.search, mode: 'insensitive' } },
                    { studentCode: { contains: query.search, mode: 'insensitive' } },
                    { admissionNo: { contains: query.search, mode: 'insensitive' } },
                ],
            };
        }
        return database_1.prisma.studentFee.findMany({
            where,
            include: {
                student: {
                    include: {
                        class: true,
                        section: true,
                    },
                },
                feeStructure: {
                    include: { category: true },
                },
                payments: {
                    orderBy: { paymentDate: 'desc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async collectFee(schoolId, collectorUserId, data) {
        const studentFee = await database_1.prisma.studentFee.findFirst({
            where: { id: data.studentFeeId, schoolId },
            include: { student: true, feeStructure: { include: { category: true } } },
        });
        if (!studentFee)
            throw new Error('Fee record not found');
        const amountPaid = parseFloat(data.amountPaid);
        if (isNaN(amountPaid) || amountPaid <= 0) {
            throw new Error('Valid payment amount required');
        }
        const newPaidAmount = studentFee.paidAmount + amountPaid;
        const newBalance = Math.max(0, studentFee.amount - studentFee.discount - newPaidAmount);
        const newStatus = newBalance <= 0 ? client_1.FeeStatus.PAID : client_1.FeeStatus.PARTIAL;
        // Generate unique receipt number
        const count = await database_1.prisma.feePayment.count({ where: { schoolId } });
        const year = new Date().getFullYear();
        const receiptNumber = `REC-${year}-${String(count + 1).padStart(4, '0')}`;
        const [payment] = await database_1.prisma.$transaction([
            database_1.prisma.feePayment.create({
                data: {
                    schoolId,
                    studentFeeId: studentFee.id,
                    receiptNumber,
                    amountPaid,
                    paymentDate: new Date(),
                    paymentMethod: data.paymentMethod || client_1.FeePaymentMethod.CASH,
                    transactionRef: data.transactionRef || null,
                    collectedById: collectorUserId,
                    remarks: data.remarks || 'Fee collected at office counter',
                },
            }),
            database_1.prisma.studentFee.update({
                where: { id: studentFee.id },
                data: {
                    paidAmount: newPaidAmount,
                    balanceAmount: newBalance,
                    status: newStatus,
                },
            }),
        ]);
        return {
            payment,
            receiptNumber,
            student: studentFee.student,
            feeCategory: studentFee.feeStructure.category.name,
            amountPaid,
            remainingBalance: newBalance,
            status: newStatus,
        };
    }
    async getReceipt(schoolId, receiptNumber) {
        const payment = await database_1.prisma.feePayment.findFirst({
            where: { receiptNumber, schoolId },
            include: {
                studentFee: {
                    include: {
                        student: {
                            include: { class: true, section: true },
                        },
                        feeStructure: {
                            include: { category: true, academicYear: true },
                        },
                    },
                },
            },
        });
        if (!payment)
            throw new Error('Receipt not found');
        return payment;
    }
    // Documents
    async getDocuments(schoolId, query) {
        const where = { schoolId };
        if (query.status)
            where.status = query.status;
        if (query.studentId)
            where.studentId = query.studentId;
        const docs = await database_1.prisma.studentDocument.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                student: {
                    include: { class: true, section: true },
                },
            },
        });
        // Populate presigned view URLs for S3 documents
        return Promise.all(docs.map(async (doc) => {
            const viewUrl = await storage_service_1.storageService.getDocumentViewUrl(doc.fileUrl);
            return {
                ...doc,
                viewUrl,
            };
        }));
    }
    async verifyDocument(schoolId, documentId, verifierUserId, data) {
        const doc = await database_1.prisma.studentDocument.findFirst({
            where: { id: documentId, schoolId },
        });
        if (!doc)
            throw new Error('Document not found');
        return database_1.prisma.studentDocument.update({
            where: { id: documentId },
            data: {
                status: data.status,
                verifiedById: verifierUserId,
                verifiedAt: new Date(),
                remarks: data.remarks || null,
            },
        });
    }
    async uploadDocument(schoolId, data) {
        return database_1.prisma.studentDocument.create({
            data: {
                schoolId,
                studentId: data.studentId,
                documentType: data.documentType,
                documentName: data.documentName,
                fileUrl: data.fileUrl || 'https://storage.edusaas.com/docs/placeholder.pdf',
                status: client_1.DocumentStatus.PENDING,
            },
            include: { student: true },
        });
    }
    async uploadDocumentFile(schoolId, data) {
        const student = await database_1.prisma.student.findFirst({
            where: { id: data.studentId, schoolId },
        });
        if (!student)
            throw new Error('Student not found in this institution');
        const documentName = data.documentName && data.documentName.trim()
            ? data.documentName.trim()
            : data.file.originalname;
        // Upload to S3 (Railway S3 / AWS S3)
        const uploadResult = await storage_service_1.storageService.uploadStudentDocument({
            schoolId,
            studentId: student.id,
            documentType: data.documentType,
            originalFilename: data.file.originalname,
            buffer: data.file.buffer,
            mimetype: data.file.mimetype,
            size: data.file.size,
        });
        const doc = await database_1.prisma.studentDocument.create({
            data: {
                schoolId,
                studentId: student.id,
                documentType: data.documentType,
                documentName,
                fileUrl: uploadResult.fileUrl,
                status: client_1.DocumentStatus.PENDING,
                remarks: data.remarks || null,
            },
            include: {
                student: {
                    include: { class: true, section: true },
                },
            },
        });
        const viewUrl = await storage_service_1.storageService.getDocumentViewUrl(doc.fileUrl);
        return {
            ...doc,
            viewUrl,
            storage: uploadResult.storage,
        };
    }
    async getDocumentViewUrl(schoolId, documentId) {
        const doc = await database_1.prisma.studentDocument.findFirst({
            where: { id: documentId, schoolId },
        });
        if (!doc)
            throw new Error('Document not found');
        const viewUrl = await storage_service_1.storageService.getDocumentViewUrl(doc.fileUrl);
        return { id: doc.id, documentName: doc.documentName, fileUrl: doc.fileUrl, viewUrl };
    }
    async deleteDocument(schoolId, documentId) {
        const doc = await database_1.prisma.studentDocument.findFirst({
            where: { id: documentId, schoolId },
        });
        if (!doc)
            throw new Error('Document not found');
        await storage_service_1.storageService.deleteDocument(doc.fileUrl);
        await database_1.prisma.studentDocument.delete({
            where: { id: documentId },
        });
        return { success: true };
    }
    // Certificates
    async getCertificates(schoolId) {
        return database_1.prisma.certificate.findMany({
            where: { schoolId },
            orderBy: { issueDate: 'desc' },
            include: {
                student: {
                    include: { class: true, section: true },
                },
            },
        });
    }
    async generateCertificate(schoolId, issuerUserId, data) {
        const student = await database_1.prisma.student.findFirst({
            where: { id: data.studentId, schoolId },
            include: { class: true, section: true },
        });
        if (!student)
            throw new Error('Student not found');
        const count = await database_1.prisma.certificate.count({ where: { schoolId } });
        const year = new Date().getFullYear();
        const certNum = `CERT-${data.certificateType}-${year}-${String(count + 1).padStart(4, '0')}`;
        const content = data.contentJson || {
            studentName: `${student.firstName} ${student.lastName}`,
            studentCode: student.studentCode,
            admissionNo: student.admissionNo,
            class: student.class?.name || 'N/A',
            section: student.section?.name || 'N/A',
            issueDate: new Date().toLocaleDateString(),
            issuedBy: 'Office Administration',
        };
        return database_1.prisma.certificate.create({
            data: {
                schoolId,
                studentId: student.id,
                certificateType: data.certificateType,
                certificateNumber: certNum,
                issuedById: issuerUserId,
                contentJson: content,
                status: 'ISSUED',
            },
            include: { student: true },
        });
    }
}
exports.OfficeAdminService = OfficeAdminService;
exports.officeAdminService = new OfficeAdminService();
