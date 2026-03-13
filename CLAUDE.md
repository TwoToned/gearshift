# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL: ARCHITECTURE.md is the Source of Truth

**`ARCHITECTURE.md` is the authoritative, exhaustive technical reference for this entire codebase.** It documents every feature, system, data model, API, pattern, and convention. Treat it as the bible — always consult it before making changes and **always update it** when you add, modify, or remove features. If something isn't documented in ARCHITECTURE.md, it should be. If ARCHITECTURE.md says something works a certain way, that's how it works. Keeping this document accurate and up-to-date is non-negotiable — stale documentation is worse than no documentation.

When making changes:
1. **Before**: Read the relevant sections of ARCHITECTURE.md to understand how the system currently works.
2. **During**: Follow the patterns and conventions documented there.
3. **After**: Update ARCHITECTURE.md to reflect any changes you've made — new routes, new server actions, changed behavior, removed features, etc.

## Branching

All new features and non-trivial changes must go on a dedicated branch (e.g., `feature/universal-tags`). Never commit feature work directly to `main`.

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
- `src/app/(app)/` — protected pages. Sidebar + top bar layout via `SidebarProvider`. Mobile bottom nav.
- `src/app/(admin)/admin/` — site admin panel. Layout checks `User.role === "admin"`. Own mobile-responsive shell.
- `src/app/api/auth/[...all]/` — Better Auth catch-all handler.
- `src/app/api/documents/[projectId]/` — PDF document generation endpoint.
- `src/app/api/files/[...path]/` — S3 file proxy. Verifies `storageKey` starts with user's `activeOrganizationId`.
- `src/app/api/uploads/` — File upload to S3 (multipart form, returns metadata).
- `src/app/api/test-tag-reports/[reportType]/` — T&T report PDF/CSV generation (10 report types).
- `src/app/api/platform-name/` — Get site settings (name, icon, logo, registration policy).
- `src/app/api/current-role/` — Get user's role in active org.
- `src/app/api/admin/org-export/[orgId]/` — Organization export (site admin only).
- `src/app/api/admin/org-import/` — Organization import (site admin only).
- `src/app/api/admin-register/` — Secret admin registration token verification + promotion.

### Auth & Multi-Tenancy
- **Better Auth** with Organization, TwoFactor, Admin, and Passkey plugins. Server config in `src/lib/auth.ts`, client in `src/lib/auth-client.ts`.
- **Passkeys**: `@better-auth/passkey` plugin. `Passkey` model in schema. Login via `authClient.signIn.passkey()`. Managed on account page. Env: `PASSKEY_RP_ID`.
- **Social Login**: Google and Microsoft, conditional on env vars (`GOOGLE_CLIENT_ID`, `MICROSOFT_CLIENT_ID`). Login page dynamically shows buttons. Account page has "Connected Accounts" section.
- **Profile Pictures**: Upload via `POST /api/avatar` (resizes to 256x256 via sharp). Stored under global `avatars/` S3 prefix. `UserAvatar` component (`src/components/ui/user-avatar.tsx`) used across the app.
- Middleware (`src/middleware.ts`) checks `better-auth.session_token` or `__Secure-better-auth.session_token` cookie; redirects unauthenticated users to `/login`.
- Public routes exempted from auth: `/login`, `/register`, `/api/auth`, `/invite`, `/two-factor`, `/no-organization`, `/onboarding`, `/api/platform-name`, `/api/registration-policy`.
- Every session has `activeOrganizationId`. All data must be scoped to it.
- `src/lib/auth-server.ts` — `getSession()`, `requireSession()`, `requireOrganization()`.
- `src/lib/admin-auth.ts` — `requireSiteAdminApi()` for API route handlers (checks `User.role === "admin"`).
- `src/lib/org-context.ts` — `getOrgContext()` returns `{ organizationId, userId }`, `orgWhere()` injects org scope into Prisma queries, `requireRole()` validates membership, `requirePermission(resource, action)` enforces permissions.
- Roles: owner, admin, manager, member, viewer (legacy: staff, warehouse — mapped to member-level).

### Database
- Prisma v6, client generated to `src/generated/prisma/`. Import from `@/generated/prisma/client` (not `@/generated/prisma`).
- Singleton client in `src/lib/prisma.ts`.
- Every app model has `organizationId` with index. Asset tags and project numbers unique per org (`@@unique([organizationId, assetTag])`).
- After schema changes: run `npx prisma migrate dev`, then `npx prisma generate`, then restart dev server.

