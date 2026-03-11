import { z } from "zod";

export const customRoleSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(50, "Name must be under 50 characters"),
  description: z.string().max(200).optional(),
  color: z.string().optional(),
  permissions: z.record(z.string(), z.array(z.string())),
});

export type CustomRoleFormValues = z.input<typeof customRoleSchema>;
