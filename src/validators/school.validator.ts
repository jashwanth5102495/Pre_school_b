import { z } from 'zod';
import { SchoolStatus, SubscriptionStatus, BillingCycle } from '@prisma/client';

export const createSchoolSchema = z.object({
  // Section A: Basic Information
  name: z.string().min(3, 'School name must be at least 3 characters'),
  code: z.string().min(2, 'School code must be at least 2 characters').toUpperCase(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  type: z.string().min(2, 'School type is required'),
  board: z.string().min(2, 'Board affiliation is required'),
  registrationNumber: z.string().min(2, 'Registration number is required'),
  establishedYear: z.number().int().min(1800).max(new Date().getFullYear()),
  website: z.string().url().optional().or(z.literal('')),

  // Section B: Contact Information
  officialEmail: z.string().email('Valid official email required'),
  primaryPhone: z.string().min(8, 'Primary phone is required'),
  alternatePhone: z.string().optional().or(z.literal('')),
  contactPerson: z.string().min(2, 'Contact person name is required'),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  country: z.string().min(2, 'Country is required').default('India'),
  postalCode: z.string().min(4, 'Postal code is required'),

  // Section C: Academic Information
  academicYear: z.string().min(4, 'Academic year is required (e.g. 2026-2027)'),
  mediumOfInstruction: z.string().min(2, 'Medium of instruction is required').default('English'),
  workingDays: z.array(z.string()).min(1, 'At least one working day must be selected'),

  // Section D: Subscription
  planId: z.string().uuid('Valid plan ID required'),
  billingCycle: z.nativeEnum(BillingCycle).default(BillingCycle.ANNUAL),
  startDate: z.string().optional(),
  maxStudentsOverride: z.number().int().positive().optional(),
  maxTeachersOverride: z.number().int().positive().optional(),

  // Section E: School Admin Account
  adminFullName: z.string().min(2, 'Admin full name is required'),
  adminEmail: z.string().email('Admin email is required'),
  adminPhone: z.string().min(8, 'Admin phone is required'),
  adminPassword: z.string().min(8, 'Password must be at least 8 characters long').optional(),
});

export const updateSchoolSchema = z.object({
  name: z.string().min(3).optional(),
  type: z.string().optional(),
  board: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  logoUrl: z.string().url().optional().or(z.literal('')),
  officialEmail: z.string().email().optional(),
  primaryPhone: z.string().optional(),
  contactPerson: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
});

export const updateSchoolStatusSchema = z.object({
  status: z.nativeEnum(SchoolStatus),
  reason: z.string().optional(),
});
