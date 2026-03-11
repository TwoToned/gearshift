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
npx prisma migrate deploy             # Apply migrations non-interactively (production/CI)
```

No test framework is configured.

## Architecture

### Route Groups
- `src/app/(auth)/` — public pages (login, register, onboarding). Centered card layout, no sidebar.
- `src/app/(app)/` — protected pages. Sidebar + top bar layout via `SidebarProvider`.
- `src/app/(admin)/admin/` — site admin panel. Layout checks `User.role === "admin"`.
- `src/app/api/auth/[...all]/` — Better Auth catch-all handler.
- `src/app/api/documents/[projectId]/` — PDF document generation endpoint.
- `src/app/api/files/[...path]/` — S3 file proxy. Verifies `storageKey` starts with user's `activeOrganizationId`.
- `src/app/api/admin/org-export/[orgId]/` — Organization export (site admin only).
- `src/app/api/admin/org-import/` — Organization import (site admin only).

### Auth & Multi-Tenancy
- **Better Auth** with Organization plugin. Server config in `src/lib/auth.ts`, client in `src/lib/auth-client.ts`.
- Middleware (`src/middleware.ts`) checks `better-auth.session_token` cookie; redirects unauthenticated users to `/login`.
- Every session has `activeOrganizationId`. All data must be scoped to it.
- `src/lib/auth-server.ts` — `getSession()`, `requireSession()`, `requireOrganization()`.
- `src/lib/admin-auth.ts` — `requireSiteAdminApi()` for API route handlers (checks `User.role === "admin"`).
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
- Providers in root layout: ThemeProvider (next-themes), QueryProvider (React Query).
- **Base UI SelectValue portal issue**: `SelectValue` can't resolve item text from portal-rendered items; pass explicit label text as children.

### Media System
- **Modern approach**: `ModelMedia`, `AssetMedia`, `KitMedia`, `ProjectMedia`, `ClientMedia`, `LocationMedia` join tables linking to `FileUpload`.
- **Legacy fields**: `model.image`, `model.images`, `asset.images`, `kit.image`, `kit.images` — still exist but UI uses media tables.
- **Display**: `MediaThumbnail` component renders images with fallback placeholder. Uses `thumbnailUrl || url` from `FileUpload`.
- **Resolution**: `src/lib/media-utils.ts` — `resolveModelPhotoUrl()`, `resolveAssetPhotoUrl()` (cascading: asset photo → model photo).
- **Uploads**: `MediaUploader` component for drag-to-reorder, primary marking, removal. Files uploaded via `src/app/api/uploads/route.ts`.
- **File proxy**: `src/app/api/files/[...path]/route.ts` — serves S3 files, validates org prefix. Returns 403 if `storageKey` doesn't match active org.
- **Storage**: `src/lib/storage.ts` — S3/MinIO client. `uploadToS3()`, `getFromS3()`, `deleteFromS3()`, `ensureBucket()`.

### PDF Documents (`src/lib/pdf/`)
- `@react-pdf/renderer` with Helvetica font only. Unicode symbols don't render — use ASCII alternatives (`-` not `—`, `|` not `•`), `View` boxes with borders for checkboxes.
- Documents: `quote-pdf.tsx`, `invoice-pdf.tsx`, `packing-list-pdf.tsx` (pull slip), `return-sheet-pdf.tsx`, `delivery-docket-pdf.tsx`.
- Shared styles in `src/lib/pdf/styles.ts`.
- All documents render kit contents as indented children under the kit parent row.
- Line item notes shown as subtitles on all documents.
- Overbooked items show a red "OVERBOOKED" badge. Reduced stock items show purple "REDUCED STOCK" badge.
- Pull slip shows per-unit checkboxes for quantity > 1 items (vertical layout with model name labels).

### Form & Validation Patterns
- Zod schemas in `src/lib/validations/`. Export both schema and type: `export type FormValues = z.input<typeof schema>` (use `z.input`, NOT `z.infer`).
- React Hook Form + `zodResolver()` + `useMutation()`.
- Optional date fields: `z.union([z.literal(""), z.coerce.date()]).optional().transform(v => v === "" ? undefined : v)`.
- Numeric fields: `z.coerce.number()`.

### Asset Types
- **Serialized** (`Asset`): individually tracked with unique asset tags, have a `status` field (AVAILABLE, CHECKED_OUT, IN_MAINTENANCE, LOST, RESERVED, RETIRED).
- **Bulk** (`BulkAsset`): quantity-tracked, no individual serial tracking.
- **Kit** (`Kit`): container of serialized and bulk assets. Has its own asset tag, status, condition. Kit contents managed via `KitSerializedItem` / `KitBulkItem` join tables.
- Bulk detection on line items: `!!lineItem.bulkAssetId || (!lineItem.assetId && lineItem.quantity > 1)`.
- Kit detection on line items: `!!lineItem.kitId && !lineItem.isKitChild`. Children have `isKitChild: true` and `parentLineItemId`.
- **Kit join tables use `addedAt`** (not `createdAt`). Fields: `position`, `sortOrder`, `addedAt`, `addedById`, `notes`.

### Kit System
- Kit line items: parent row (`kitId` set, `isKitChild: false`) with child rows (`isKitChild: true`, `parentLineItemId` pointing to parent).
- Pricing modes: `KIT_PRICE` (single price on parent) or `ITEMIZED` (individual prices on children).
- Warehouse: kits check out/in via `checkOutKit`/`checkInKit` (not `checkOutItems`). Kit items in the checkout selection must be routed to `kitCheckOutMutation` separately from regular items.

### Auto-Incrementing Asset Tags
- Org settings (`Organization.metadata` JSON) store `assetTagPrefix`, `assetTagDigits`, `assetTagCounter`.
- `peekNextAssetTags(count)` — read-only preview, no counter increment. Used by forms for suggested tags.
- `reserveAssetTags(count)` — atomically increments counter. Called only inside `createAsset`/`createAssets`/`createBulkAsset`/`createKit` after successful creation.
- Forms pre-fill tags via peek; users can override. Adding/removing extra rows doesn't burn numbers.

### Warehouse Checkout/Check-in Flow
- Serialized lifecycle: sales adds model to project (no specific asset) → warehouse scans/selects asset to check out (assigns it) → only that exact asset can be checked in → on check-in, asset is unassigned (disconnected) → any asset of that model can be checked out next.
- Bulk lifecycle: increments `checkedOutQuantity`/`returnedQuantity` per unit. Status changes at full quantity thresholds.
- `checkOutItems` assigns `assetId` to line item and sets asset status to CHECKED_OUT. Validates asset isn't already checked out elsewhere before proceeding.
- `checkInItems` disconnects `assetId` from line item and sets asset status based on return condition (GOOD→AVAILABLE, DAMAGED→IN_MAINTENANCE, MISSING→LOST).
- Kit checkout/checkin uses separate `checkOutKit`/`checkInKit` server actions. In the warehouse UI, selected kit items must be detected by `kitId` and routed to kit mutations, not the regular `checkOutItems` flow.
- `lookupAssetForScan` checks both line item status AND physical asset status — blocks checkout if asset is already checked out on another project, showing which project has it.

### Availability & Overbooking
- `checkAvailability()` in `src/server/line-items.ts` checks for overlapping projects. Returns `totalStock`, `booked` (includes same-project bookings), `bookedOnThisProject`, and `conflicts`.
- Date params typed as `Date | string` because server action serialization converts Date objects to strings.
- Exclude finished project statuses: `notIn: ["CANCELLED", "RETURNED", "COMPLETED", "INVOICED"]`.
- `checkKitAvailability()` checks if a kit is booked on an overlapping project.
- Overbooking is allowed with explicit user confirmation (checkbox). Both add and edit dialogs show a red warning with available count.
- `isOverbooked` is dynamically computed (not stored) via `computeOverbookedStatus()` in `src/lib/availability.ts`. Batches DB queries for efficiency.
- Overbooked status is computed in `getProject()` and in the documents API route, then enriched onto line items.
- Adding a duplicate model to a project merges into the existing line item (increments quantity) rather than creating a new row.
- **Reduced stock**: Assets with status IN_MAINTENANCE or LOST reduce effective stock. Purple "Reduced Stock" badges shown on web UI and all 5 PDFs.
- **Project issue badges**: Projects list shows AlertTriangle icons (red=overbooked, purple=reduced stock) with tooltips. Computed by `getProjectIssueFlags()`.

### Maintenance
- **Server actions**: `src/server/maintenance.ts` — CRUD with multi-asset support.
- **Multi-asset records**: One `MaintenanceRecord` can link to multiple assets via `MaintenanceRecordAsset` join table (many-to-many).
- **Fields**: `title`, `description`, `type` (MaintenanceType enum), `status` (MaintenanceStatus enum), `priority`, `scheduledDate`, `completedDate`, `cost`, `result` (MaintenanceResult enum), `reportedById`, `assignedToId`.
- **Reported By**: User select field populated from org members. Falls back to current user.
- **Delete**: Available on list page and detail page with confirmation dialog.
- **Dashboard**: Maintenance records appear in recent activity feed with amber Wrench icon.
- **Notifications**: Overdue maintenance generates notifications. Shows first asset + count for multi-asset records.
- **Filter dropdowns**: Use explicit `SelectValue` children to avoid Base UI portal rendering issue with raw enum values.
- Asset relation: `Asset.maintenanceLinks` → `MaintenanceRecordAsset[]` (not `maintenanceRecords`).

### Notifications
- Server: `src/server/notifications.ts` — generates notifications for upcoming/overdue events.
- Client: `src/components/layout/notifications.tsx` — bell icon in top bar with dropdown.
- **Dismiss on click**: localStorage-based. `getDismissedIds()`/`saveDismissedIds()` helpers. Auto-prunes stale IDs.
- Click handler dismisses notification and navigates to `notification.href`.

### Line Items & Groups
- Line items support `groupName` for visual grouping in the project UI. Groups are drag-and-drop reorderable.
- `ComboboxPicker` with `creatable` mode allows typing new group names. Uses `onMouseDown` with `preventDefault` (not `onClick`) for buttons inside popovers.
- New groups are tracked in local `extraGroups` state for immediate list updates (async query invalidation would otherwise show stale data).

### Project Financial Fields
- `subtotal`, `discountAmount`, `taxAmount`, `total` — auto-calculated by `recalculateProjectTotals()` whenever line items change.
- `discountPercent`, `depositPercent`, `depositPaid` — user-editable on the project form.
- `invoicedTotal` — manual override for the actual invoiced amount (e.g. from Xero). Displayed separately from the calculated total.
- Tax is hardcoded at 10% GST. Only non-optional, non-cancelled items included in calculations.

### CSV Import/Export (`src/server/csv.ts`)
- `exportModelsCSV()`, `exportAssetsCSV()`, `exportBulkAssetsCSV()` — export active records as CSV.
- `importModelsCSV(csvContent)` — upsert by name + manufacturer + modelNumber.
- `importAssetsCSV(csvContent)` — upsert by assetTag, auto-generates tags if missing.
- Custom CSV parser/escaper (no external deps). Flexible column name matching (camelCase, snake_case).
- `CSVImportDialog` component (`src/components/assets/csv-import-dialog.tsx`) — reusable file upload dialog with progress and error display.

### Organization Export/Import (Site Admin)
- **Export** (`src/lib/org-export.ts`): Queries all 27 org-scoped tables, builds streaming zip via `archiver` with `manifest.json` + `files/{storageKey}` (S3 media). Concurrent S3 downloads limited to 5.
- **Import** (`src/lib/org-import.ts`): Extracts zip via `unzipper`, creates new org with full ID remapping (`@paralleldrive/cuid2`).
  - Topological sort (BFS) for hierarchical tables: Category, Location, ProjectLineItem (parentId).
  - User FKs resolved by email matching — unmatched users are skipped.
  - S3 files re-uploaded under new org prefix. `thumbnailUrl` cleared (not exported).
  - `KitSerializedItem`/`KitBulkItem` use `addedAt` field (not `createdAt`).
  - `safeDate()`/`safeDateOpt()` helpers handle invalid/missing date values gracefully.
  - Image URL references (`model.image`, `model.images`, `kit.image`, etc.) updated post-upload via URL mapping.
  - `ensureBucket()` called before S3 uploads to handle fresh MinIO instances.
- **Type definitions**: `src/lib/org-transfer-types.ts` — `OrgExportManifest` interface, `MANIFEST_VERSION = 1`.
- **API routes**: `src/app/api/admin/org-export/[orgId]/route.ts` (GET, streams zip), `src/app/api/admin/org-import/route.ts` (POST, FormData with file + optional name/slug).
- **UI**: Export button on org detail page + per-row download button. Import button + dialog on org list page.

### Table Components
- `SortableTableHead` and `PageSizeSelect` in `src/components/ui/sortable-table-head.tsx`.
- `useTablePreferences` hook (`src/lib/use-table-preferences.ts`) persists sort, page size, and view mode to localStorage per table key.

### Test & Tag (T&T) Module
- **Routes**: `src/app/(app)/test-and-tag/` — register, new item, quick test, reports, item detail `[id]`.
- **API route**: `src/app/api/test-tag-reports/[reportType]/route.tsx` — serves PDF and CSV for all 10 report types.
- **Server actions**: `src/server/test-tag-assets.ts` (CRUD, batch create, sync), `src/server/test-tag-records.ts` (test records, status recalculation), `src/server/test-tag-reports.ts` (report data + CSV exports).
- **PDF templates**: `src/lib/pdf/test-tag-*.tsx` — 10 report PDFs plus shared components in `test-tag-pdf-shared.tsx`.
- **Validations**: `src/lib/validations/test-tag.ts` — schemas for asset, record, and batch create forms.
- **Equipment classes** (AS/NZS 3760:2022): `CLASS_I`, `CLASS_II`, `CLASS_II_DOUBLE_INSULATED`, `LEAD_CORD_ASSEMBLY`.
  - Lead/Cord Assembly behaves like Class I for earth continuity but always requires polarity testing (not conditional on appliance type).
- **T&T settings** stored in `Organization.metadata` JSON under `testTag` key: `prefix`, `digits`, `counter`, `defaultIntervalMonths`, `defaultEquipmentClass`, `dueSoonThresholdDays`, `companyName`, `defaultTesterName`, `defaultTestMethod`, `checkoutPolicy`.
- **Auto-incrementing test tag IDs**: Same pattern as asset tags — `peekNextTestTagIds(count)` for preview, `reserveTestTagIds(count)` for atomic creation.
- **Status lifecycle**: `NOT_YET_TESTED` → `CURRENT` → `DUE_SOON` → `OVERDUE` / `FAILED` / `RETIRED`. Recalculated after each test record.
- **Bulk asset linking**: New T&T item form shows bulk asset picker first; selecting one auto-populates description, make, equipment class, appliance type, test interval, and location from the bulk asset's model.
- **Reports**: Full Register, Overdue/Non-Compliant, Test Session, Item History, Due Schedule, Class Summary, Tester Activity, Failed Items, Bulk Asset Summary, Compliance Certificate. Each has PDF; 8 have CSV export.
- **Date serialization in API route**: Prisma `Date` objects must be JSON-serialized before passing to PDF components: `JSON.parse(JSON.stringify(data, (_key, value) => value instanceof Date ? value.toISOString() : value))`.
- **Dashboard**: Test tag records appear in recent activity feed.

### User Management & Access Control
- **Two-tier model**: Site admins (global) + organization roles (per-org).
- **Site admin**: `User.role = "admin"`. First user auto-promoted. Additional admins via secret registration link (`/register/admin?token=...`). Requires env vars `SITE_ADMIN_REGISTRATION_ENABLED=true` and `SITE_ADMIN_SECRET_TOKEN`.
- **Org roles** (hierarchy): `owner`, `admin`, `manager`, `member`, `viewer`. Legacy: `staff`, `warehouse` (mapped to member-level permissions).
- **Permissions**: `src/lib/permissions.ts` defines `rolePermissions` map. Enforced via `requirePermission(resource, action)` in `src/lib/org-context.ts`.
- **Server actions**: `src/server/site-admin.ts` (platform admin), `src/server/org-members.ts` (org member management), `src/server/user-profile.ts` (user account).
- **Admin panel**: `src/app/(admin)/admin/` — dashboard, organizations (with export/import), users, settings.
- **Account page**: `src/app/(app)/account/` — profile, password change, 2FA setup, organizations, active sessions.
- **2FA**: Better Auth `twoFactor` plugin (TOTP). Setup in account page. Verification at `/two-factor`. Site admin can force-disable.
- **Email**: Resend SDK (`src/lib/email.ts`). Used for invitations, password reset, email verification, role change notifications.
- **Invitations**: Better Auth org invitations + email sending. Accept via `/invite/[id]`.
- **SiteSettings model**: Single-row table for platform name, logo, registration policy, 2FA global policy, default currency/tax.
- **Registration policies**: OPEN, INVITE_ONLY, DISABLED (configured in site admin settings).
- **User banning**: `User.banned` field. Better Auth's `admin` plugin handles login blocking.

### Client Component Patterns
- All hooks must be called unconditionally (before any early returns) to satisfy React's Rules of Hooks.
- Query/mutation pattern: `useQuery` for data fetching, `useMutation` for writes, `queryClient.invalidateQueries()` on success.
- Page components with `params: Promise<{ id: string }>` use `const { id } = use(params)`.
