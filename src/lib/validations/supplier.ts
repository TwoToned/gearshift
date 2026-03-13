import { z } from "zod";

export const supplierSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  contactName: z.string().max(200).optional(),
  email: z.string().email().max(200).optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  website: z.string().max(500).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  accountNumber: z.string().max(100).optional(),
  paymentTerms: z.string().max(100).optional(),
  defaultLeadTime: z.string().max(100).optional(),
  tags: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export type SupplierFormValues = z.input<typeof supplierSchema>;