### Server Actions (`src/server/`)
- All files use `"use server"` directive. Each function calls `getOrgContext()` for org scoping. Write operations use `requirePermission()` instead.
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

### Mobile & PWA
- **PWA**: Manifest at `/public/manifest.json`, `display: standalone`, offline page at `/offline`. Configured via `@ducanh2912/next-pwa`.
- **Viewport**: `viewport-fit: cover`, `apple-mobile-web-app-capable: yes`, `statusBarStyle: black-translucent`. Set in `src/app/layout.tsx`.
- **iOS PWA viewport fix**: With `viewport-fit:cover` + `black-translucent`, iOS pushes content into the status bar but doesn't extend viewport height to match, leaving a bottom gap. Fix: `html { min-height: calc(100% + env(safe-area-inset-top)) }` in `globals.css`. The `.app-shell` class uses `position: fixed; inset: 0` on mobile to pin to viewport edges.
- **App layout** (`src/app/(app)/layout.tsx`): Outer div has class `app-shell` with flex column. On mobile: `position: fixed; inset: 0; overflow: hidden`. On desktop (`md:`): `position: relative; min-height: 100svh`.
- **Mobile bottom nav** (`src/components/layout/mobile-nav.tsx`): Flow element (not `position: fixed`) inside the flex column with `shrink-0`. Hidden on desktop via `md:hidden`. Includes quick scan button.
- **Safe area handling**: Use inline styles with `env(safe-area-inset-*)` — Tailwind arbitrary values don't reliably preserve `env()` through compilation. Applied per-element on:
  - TopBar: `style={{ paddingTop: "env(safe-area-inset-top, 0px)", minHeight: "calc(3.5rem + env(safe-area-inset-top, 0px))" }}`
  - Sheet (sidebar): `paddingTop` and `paddingBottom` safe area via merged inline style in `SheetContent`.
  - Full-screen mobile dialogs: Pass `style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top, 0px))" }}` to `DialogContent`.
  - MobileNav: `paddingBottom: "env(safe-area-inset-bottom, 0px)"` on inner div.
  - AdminShell: `pt-[calc(0.75rem+env(safe-area-inset-top,0px))]` on mobile header.
- **DialogContent safe area**: The `style` prop is extracted and merged; close button uses `style.paddingTop` to offset itself below the safe area.
- **Barcode scanner** (`src/components/ui/barcode-scanner.tsx`): Uses `html5-qrcode`. No overlay — whole camera feed is scan area. Audio chime via Web Audio API (1200Hz sine, 150ms). Callbacks stored in refs to prevent re-render loops. `continuous` prop for multi-scan mode.
- **Scan lookup** (`src/server/scan-lookup.ts`): Resolves barcode value to URL — checks Asset → Kit → BulkAsset → TestTagAsset by tag/ID.
- **Touch targets**: `min-height: 44px; min-width: 44px` for `.touch-target` on touch devices. Checkboxes get 24px min size.

### Command Search & Global Search
- **Component**: `src/components/layout/command-search.tsx` — advanced search/command palette triggered by search icon or keyboard shortcut.
- **Page commands**: `src/lib/page-commands.ts` — `PAGE_COMMANDS` array defines navigable pages with aliases, icons, descriptions, optional entity search.
- **Normal mode**: Free text searches across models, assets, bulk assets, kits, projects, clients, locations, categories, maintenance records. Uses `globalSearch()` from `src/server/search.ts`.
- **@ mode**: Type `@` prefix to navigate pages. Tab drills into children. After space, remaining text searches entities on that page (e.g., `@project drum hire`).
- **Date shortcuts**: Typing a date (DD/MM/YYYY, ISO, etc.) navigates to availability calendar for that date.
- **Child results**: Models show their assets, clients show projects, locations show children, categories show models, kits show items.
- **Keyboard**: `Shift+↑/↓` skip child results, `Tab` drills into pages, `Esc` goes back, `Cmd+L` toggles children.
- **Full-screen on mobile**: Dialog uses `h-[100dvh]` with safe area padding on mobile.
- **When adding new features**: If the feature has a list/detail page, add it to `PAGE_COMMANDS` in `src/lib/page-commands.ts` so it's searchable. If it has entities, add a search type to `globalSearch()` in `src/server/search.ts` so items appear in search results.

