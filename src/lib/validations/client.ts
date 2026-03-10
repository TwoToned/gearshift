import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  type: z.enum(["COMPANY", "INDIVIDUAL", "VENUE", "PRODUCTION_COMPANY"]).default("COMPANY"),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email("Invalid email").max(200).optional().or(z.literal("")),
  contactPhone: z.string().max(50).optional(),
  billingAddress: z.string().max(500).optional(),
  shippingAddress: z.string().max(500).optional(),
  taxId: z.string().max(50).optional(),
  paymentTerms: z.string().max(100).optional(),
  defaultDiscount: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export type ClientFormValues = z.input<typeof clientSchema>;
