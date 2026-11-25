"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSchoolStatusSchema = exports.updateSchoolSchema = exports.createSchoolSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.createSchoolSchema = zod_1.z.object({
    // Section A: Basic Information
    name: zod_1.z.string().min(3, 'School name must be at least 3 characters'),
    code: zod_1.z.string().min(2, 'School code must be at least 2 characters').toUpperCase(),
    logoUrl: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
    type: zod_1.z.string().min(2, 'School type is required'),
    board: zod_1.z.string().min(2, 'Board affiliation is required'),
    registrationNumber: zod_1.z.string().min(2, 'Registration number is required'),
    establishedYear: zod_1.z.number().int().min(1800).max(new Date().getFullYear()),
    website: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
    // Section B: Contact Information
    officialEmail: zod_1.z.string().email('Valid official email required'),
    primaryPhone: zod_1.z.string().min(8, 'Primary phone is required'),
    alternatePhone: zod_1.z.string().optional().or(zod_1.z.literal('')),
    contactPerson: zod_1.z.string().min(2, 'Contact person name is required'),
    address: zod_1.z.string().min(5, 'Address is required'),
    city: zod_1.z.string().min(2, 'City is required'),
    state: zod_1.z.string().min(2, 'State is required'),
    country: zod_1.z.string().min(2, 'Country is required').default('India'),
    postalCode: zod_1.z.string().min(4, 'Postal code is required'),
    // Section C: Academic Information
    academicYear: zod_1.z.string().min(4, 'Academic year is required (e.g. 2026-2027)'),
    mediumOfInstruction: zod_1.z.string().min(2, 'Medium of instruction is required').default('English'),
    workingDays: zod_1.z.array(zod_1.z.string()).min(1, 'At least one working day must be selected'),
    // Section D: Subscription
    planId: zod_1.z.string().uuid('Valid plan ID required'),
    billingCycle: zod_1.z.nativeEnum(client_1.BillingCycle).default(client_1.BillingCycle.ANNUAL),
    startDate: zod_1.z.string().optional(),
    maxStudentsOverride: zod_1.z.number().int().positive().optional(),
    maxTeachersOverride: zod_1.z.number().int().positive().optional(),
    // Section E: School Admin Account
    adminFullName: zod_1.z.string().min(2, 'Admin full name is required'),
    adminEmail: zod_1.z.string().email('Admin email is required'),
    adminPhone: zod_1.z.string().min(8, 'Admin phone is required'),
    adminPassword: zod_1.z.string().min(8, 'Password must be at least 8 characters long').optional(),
});
exports.updateSchoolSchema = zod_1.z.object({
    name: zod_1.z.string().min(3).optional(),
    type: zod_1.z.string().optional(),
    board: zod_1.z.string().optional(),
    website: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
    logoUrl: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
    officialEmail: zod_1.z.string().email().optional(),
    primaryPhone: zod_1.z.string().optional(),
    contactPerson: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    postalCode: zod_1.z.string().optional(),
});
exports.updateSchoolStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.SchoolStatus),
    reason: zod_1.z.string().optional(),
});
