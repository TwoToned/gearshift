# Key Patterns & Conventions

## Server Action Pattern
```typescript
"use server";
export async function myAction(data: InputType) {
  const { organizationId, userId, userName } = await getOrgContext();
  await requirePermission("resource", "action");
  const result = await prisma.model.create({ data: { ...data, organizationId } });
  await logActivity({ organizationId, userId, userName, action: "CREATE", entityType: "model", entityId: result.id, entityName: result.name, summary: `Created ${result.name}` });
  return serialize(result);
}
```

## Form Validation Pattern
```typescript
// src/lib/validations/my-form.ts
export const mySchema = z.object({
  name: z.string().min(1, "Required"),
  date: z.union([z.literal(""), z.coerce.date()]).optional()
    .transform(v => v === "" ? undefined : v),
  price: z.coerce.number().optional(),
  tags: z.array(z.string()).default([]),
});
export type MyFormValues = z.input<typeof mySchema>; // NOT z.infer
```

## Client Component Pattern
```typescript
"use client";
export default function MyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading } = useQuery({ queryKey: ["my-item", id], queryFn: () => getMyItem(id) });
  const mutation = useMutation({
    mutationFn: updateMyItem,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["my-item"] }); toast.success("Updated"); },
    onError: (e) => toast.error(e.message),
  });
}
```

## Date Handling
Server actions receive dates as strings after serialization. Always wrap:
```typescript
const date = input.scheduledDate ? new Date(input.scheduledDate) : null;
```

## Important Gotchas
- Zod schemas CANNOT be exported from `"use server"` files — must be in `src/lib/validations/`
- `@react-pdf/renderer` can't render Unicode symbols with Helvetica — use `View` boxes
- `BulkAsset.count()` returns record count, not total quantity — use `.aggregate({ _sum: { totalQuantity: true } })`
- Kit join tables use `addedAt` (not `createdAt`)
- Bulk detection on line items: `!!lineItem.bulkAssetId || (!lineItem.assetId && lineItem.quantity > 1)`
- Kit detection on line items: `!!lineItem.kitId && !lineItem.isKitChild`