### Media System
- **Modern approach**: `ModelMedia`, `AssetMedia`, `KitMedia`, `ProjectMedia`, `ClientMedia`, `LocationMedia` join tables linking to `FileUpload`.
- **Legacy fields**: `model.image`, `model.images`, `asset.images`, `kit.image`, `kit.images` — still exist but UI uses media tables.
- **Display**: `MediaThumbnail` component renders images with fallback placeholder. Uses `thumbnailUrl || url` from `FileUpload`.
- **Resolution**: `src/lib/media-utils.ts` — `resolveModelPhotoUrl()`, `resolveAssetPhotoUrl()` (cascading: asset photo → model photo).
- **Uploads**: `MediaUploader` component for drag-to-reorder, primary marking, removal. Files uploaded via `src/app/api/uploads/route.ts`.
- **File proxy**: `src/app/api/files/[...path]/route.ts` — serves S3 files, validates org prefix. Returns 403 if `storageKey` doesn't match active org.
- **Storage**: `src/lib/storage.ts` — S3/MinIO client. `uploadToS3()`, `getFromS3()`, `deleteFromS3()`, `ensureBucket()`. Files stored under `{orgId}/{folder}/{entityId}/{uuid}-{name}`.

### PDF Documents (`src/lib/pdf/`)
- `@react-pdf/renderer` with Helvetica font only. Unicode symbols don't render — use ASCII alternatives (`-` not `—`, `|` not `•`), `View` boxes with borders for checkboxes.
- **Project documents**: `quote-pdf.tsx`, `invoice-pdf.tsx`, `packing-list-pdf.tsx` (pull slip), `return-sheet-pdf.tsx`, `delivery-docket-pdf.tsx`.
- **T&T reports**: 10 PDFs in `test-tag-*.tsx` plus shared components in `test-tag-pdf-shared.tsx`.
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
- Zod schemas CANNOT be exported from `"use server"` files — must be in `src/lib/validations/`.

### Asset Types
- **Serialized** (`Asset`): individually tracked with unique asset tags, have a `status` field (AVAILABLE, CHECKED_OUT, IN_MAINTENANCE, LOST, RESERVED, RETIRED).
- **Bulk** (`BulkAsset`): quantity-tracked, no individual serial tracking.
- **Kit** (`Kit`): container of serialized and bulk assets. Has its own asset tag, status, condition. Kit contents managed via `KitSerializedItem` / `KitBulkItem` join tables.
- Bulk detection on line items: `!!lineItem.bulkAssetId || (!lineItem.assetId && lineItem.quantity > 1)`.
- Kit detection on line items: `!!lineItem.kitId && !lineItem.isKitChild`. Children have `isKitChild: true` and `parentLineItemId`.
- **Kit join tables use `addedAt`** (not `createdAt`). Fields: `position`, `sortOrder`, `addedAt`, `addedById`, `notes`.

### Categories
- **Routes**: `/assets/categories` (list), `/assets/categories/[id]` (detail with models/kits tabs).
- **Server actions**: `src/server/categories.ts` — `getCategories()`, `getCategory(id)`, `getCategoryTree()`, `createCategory()`, `updateCategory()`, `deleteCategory()`.
- **Hierarchy**: Self-referential `parentId`. Table view shows children indented under parents.
- **Relations**: Category → Model[], Category → Kit[], Category → children Category[].
- **Permissions**: Uses `"model"` resource (no dedicated category permission).
- **Sidebar**: Listed under Assets with `Tags` icon.
- **Search**: Global search results link to `/assets/categories/[id]`. Added to PAGE_COMMANDS.
- **Settings**: `/settings/assets` links to categories page (no longer inline manager).

### Universal Tags
- All major entities have `tags String[] @default([])`: Category, Model, Kit, Asset, BulkAsset, Location, MaintenanceRecord, Project, Client.
- Tags normalized to lowercase on save.
- `TagInput` component (`src/components/ui/tag-input.tsx`) with autocomplete from `getOrgTags()` (`src/server/tags.ts`).
- Global search matches tags via raw SQL `EXISTS(SELECT 1 FROM unnest(tags) t WHERE t ILIKE ...)`.
- CSV export uses semicolons as tag separator; import parses them back.

### Activity Log (Audit Trail)
- **Model**: `ActivityLog` tracks all write operations with `action`, `entityType`, `entityId`, `entityName`, `summary`, `details` (JSON), `userName` (denormalized).
- **Logging**: `logActivity()` from `src/lib/activity-log.ts` — called after every successful write in all 16 server action files. Never blocks main operation.
- **Diff helper**: `buildChanges(before, after, fields)` computes field changes for UPDATE details.
- **Page**: `/activity` — full table with entity type, action, date range, search filters. CSV export.
- **Per-entity**: `ActivityTimeline` component (`src/components/activity/activity-timeline.tsx`) for detail pages.
- **`getOrgContext()`** now returns `userName` alongside `organizationId` and `userId`.
- Permissions: gated by `reports` read.

