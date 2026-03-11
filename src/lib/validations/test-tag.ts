import { z } from "zod";

export const testTagAssetSchema = z.object({
  testTagId: z.string().min(1, "Test Tag ID is required").max(50),
  description: z.string().min(1, "Description is required").max(500),
  equipmentClass: z.enum(["CLASS_I", "CLASS_II", "CLASS_II_DOUBLE_INSULATED", "LEAD_CORD_ASSEMBLY"]).default("CLASS_I"),
  applianceType: z.enum([
    "APPLIANCE", "CORD_SET", "EXTENSION_LEAD", "POWER_BOARD",
    "RCD_PORTABLE", "RCD_FIXED", "THREE_PHASE", "OTHER",
  ]).default("APPLIANCE"),
  make: z.string().max(200).optional(),
  modelName: z.string().max(200).optional(),
  serialNumber: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  testIntervalMonths: z.coerce.number().int().min(1).max(120).default(3),
  notes: z.string().max(2000).optional(),
  assetId: z.string().optional(),
  bulkAssetId: z.string().optional(),
});

export type TestTagAssetFormValues = z.input<typeof testTagAssetSchema>;

export const testTagRecordSchema = z.object({
  testTagAssetId: z.string().min(1, "Test tag asset is required"),
  testDate: z.coerce.date(),
  testerName: z.string().min(1, "Tester name is required").max(200),
  result: z.enum(["PASS", "FAIL"]).default("PASS"),

  // Visual inspection
  visualInspectionResult: z.enum(["PASS", "FAIL"]).default("PASS"),
  visualCordCondition: z.boolean().optional(),
  visualPlugCondition: z.boolean().optional(),
  visualHousingCondition: z.boolean().optional(),
  visualSwitchCondition: z.boolean().optional(),
  visualVentsUnobstructed: z.boolean().optional(),
  visualCordGrip: z.boolean().optional(),
  visualEarthPin: z.boolean().optional(),
  visualMarkingsLegible: z.boolean().optional(),
  visualNoModifications: z.boolean().optional(),
  visualNotes: z.string().max(2000).optional(),

  // Electrical tests
  equipmentClassTested: z.enum(["CLASS_I", "CLASS_II", "CLASS_II_DOUBLE_INSULATED", "LEAD_CORD_ASSEMBLY"]).default("CLASS_I"),
  testMethod: z.enum(["INSULATION_RESISTANCE", "LEAKAGE_CURRENT", "BOTH"]).default("INSULATION_RESISTANCE"),

  earthContinuityResult: z.enum(["PASS", "FAIL", "NOT_APPLICABLE"]).default("NOT_APPLICABLE"),
  earthContinuityReading: z.coerce.number().min(0).optional(),

  insulationResult: z.enum(["PASS", "FAIL", "NOT_APPLICABLE"]).default("NOT_APPLICABLE"),
  insulationReading: z.coerce.number().min(0).optional(),
  insulationTestVoltage: z.coerce.number().int().optional(),

  leakageCurrentResult: z.enum(["PASS", "FAIL", "NOT_APPLICABLE"]).default("NOT_APPLICABLE"),
  leakageCurrentReading: z.coerce.number().min(0).optional(),

  polarityResult: z.enum(["PASS", "FAIL", "NOT_APPLICABLE"]).default("NOT_APPLICABLE"),

  rcdTripTimeResult: z.enum(["PASS", "FAIL", "NOT_APPLICABLE"]).default("NOT_APPLICABLE"),
  rcdTripTimeReading: z.coerce.number().min(0).optional(),

  functionalTestResult: z.enum(["PASS", "FAIL", "NOT_APPLICABLE"]).default("NOT_APPLICABLE"),
  functionalTestNotes: z.string().max(2000).optional(),

  // Failure details
  failureAction: z.enum(["NONE", "REPAIRED", "REMOVED_FROM_SERVICE", "DISPOSED", "REFERRED_TO_ELECTRICIAN"]).default("NONE"),
  failureNotes: z.string().max(2000).optional(),

  // Next due
  nextDueDate: z.coerce.date(),
});

export type TestTagRecordFormValues = z.input<typeof testTagRecordSchema>;

export const batchCreateTestTagSchema = z.object({
  bulkAssetId: z.string().min(1, "Bulk asset is required"),
  count: z.coerce.number().int().min(1, "Must create at least 1").max(500),
  equipmentClass: z.enum(["CLASS_I", "CLASS_II", "CLASS_II_DOUBLE_INSULATED", "LEAD_CORD_ASSEMBLY"]).default("CLASS_I"),
  applianceType: z.enum([
    "APPLIANCE", "CORD_SET", "EXTENSION_LEAD", "POWER_BOARD",
    "RCD_PORTABLE", "RCD_FIXED", "THREE_PHASE", "OTHER",
  ]).default("APPLIANCE"),
  testIntervalMonths: z.coerce.number().int().min(1).max(120).default(3),
  description: z.string().min(1, "Description is required").max(500),
  make: z.string().max(200).optional(),
  modelName: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
});

export type BatchCreateTestTagFormValues = z.input<typeof batchCreateTestTagSchema>;
