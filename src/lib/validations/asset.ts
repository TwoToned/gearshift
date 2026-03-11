import { z } from "zod";

export const assetSchema = z.object({
  modelId: z.string().min(1, "Model is required"),
  assetTag: z.string().min(1, "Asset tag is required").max(50),
  serialNumber: z.string().max(100).optional(),
  customName: z.string().max(200).optional(),
  status: z.enum(["AVAILABLE", "CHECKED_OUT", "IN_MAINTENANCE", "RETIRED", "LOST", "RESERVED"]).default("AVAILABLE"),
  condition: z.enum(["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"]).default("NEW"),
  purchaseDate: z.union([z.literal(""), z.coerce.date()]).optional().transform(v => v === "" ? undefined : v),
  purchasePrice: z.union([z.literal(""), z.coerce.number().min(0)]).optional().transform(v => v === "" ? undefined : v),
  purchaseSupplier: z.string().max(200).optional(),
  supplierId: z.string().optional(),
  warrantyExpiry: z.union([z.literal(""), z.coerce.date()]).optional().transform(v => v === "" ? undefined : v),
  notes: z.string().max(2000).optional(),
  locationId: z.string().optional(),
  customFieldValues: z.record(z.string(), z.string()).optional(),
  barcode: z.string().max(100).optional(),
  images: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export type AssetFormValues = z.input<typeof assetSchema>;

export const bulkAssetSchema = z.object({
  modelId: z.string().min(1, "Model is required"),
  assetTag: z.string().min(1, "Asset tag is required").max(50),
  totalQuantity: z.coerce.number().int().min(0, "Quantity must be 0 or more").default(0),
  purchasePricePerUnit: z.coerce.number().min(0).optional(),
  locationId: z.string().optional(),
  status: z.enum(["ACTIVE", "LOW_STOCK", "OUT_OF_STOCK", "RETIRED"]).default("ACTIVE"),
  reorderThreshold: z.coerce.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
  isActive: z.boolean().default(true),
});

export type BulkAssetFormValues = z.input<typeof bulkAssetSchema>;

export const locationSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  address: z.string().max(500).optional(),
  type: z.enum(["WAREHOUSE", "VENUE", "VEHICLE", "OFFSITE"]).default("WAREHOUSE"),
  isDefault: z.boolean().default(false),
  parentId: z.string().nullable().optional(),
  notes: z.string().max(1000).optional(),
});

export type LocationFormValues = z.input<typeof locationSchema>;

export const supplierSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  contactName: z.string().max(200).optional(),
  email: z.string().email().max(200).optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  website: z.string().max(500).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export type SupplierFormValues = z.input<typeof supplierSchema>;