### Kit System
- Kit line items: parent row (`kitId` set, `isKitChild: false`) with child rows (`isKitChild: true`, `parentLineItemId` pointing to parent).
- Pricing modes: `KIT_PRICE` (single price on parent) or `ITEMIZED` (individual prices on children).
- Warehouse: kits check out/in via `checkOutKit`/`checkInKit` (not `checkOutItems`). Kit items in the checkout selection must be routed to `kitCheckOutMutation` separately from regular items.

### Accessories & Auto-Pulls
- `ModelAccessory` links parent model → accessory model with quantity ratio and `AccessoryLevel` (MANDATORY/OPTIONAL/RECOMMENDED).
- `addLineItem` auto-adds MANDATORY and OPTIONAL accessories as child line items (`isAccessory: true`, `parentLineItemId` set). Cascades up to 3 levels. RECOMMENDED returned for UI toast.
- `updateLineItem` scales non-`manualOverride` accessory children when parent qty changes.
- `removeLineItem` cascade deletes all accessory children.
- Circular reference detection via BFS up to 3 levels in `addModelAccessory`.
- Server actions in `src/server/model-accessories.ts`. Validation in `src/lib/validations/model-accessory.ts`.

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
- **Camera scanning**: Maintenance form has camera button for scanning assets via barcode (continuous mode).

### Notifications
- Server: `src/server/notifications.ts` — generates notifications for upcoming/overdue events.
- **Types**: overdue_maintenance, overdue_return, upcoming_project, low_stock, pending_invitation.
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

### Advanced DataTable System
- **`DataTable`** component (`src/components/ui/data-table.tsx`): Shared table component replacing all hand-built tables. Configured via `ColumnDef<TData>[]` column definitions.
- **Column visibility**: Toggle columns on/off via popover. `alwaysVisible` columns cannot be hidden. `defaultVisible: false` columns are hidden by default. Persisted to localStorage.
- **Enum filter dropdowns**: Checkbox popover multi-select filters for enum columns. Active filters shown as removable chips below the toolbar.
- **`buildFilterWhere(filters, columnDefs)`** in `src/lib/table-utils.ts`: Translates filter state to Prisma `where` clauses. Supports nested dot-paths.
- **`useTablePreferences`** hook (`src/lib/use-table-preferences.ts`): Persists sort, page size, view mode, column visibility, and filters to localStorage per table key. Key additions: `columnVisibility`, `toggleColumnVisibility`, `filters`, `setFilter`, `clearFilters`, `resetPreferences`.
- **Server action pattern**: Add `filters?: Record<string, FilterValue>` param, call `buildFilterWhere(filters, filterColumnDefs)`, merge into where clause. For `tags` filters: use `{ hasSome: values }`.
- **Legacy**: `SortableTableHead` and `PageSizeSelect` still exist in `src/components/ui/sortable-table-head.tsx` but are no longer used by DataTable-powered pages.
- **Hierarchical tables**: Locations and categories indent children under parents using `paddingLeft: depth * 24` on the name cell. Tree is built client-side from flat data via `parentId` grouping.

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
- **Permissions**: `src/lib/permissions.ts` defines `rolePermissions` map with 14 resources: asset, bulkAsset, model, kit, project, client, warehouse, testTag, maintenance, location, document, orgSettings, orgMembers, reports. Enforced via `requirePermission(resource, action)` in `src/lib/org-context.ts`.
- **Custom roles**: Per-org custom roles with JSON-stored permissions. Managed via `src/server/custom-roles.ts`.
- **Server actions**: `src/server/site-admin.ts` (platform admin), `src/server/org-members.ts` (org member management), `src/server/user-profile.ts` (user account).
- **Admin panel**: `src/app/(admin)/admin/` — dashboard, organizations (with export/import), users, settings. Mobile-responsive via `AdminShell` component.
- **Account page**: `src/app/(app)/account/` — profile, password change, 2FA setup, organizations, active sessions.
- **2FA**: Better Auth `twoFactor` plugin (TOTP). Setup in account page. Verification at `/two-factor`. Site admin can force-disable.
- **Email**: Resend SDK (`src/lib/email.ts`). Used for invitations, password reset, email verification, role change notifications.
- **Invitations**: Better Auth org invitations + email sending. Accept via `/invite/[id]`.
- **SiteSettings model**: Single-row table for platform name, logo, registration policy, 2FA global policy, default currency/tax.
- **Registration policies**: OPEN, INVITE_ONLY, DISABLED (configured in site admin settings).
- **User banning**: `User.banned` field. Better Auth's `admin` plugin handles login blocking.

