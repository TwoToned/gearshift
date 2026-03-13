import { z } from "zod";

export const modelAccessorySchema = z.object({
  accessoryModelId: z.string().min(1, "Accessory model is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  level: z.enum(["MANDATORY", "OPTIONAL", "RECOMMENDED"]),
  notes: z.string().optional(),
});

export type ModelAccessoryFormValues = z.input<typeof modelAccessorySchema>;
