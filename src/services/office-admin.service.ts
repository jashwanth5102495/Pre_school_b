import { prisma } from '../config/database';
import { AdmissionStatus, DocumentStatus, FeeStatus, FeePaymentMethod, CertificateType } from '@prisma/client';
import { storageService } from './storage.service';

export class OfficeAdminService {
  async getDashboard(schoolId: string) {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      pendingAdmissionsCount,
      approvedAdmissionsCount,
      totalStudents,
      monthFeeAgg,
      totalPendingFeeAgg,
      pendingDocumentsCount,
      recentAdmissions,
      recentPayments,
    ] = await Promise.all([
      prisma.admissionApplication.count({ where: { schoolId, status: AdmissionStatus.PENDING } }),
      prisma.admissionApplication.count({ where: { schoolId, status: AdmissionStatus.APPROVED } }),
      prisma.student.count({ where: { schoolId, status: 'ACTIVE' } }),
      prisma.feePayment.aggregate({
        where: { schoolId, paymentDate: { gte: firstDayOfMonth } },
        _sum: { amountPaid: true },
        _count: { id: true },
      }),
      prisma.studentFee.aggregate({
        where: { schoolId, status: { in: [FeeStatus.UNPAID, FeeStatus.PARTIAL, FeeStatus.OVERDUE] } },
        _sum: { balanceAmount: true },
        _count: { id: true },
      }),
      prisma.studentDocument.count({ where: { schoolId, status: DocumentStatus.PENDING } }),
      prisma.admissionApplication.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { applyingClass: true },
      }),
      prisma.feePayment.findMany({
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
  async getAdmissions(schoolId: string, query: { status?: AdmissionStatus; search?: string }) {
    const where: any = { schoolId };
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { applicationNumber: { contains: query.search, mode: 'insensitive' } },
        { parentName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return prisma.admissionApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { applyingClass: true },
    });
  }

  async createAdmission(schoolId: string, data: any) {
    const count = await prisma.admissionApplication.count({ where: { schoolId } });
    const year = new Date().getFullYear();
    const appNum = `APP-${year}-${String(count + 1).padStart(4, '0')}`;

    return prisma.admissionApplication.create({
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
        status: AdmissionStatus.PENDING,
        remarks: data.remarks || null,
      },
      include: { applyingClass: true },
    });
  }

  async updateAdmissionStatus(
    schoolId: string,
    id: string,
    reviewerId: string,
    data: { status: AdmissionStatus; remarks?: string }
  ) {
    const existing = await prisma.admissionApplication.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new Error('Admission application not found');

    return prisma.admissionApplication.update({
      where: { id },
      data: {
        status: data.status,
        reviewedById: reviewerId,
        remarks: data.remarks || existing.remarks,
      },
      include: { applyingClass: true },
    });
  }

  async enrollStudent(
    schoolId: string,
    admissionId: string,
    data: { classId: string; sectionId: string; feeStructureIds?: string[] }
  ) {
    const app = await prisma.admissionApplication.findFirst({
      where: { id: admissionId, schoolId },
    });
    if (!app) throw new Error('Admission application not found');

    const studentCount = await prisma.student.count({ where: { schoolId } });
    const year = new Date().getFullYear();
    const studentCode = `STU-${String(studentCount + 1).padStart(4, '0')}`;
    const admissionNo = `ADM-${year}-${String(studentCount + 1).padStart(3, '0')}`;

    // Create student
    const student = await prisma.student.create({
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
    await prisma.admissionApplication.update({
      where: { id: admissionId },
      data: { status: AdmissionStatus.ADMITTED },
    });

    // Attach fee structures if provided or auto-attach active class fee structures
    const currentYear = await prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
    });

    if (currentYear) {
      let structuresToAttach = data.feeStructureIds;
      if (!structuresToAttach || structuresToAttach.length === 0) {
        const classStructures = await prisma.feeStructure.findMany({
          where: { schoolId, classId: data.classId, academicYearId: currentYear.id },
        });
        structuresToAttach = classStructures.map((s) => s.id);
      }

      for (const structureId of structuresToAttach) {
        const struct = await prisma.feeStructure.findUnique({ where: { id: structureId } });
        if (struct) {
          await prisma.studentFee.create({
            data: {
              schoolId,
              studentId: student.id,
              feeStructureId: struct.id,
              academicYearId: currentYear.id,
              amount: struct.amount,
              paidAmount: 0,
              balanceAmount: struct.amount,
              status: FeeStatus.UNPAID,
              dueDate: struct.dueDate,
            },
          });
        }
      }
    }

    return student;
  }