### Project Templates
- **Model**: `Project.isTemplate` boolean field. Templates are stored as projects but fully isolated from real project functionality.
- **Auto-generated codes**: Templates get auto-generated codes (`TPL-0001`, etc.) via `generateTemplateCode()`. Users do not set project codes for templates.
- **No project code on form**: `projectNumber` is optional in the Zod schema. Server validates it's present for non-templates. Template forms hide the field.
- **Complete isolation**: Templates are excluded from ALL project queries by adding `isTemplate: false` filters:
  - Dashboard stats (active count, overdue returns, upcoming projects)
  - Notifications (overdue returns, upcoming projects)
  - Reports (status counts, revenue calculations)
  - Global search results
  - Availability calendar
  - Availability checks (`checkAvailability`, `checkKitAvailability`, `computeOverbookedStatus`) — template line items never block real bookings
- **Server guards**: `updateProjectStatus()` rejects templates. `getProjectForWarehouse()` throws for templates.
- **UI on template detail page**: Status dropdown, Documents button, Cancel/Archive/Delete buttons, Financial summary, and Dates card are all hidden.
- **Duplication**: "Use Template" button on template detail creates a real project (via `duplicateProject`). "Save as Template" available on real projects.
- **`recalculateProjectTotals` and `$transaction`**: Both `duplicateProject` and `saveAsTemplate` call `recalculateProjectTotals` AFTER the transaction commits (not inside), because `recalculateProjectTotals` uses the global prisma client which can't see uncommitted transaction data.
- **Routes**: Templates list at `/projects/templates`, new template at `/projects/templates/new`. Templates use the same `ProjectForm` with `isTemplate` prop.
- **Sidebar**: "Templates" sub-item under Projects with `BookTemplate` icon.

### Invitations & No-Org Flow
- **Invite-only registration**: Site admin can set registration policy to INVITE_ONLY. Users with valid invitations can still register.
- **No-org page**: `src/app/(auth)/no-organization/page.tsx` — shown when user has no org memberships. Displays pending invitations with "Join" buttons, "Admin Panel" link for site admins, and sign out.
- **Invite signup**: Registration page prefills and locks email when `invite` query param is present.
- **Pending invitations UI**: Shown in org settings member list and site admin users page. Dashed border, "Pending" badge, revoke button.
- **Server actions**: `src/server/invitations.ts` — `getMyPendingInvitations()`, `getInvitationEmail()`, `checkIsSiteAdmin()`.

### Client Component Patterns
- All hooks must be called unconditionally (before any early returns) to satisfy React's Rules of Hooks.
- Query/mutation pattern: `useQuery` for data fetching, `useMutation` for writes, `queryClient.invalidateQueries()` on success.
- Page components with `params: Promise<{ id: string }>` use `const { id } = use(params)`.
- `useSearchParams()` must wrap page content in `<Suspense>` boundary.

### Adding New Features Checklist
When implementing a new feature, ensure it integrates with existing systems:
1. **ARCHITECTURE.md**: Read it first. Update it after. This is mandatory.
2. **Search**: Add to `globalSearch()` in `src/server/search.ts` and `PAGE_COMMANDS` in `src/lib/page-commands.ts`.
3. **Permissions**: Add resource to `src/lib/permissions.ts` `rolePermissions` map. Use `requirePermission()` in server actions. Check `hasAccess()` in sidebar.
4. **Sidebar**: Add nav item to `navItems` in `src/components/layout/app-sidebar.tsx` with `resource` for permission gating.
5. **Top bar breadcrumbs**: Add segment label to `segmentLabels` in `src/components/layout/top-bar.tsx`.
6. **Notifications**: If the feature has time-based events, add notification type to `src/server/notifications.ts`.
7. **Dashboard**: Add stats/activity to `src/server/dashboard.ts` if relevant.
8. **Templates exclusion**: If feature queries projects, add `isTemplate: false` filter.
9. **Mobile**: Ensure responsive tables (column hiding), touch targets, overflow handling (`break-words min-w-0`).
10. **Org scoping**: Every query must include `organizationId`. Use `getOrgContext()` or `orgWhere()`.
11. **Serialization**: Always `serialize()` return values from server actions.
12. **Tags**: If the entity has `tags String[]`, add `TagInput` to its form and tags column to its table view.
13. **Activity Log**: Add `logActivity()` calls to all write operations (create/update/delete) in server actions.
