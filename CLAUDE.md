# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GearFlow — a multi-tenant asset and rental management platform for AV/theatre production companies. Full spec in `PROMPT.md`. Built with Next.js 16 (App Router), TypeScript strict, Tailwind CSS v4, shadcn/ui, Better Auth, PostgreSQL + Prisma.

## Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build + type check
npm run lint         # ESLint
npx prisma generate  # Regenerate Prisma client (after schema changes)
npx prisma migrate dev --name <name>  # Create and apply migration
```

No test framework is configured.

## Architecture

### Route Groups
- `src/app/(auth)/` — public pages (login, register, onboarding). Centered card layout, no sidebar.
- `src/app/(app)/` — protected pages. Sidebar + top bar layout via `SidebarProvider`.
- `src/app/api/auth/[...all]/` — Better Auth catch-all handler.

### Auth & Multi-Tenancy
- **Better Auth** with Organization plugin. Server config in `src/lib/auth.ts`, client in `src/lib/auth-client.ts`.
- Middleware (`src/middleware.ts`) checks `better-auth.session_token` cookie; redirects unauthenticated users to `/login`.
- Every session has `activeOrganizationId`. All data must be scoped to it.
- `src/lib/auth-server.ts` — `getSession()`, `requireSession()`, `requireOrganization()`.
- `src/lib/org-context.ts` — `getOrgContext()` returns `{ organizationId, userId }`, `orgWhere()` injects org scope into Prisma queries, `requireRole()` validates membership.
- Roles: owner, admin, manager, staff, warehouse.

### Database
- Prisma v6, client generated to `src/generated/prisma/`. Import from `@/generated/prisma/client` (not `@/generated/prisma`).
- Singleton client in `src/lib/prisma.ts`.
- Every app model has `organizationId` with index. Asset tags and project numbers unique per org (`@@unique([organizationId, assetTag])`).
- After schema changes: run `npx prisma migrate dev`, then `npx prisma generate`, then restart dev server.

### Server Actions (`src/server/`)
- All files use `"use server"` directive. Each function calls `getOrgContext()` for org scoping.
- **Must call `serialize()`** (from `src/lib/serialize.ts`) on all return values — converts Prisma Decimal fields to numbers for client consumption.
- Pagination pattern: accept `{ page, pageSize }`, return `{ items, total, page, pageSize, totalPages }`.
- Error pattern: throw `new Error("message")`, caught by client mutations via `toast.error(e.message)`.

### UI Conventions
- **shadcn/ui v4 uses `render` prop, not `asChild`**: `<DropdownMenuTrigger render={<Button />}>children</DropdownMenuTrigger>`.
- Base UI primitives (`@base-ui/react`), not Radix. Checkbox uses separate `indeterminate` prop (boolean), not a string value.
- No `AlertDialog` component — use `Dialog` with confirm/cancel buttons instead.
- Deep teal primary via oklch. Dark mode default.
- Toast via Sonner. React Query with 60s stale time, no refetchOnWindowFocus.
- `@react-pdf/renderer` PDFs: Helvetica font only. Unicode symbols (☐, ✓) don't render — use `View` boxes with borders for checkboxes instead.
- Providers in root layout: ThemeProvider (next-themes), QueryProvider (React Query).

### Form & Validation Patterns
- Zod schemas in `src/lib/validations/`. Export both schema and type: `export type FormValues = z.input<typeof schema>` (use `z.input`, NOT `z.infer`).
- React Hook Form + `zodResolver()` + `useMutation()`.
- Optional date fields: `z.union([z.literal(""), z.coerce.date()]).optional().transform(v => v === "" ? undefined : v)`.
- Numeric fields: `z.coerce.number()`.

### Asset Types
- **Serialized** (`Asset`): individually tracked with unique asset tags, have a `status` field (AVAILABLE, CHECKED_OUT, IN_MAINTENANCE, LOST).
- **Bulk** (`BulkAsset`): quantity-tracked, no individual serial tracking.
- **Kit** (`Kit`): container of serialized and bulk assets. Has its own asset tag, status, condition. Kit contents managed via `KitSerializedItem` / `KitBulkItem` join tables.
- Bulk detection on line items: `!!lineItem.bulkAssetId || (!lineItem.assetId && lineItem.quantity > 1)`.
- Kit detection on line items: `!!lineItem.kitId && !lineItem.isKitChild`. Children have `isKitChild: true` and `parentLineItemId`.

### Kit System
- Kit line items: parent row (`kitId` set, `isKitChild: false`) with child rows (`isKitChild: true`, `parentLineItemId` pointing to parent).
- Pricing modes: `KIT_PRICE` (single price on parent) or `ITEMIZED` (individual prices on children).
- Warehouse: kits check out/in via `checkOutKit`/`checkInKit` (not `checkOutItems`). Kit items in the checkout selection must be routed to `kitCheckOutMutation` separately from regular items.
- PDFs: all documents (invoice, quote, delivery docket, return sheet, packing list) render kit contents as indented children under the kit parent row.

### Auto-Incrementing Asset Tags
- Org settings (`Organization.metadata` JSON) store `assetTagPrefix`, `assetTagDigits`, `assetTagCounter`.
- `peekNextAssetTags(count)` — read-only preview, no counter increment. Used by forms for suggested tags.
- `reserveAssetTags(count)` — atomically increments counter. Called only inside `createAsset`/`createAssets`/`createBulkAsset`/`createKit` after successful creation.
- Forms pre-fill tags via peek; users can override. Adding/removing extra rows doesn't burn numbers.

### Warehouse Checkout/Check-in Flow
- Serialized lifecycle: sales adds model to project (no specific asset) → warehouse scans/selects asset to check out (assigns it) → only that exact asset can be checked in → on check-in, asset is unassigned (disconnected) → any asset of that model can be checked out next.
- Bulk lifecycle: increments `checkedOutQuantity`/`returnedQuantity` per unit. Status changes at full quantity thresholds.
- `checkOutItems` assigns `assetId` to line item and sets asset status to CHECKED_OUT.
- `checkInItems` disconnects `assetId` from line item and sets asset status based on return condition (GOOD→AVAILABLE, DAMAGED→IN_MAINTENANCE, MISSING→LOST).
- Kit checkout/checkin uses separate `checkOutKit`/`checkInKit` server actions. In the warehouse UI, selected kit items must be detected by `kitId` and routed to kit mutations, not the regular `checkOutItems` flow.

### Availability Checking
- `checkAvailability()` and `lookupAssetByTag()` in `src/server/line-items.ts` check for overlapping projects.
- Date params typed as `Date | string` because server action serialization converts Date objects to strings.
- Exclude finished project statuses: `notIn: ["CANCELLED", "RETURNED", "COMPLETED", "INVOICED"]`.
- `checkKitAvailability()` checks if a kit is booked on an overlapping project. Shown in the Add Kit dialog.

### Client Component Patterns
- All hooks must be called unconditionally (before any early returns) to satisfy React's Rules of Hooks.
- Query/mutation pattern: `useQuery` for data fetching, `useMutation` for writes, `queryClient.invalidateQueries()` on success.
- Page components with `params: Promise<{ id: string }>` use `const { id } = use(params)`.