  // Fees
  async getFeeStructures(schoolId: string) {
    const [structures, categories, classes, academicYears] = await Promise.all([
      prisma.feeStructure.findMany({
        where: { schoolId },
        include: {
          category: true,
          class: true,
          academicYear: true,
          _count: { select: { studentFees: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.feeCategory.findMany({ where: { schoolId } }),
      prisma.schoolClass.findMany({ where: { schoolId } }),
      prisma.academicYear.findMany({ where: { schoolId } }),
    ]);

    return { structures, categories, classes, academicYears };
  }

  async createFeeStructure(schoolId: string, data: any) {
    let academicYearId = data.academicYearId;
    if (!academicYearId) {
      const cur = await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } });
      academicYearId = cur?.id;
    }

    return prisma.feeStructure.create({
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

  async getStudentFees(
    schoolId: string,
    query: { classId?: string; status?: FeeStatus; isDefaulter?: boolean; search?: string }
  ) {
    const where: any = { schoolId };
    if (query.status) where.status = query.status;
    if (query.isDefaulter) {
      where.status = { in: [FeeStatus.UNPAID, FeeStatus.PARTIAL, FeeStatus.OVERDUE] };
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

    return prisma.studentFee.findMany({
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

  async collectFee(
    schoolId: string,
    collectorUserId: string,
    data: {
      studentFeeId: string;
      amountPaid: number;
      paymentMethod: FeePaymentMethod;
      transactionRef?: string;
      remarks?: string;
    }
  ) {
    const studentFee = await prisma.studentFee.findFirst({
      where: { id: data.studentFeeId, schoolId },
      include: { student: true, feeStructure: { include: { category: true } } },
    });

    if (!studentFee) throw new Error('Fee record not found');

    const amountPaid = parseFloat(data.amountPaid as any);
    if (isNaN(amountPaid) || amountPaid <= 0) {
      throw new Error('Valid payment amount required');
    }

    const newPaidAmount = studentFee.paidAmount + amountPaid;
    const newBalance = Math.max(0, studentFee.amount - studentFee.discount - newPaidAmount);
    const newStatus = newBalance <= 0 ? FeeStatus.PAID : FeeStatus.PARTIAL;

    // Generate unique receipt number
    const count = await prisma.feePayment.count({ where: { schoolId } });
    const year = new Date().getFullYear();
    const receiptNumber = `REC-${year}-${String(count + 1).padStart(4, '0')}`;

    const [payment] = await prisma.$transaction([
      prisma.feePayment.create({
        data: {
          schoolId,
          studentFeeId: studentFee.id,
          receiptNumber,
          amountPaid,
          paymentDate: new Date(),
          paymentMethod: data.paymentMethod || FeePaymentMethod.CASH,
          transactionRef: data.transactionRef || null,
          collectedById: collectorUserId,
          remarks: data.remarks || 'Fee collected at office counter',
        },
      }),
      prisma.studentFee.update({
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

  async getReceipt(schoolId: string, receiptNumber: string) {
    const payment = await prisma.feePayment.findFirst({
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

    if (!payment) throw new Error('Receipt not found');
    return payment;
  }

  // Documents
  async getDocuments(schoolId: string, query: { status?: DocumentStatus; studentId?: string }) {
    const where: any = { schoolId };
    if (query.status) where.status = query.status;
    if (query.studentId) where.studentId = query.studentId;

    const docs = await prisma.studentDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          include: { class: true, section: true },
        },
      },
    });

    // Populate presigned view URLs for S3 documents
    return Promise.all(
      docs.map(async (doc) => {
        const viewUrl = await storageService.getDocumentViewUrl(doc.fileUrl);
        return {
          ...doc,
          viewUrl,
        };
      })
    );
  }

  async verifyDocument(
    schoolId: string,
    documentId: string,
    verifierUserId: string,
    data: { status: DocumentStatus; remarks?: string }
  ) {
    const doc = await prisma.studentDocument.findFirst({
      where: { id: documentId, schoolId },
    });
    if (!doc) throw new Error('Document not found');

    return prisma.studentDocument.update({
      where: { id: documentId },
      data: {
        status: data.status,
        verifiedById: verifierUserId,
        verifiedAt: new Date(),
        remarks: data.remarks || null,
      },
    });
  }

  async uploadDocument(schoolId: string, data: any) {
    return prisma.studentDocument.create({
      data: {
        schoolId,
        studentId: data.studentId,
        documentType: data.documentType,
        documentName: data.documentName,
        fileUrl: data.fileUrl || 'https://storage.edusaas.com/docs/placeholder.pdf',
        status: DocumentStatus.PENDING,
      },
      include: { student: true },
    });
  }

  async uploadDocumentFile(
    schoolId: string,
    data: {
      studentId: string;
      documentType: string;
      documentName?: string;
      remarks?: string;
      file: Express.Multer.File;
    }
  ) {
    const student = await prisma.student.findFirst({
      where: { id: data.studentId, schoolId },
    });
    if (!student) throw new Error('Student not found in this institution');

    const documentName =
      data.documentName && data.documentName.trim()
        ? data.documentName.trim()
        : data.file.originalname;

    // Upload to S3 (Railway S3 / AWS S3)
    const uploadResult = await storageService.uploadStudentDocument({
      schoolId,
      studentId: student.id,
      documentType: data.documentType,
      originalFilename: data.file.originalname,
      buffer: data.file.buffer,
      mimetype: data.file.mimetype,
      size: data.file.size,
    });

    const doc = await prisma.studentDocument.create({
      data: {
        schoolId,
        studentId: student.id,
        documentType: data.documentType,
        documentName,
        fileUrl: uploadResult.fileUrl,
        status: DocumentStatus.PENDING,
        remarks: data.remarks || null,
      },
      include: {
        student: {
          include: { class: true, section: true },
        },
      },
    });

    const viewUrl = await storageService.getDocumentViewUrl(doc.fileUrl);

    return {
      ...doc,
      viewUrl,
      storage: uploadResult.storage,
    };
  }

  async getDocumentViewUrl(schoolId: string, documentId: string) {
    const doc = await prisma.studentDocument.findFirst({
      where: { id: documentId, schoolId },
    });
    if (!doc) throw new Error('Document not found');

    const viewUrl = await storageService.getDocumentViewUrl(doc.fileUrl);
    return { id: doc.id, documentName: doc.documentName, fileUrl: doc.fileUrl, viewUrl };
  }

  async deleteDocument(schoolId: string, documentId: string) {
    const doc = await prisma.studentDocument.findFirst({
      where: { id: documentId, schoolId },
    });
    if (!doc) throw new Error('Document not found');

    await storageService.deleteDocument(doc.fileUrl);
    await prisma.studentDocument.delete({
      where: { id: documentId },
    });
    return { success: true };
  }

  // Certificates
  async getCertificates(schoolId: string) {
    return prisma.certificate.findMany({
      where: { schoolId },
      orderBy: { issueDate: 'desc' },
      include: {
        student: {
          include: { class: true, section: true },
        },
      },
    });
  }

  async generateCertificate(
    schoolId: string,
    issuerUserId: string,
    data: { studentId: string; certificateType: CertificateType; contentJson?: any }
  ) {
    const student = await prisma.student.findFirst({
      where: { id: data.studentId, schoolId },
      include: { class: true, section: true },
    });
    if (!student) throw new Error('Student not found');

    const count = await prisma.certificate.count({ where: { schoolId } });
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

    return prisma.certificate.create({
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

export const officeAdminService = new OfficeAdminService();
