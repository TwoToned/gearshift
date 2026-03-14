import { z } from "zod";

export const crewMemberSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(200),
  lastName: z.string().min(1, "Last name is required").max(200),
  email: z.string().email().max(200).optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  type: z.enum(["EMPLOYEE", "FREELANCER", "CONTRACTOR", "VOLUNTEER"]).default("FREELANCER"),
  status: z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE", "ARCHIVED"]).default("ACTIVE"),
  department: z.string().max(100).optional(),
  crewRoleId: z.string().optional().or(z.literal("")),
  defaultDayRate: z.union([z.literal(""), z.coerce.number().min(0)]).optional()
    .transform(v => v === "" ? undefined : v),
  defaultHourlyRate: z.union([z.literal(""), z.coerce.number().min(0)]).optional()
    .transform(v => v === "" ? undefined : v),
  overtimeMultiplier: z.union([z.literal(""), z.coerce.number().min(0)]).optional()
    .transform(v => v === "" ? undefined : v),
  currency: z.string().max(10).optional(),
  address: z.string().max(500).optional(),
  addressLatitude: z.union([z.null(), z.coerce.number()]).optional(),
  addressLongitude: z.union([z.null(), z.coerce.number()]).optional(),
  emergencyContactName: z.string().max(200).optional(),
  emergencyContactPhone: z.string().max(50).optional(),
  dateOfBirth: z.union([z.literal(""), z.coerce.date()]).optional()
    .transform(v => v === "" ? undefined : v),
  abnOrGst: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string()).default([]),
  skillIds: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
}).refine(
  (data) => (data.addressLatitude != null) === (data.addressLongitude != null),
  { message: "Both latitude and longitude must be provided together" }
);

export type CrewMemberFormValues = z.input<typeof crewMemberSchema>;

export const crewRoleSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(500).optional(),
  department: z.string().max(100).optional(),
  color: z.string().max(20).optional(),
  defaultRate: z.union([z.literal(""), z.coerce.number().min(0)]).optional()
    .transform(v => v === "" ? undefined : v),
  rateType: z.enum(["HOURLY", "DAILY", "FLAT"]).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export type CrewRoleFormValues = z.input<typeof crewRoleSchema>;

export const crewSkillSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  category: z.string().max(100).optional(),
});

export type CrewSkillFormValues = z.input<typeof crewSkillSchema>;

export const crewCertificationSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  issuedBy: z.string().max(200).optional(),
  certificateNumber: z.string().max(100).optional(),
  issuedDate: z.union([z.literal(""), z.coerce.date()]).optional()
    .transform(v => v === "" ? undefined : v),
  expiryDate: z.union([z.literal(""), z.coerce.date()]).optional()
    .transform(v => v === "" ? undefined : v),
  status: z.enum(["CURRENT", "EXPIRING_SOON", "EXPIRED", "NOT_VERIFIED"]).default("NOT_VERIFIED"),
});

export type CrewCertificationFormValues = z.input<typeof crewCertificationSchema>;
