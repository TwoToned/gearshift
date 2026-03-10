import { z } from "zod";

export const lineItemSchema = z.object({
  type: z
    .enum(["EQUIPMENT", "SERVICE", "LABOUR", "TRANSPORT", "MISC"])
    .default("EQUIPMENT"),
  modelId: z.string().optional(),
  assetId: z.string().optional(),
  bulkAssetId: z.string().optional(),
  description: z.string().max(500).optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  unitPrice: z.coerce.number().min(0).optional(),
  pricingType: z.enum(["PER_DAY", "PER_WEEK", "FLAT", "PER_HOUR"]).default("PER_DAY"),
  duration: z.coerce.number().int().min(1).default(1),
  discount: z.coerce.number().min(0).optional(),
  groupName: z.string().optional(),
  notes: z.string().optional(),
  isOptional: z.boolean().default(false),
});

export type LineItemFormValues = z.input<typeof lineItemSchema>;
