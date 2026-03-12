# GearFlow — Technical Architecture & Feature Reference

This document provides an exhaustive technical reference for every feature, system, data model, API, and pattern in the GearFlow codebase. It is designed to be given to AI assistants or developers to enable them to understand the full system, generate accurate feature scopes, and implement new functionality that integrates correctly with all existing systems.

---

## Table of Contents

1. [Technology Stack & Configuration](#1-technology-stack--configuration)
2. [Project Structure](#2-project-structure)
3. [Database Schema & Data Models](#3-database-schema--data-models)
4. [Authentication & Multi-Tenancy](#4-authentication--multi-tenancy)
5. [Permissions & Access Control](#5-permissions--access-control)
6. [Server Actions](#6-server-actions)
7. [API Routes](#7-api-routes)
8. [Page Routes & Layouts](#8-page-routes--layouts)
9. [UI Component Library](#9-ui-component-library)
10. [Asset Management System](#10-asset-management-system)
11. [Kit System](#11-kit-system)
12. [Project & Rental Management](#12-project--rental-management)
13. [Line Items & Groups](#13-line-items--groups)
14. [Availability & Overbooking Engine](#14-availability--overbooking-engine)
15. [Warehouse Operations](#15-warehouse-operations)
16. [PDF Document Generation](#16-pdf-document-generation)
17. [Test & Tag Module (AS/NZS 3760:2022)](#17-test--tag-module-asnzs-37602022)
18. [Maintenance System](#18-maintenance-system)
19. [Search & Command Palette](#19-search--command-palette)
20. [Notification System](#20-notification-system)
21. [Media & File Storage](#21-media--file-storage)
22. [Mobile & PWA](#22-mobile--pwa)
23. [Barcode & QR Code Scanning](#23-barcode--qr-code-scanning)
24. [CSV Import/Export](#24-csv-importexport)
25. [Organization Export/Import](#25-organization-exportimport)
26. [Project Templates](#26-project-templates)
27. [Site Admin Panel](#27-site-admin-panel)
28. [Client & Location Management](#28-client--location-management)
29. [Settings & Branding](#29-settings--branding)
30. [Dashboard & Reporting](#30-dashboard--reporting)
31. [Key Patterns & Conventions](#31-key-patterns--conventions)
32. [Integration Checklist for New Features](#32-integration-checklist-for-new-features)

---

## 1. Technology Stack & Configuration

### Core Dependencies
| Component | Package | Version Context |
|-----------|---------|----------------|
| Framework | Next.js 16 | App Router, Turbopack, React 19 |
| Language | TypeScript | Strict mode enabled |
| CSS | Tailwind CSS v4 | oklch color space, `@theme inline` |
| UI Library | shadcn/ui v4 | Base UI primitives (`@base-ui/react`), NOT Radix |
| Database | PostgreSQL + Prisma v6 | Client generated to `src/generated/prisma/` |
| Auth | Better Auth | Organization, TwoFactor, Admin plugins |
| State Management | React Query | 60s stale time, no refetchOnWindowFocus |
| Forms | React Hook Form + Zod | `zodResolver()`, `z.input<>` for types |
| PDF | @react-pdf/renderer | Helvetica only, no Unicode |
| Storage | AWS SDK (S3/MinIO) | Org-prefixed file paths |
| Email | Resend SDK | Invitations, password reset, notifications |
| Icons | lucide-react | 180+ icons, dynamic icon component |
| PWA | @ducanh2912/next-pwa | Offline fallback, service worker |
| Toast | Sonner | `toast.success()`, `toast.error()` |
| Themes | next-themes | Dark mode default, `ThemeProvider` |

### Environment Variables
```
DATABASE_URL              # PostgreSQL connection string
BETTER_AUTH_SECRET        # Session encryption key
S3_ACCESS_KEY_ID          # AWS/MinIO access key
S3_SECRET_ACCESS_KEY      # AWS/MinIO secret key
S3_REGION                 # Default: ap-southeast-2
S3_ENDPOINT               # MinIO endpoint (omit for AWS)
S3_BUCKET                 # Default: gearflow-uploads
RESEND_API_KEY            # Email provider
SITE_ADMIN_REGISTRATION_ENABLED  # "true" to enable admin signup
SITE_ADMIN_SECRET_TOKEN   # Token for /register/admin?token=...
```

### Key Config Files
- `next.config.ts` — Turbopack, PWA config via `@ducanh2912/next-pwa`
- `prisma/schema.prisma` — Full database schema
- `public/manifest.json` — PWA manifest (standalone, icons, theme)
- `src/app/layout.tsx` — Root layout with viewport config, fonts, providers
- `src/app/globals.css` — Tailwind imports, oklch theme variables, iOS PWA fixes

---

## 2. Project Structure

```
src/
├── app/
│   ├── (auth)/           # Public pages: login, register, onboarding, invite, no-org
│   ├── (app)/            # Protected pages: dashboard, assets, projects, warehouse, etc.
│   ├── (admin)/admin/    # Site admin panel
│   ├── api/              # API routes: auth, files, uploads, documents, reports, admin
│   ├── layout.tsx        # Root layout: fonts, theme, query provider, toaster
│   └── globals.css       # Theme variables, base styles, iOS PWA fixes
├── components/
│   ├── admin/            # AdminShell, IconPicker
│   ├── assets/           # Asset/Model/BulkAsset forms, tables, QR, CSV import
│   ├── auth/             # PermissionGate
│   ├── bookings/         # Availability calendar
│   ├── clients/          # Client forms, tables
│   ├── kits/             # Kit forms
│   ├── layout/           # Sidebar, TopBar, MobileNav, CommandSearch, Notifications, OrgSwitcher, UserNav, ThemeToggle
│   ├── locations/        # Location forms, tables
│   ├── maintenance/      # Maintenance form
│   ├── media/            # MediaUploader, MediaThumbnail, MediaLightbox
│   ├── projects/         # ProjectForm, LineItemsPanel, AddEquipmentDialog, documents
│   ├── providers/        # ThemeProvider, QueryProvider, BrandingProvider
│   ├── settings/         # InviteMember, MemberList, RoleManager, PermissionMatrix, SupplierManager
│   ├── test-tag/         # TestTagTable, BatchCreateDialog
│   ├── ui/               # Base components: Button, Card, Dialog, Sheet, Table, BarcodeScanner, ComboboxPicker, etc.
│   └── warehouse/        # OnlinePickList
├── generated/prisma/     # Prisma generated client (do NOT edit)
├── hooks/                # use-mobile.ts
├── lib/
│   ├── auth.ts           # Better Auth server config
│   ├── auth-client.ts    # Better Auth client
│   ├── auth-server.ts    # getSession, requireSession, requireOrganization
│   ├── admin-auth.ts     # requireSiteAdminApi
│   ├── org-context.ts    # getOrgContext, orgWhere, requireRole, requirePermission
│   ├── permissions.ts    # rolePermissions map, hasPermission, Resource type
│   ├── prisma.ts         # Singleton Prisma client
│   ├── serialize.ts      # Decimal → number conversion for client
│   ├── storage.ts        # S3/MinIO: uploadToS3, getFromS3, deleteFromS3
│   ├── email.ts          # Resend SDK wrapper
│   ├── availability.ts   # computeOverbookedStatus (batch)
│   ├── media-utils.ts    # resolveModelPhotoUrl, resolveAssetPhotoUrl
│   ├── page-commands.ts  # PAGE_COMMANDS for @ navigation
│   ├── platform.ts       # getPlatformName, getSiteSettings
│   ├── use-permissions.ts    # Client-side useCurrentRole hook
│   ├── use-platform-name.ts  # Client-side usePlatformName, usePlatformBranding
│   ├── use-table-preferences.ts  # localStorage per-table sort/page/view
│   ├── validations/      # Zod schemas: asset, model, kit, project, client, etc.
│   ├── pdf/              # PDF document templates and shared styles
│   ├── org-export.ts     # Organization ZIP export
│   ├── org-import.ts     # Organization ZIP import
│   └── org-transfer-types.ts  # Export manifest types
├── server/               # Server actions (all "use server")
│   ├── assets.ts         # Serialized asset CRUD
│   ├── bulk-assets.ts    # Bulk asset CRUD
│   ├── models.ts         # Equipment model CRUD
│   ├── kits.ts           # Kit CRUD + item management
│   ├── categories.ts     # Category CRUD
│   ├── locations.ts      # Location CRUD
│   ├── suppliers.ts      # Supplier CRUD
│   ├── clients.ts        # Client CRUD
│   ├── projects.ts       # Project CRUD, duplication, templates
│   ├── line-items.ts     # Line item CRUD, availability checks
│   ├── warehouse.ts      # Checkout/checkin operations
│   ├── maintenance.ts    # Maintenance record CRUD
│   ├── search.ts         # globalSearch across all entities
│   ├── scan-lookup.ts    # Barcode → entity URL resolution
│   ├── notifications.ts  # Notification generation
│   ├── dashboard.ts      # Dashboard stats + activity
│   ├── reports.ts        # Business reports
│   ├── csv.ts            # CSV import/export
│   ├── settings.ts       # Org settings, asset tag config, branding
│   ├── changelog.ts      # Version/build info
│   ├── site-admin.ts     # Platform admin operations
│   ├── org-members.ts    # Org member management
│   ├── custom-roles.ts   # Custom role CRUD
│   ├── user-profile.ts   # User account operations
│   ├── invitations.ts    # Invitation helpers
│   ├── test-tag-assets.ts    # T&T asset CRUD
│   ├── test-tag-records.ts   # T&T test record CRUD
│   └── test-tag-reports.ts   # T&T report data + CSV
└── middleware.ts         # Auth check, route protection
```

---

## 3. Database Schema & Data Models

### Core Auth Models
- **User** — `id, name, email, emailVerified, image, role ("user"|"admin"), banned, banReason, twoFactorEnabled`
- **Session** — `id, token, expiresAt, userId, activeOrganizationId, ipAddress, userAgent`
- **Account** — OAuth/credential provider accounts
- **Verification** — Email verification tokens
- **TwoFactor** / **BackupCode** — TOTP 2FA storage

### Organization & Membership
- **Organization** — `id, name, slug (unique), logo, metadata (JSON)`. Metadata stores: `assetTagPrefix, assetTagDigits, assetTagCounter`, `testTag.*` settings, branding config
- **Member** — `id, organizationId, userId, role (owner|admin|manager|member|staff|warehouse|viewer), createdAt`
- **Invitation** — `id, organizationId, email, role, status (pending|accepted|rejected|cancelled), expiresAt, inviterId`
- **CustomRole** — `id, organizationId, name, description, color, permissions (JSON)`. Unique: `[organizationId, name]`
- **SiteSettings** — Singleton: `platformName, platformIcon, platformLogo, registrationPolicy, twoFactorGlobalPolicy, defaultCurrency, defaultTaxRate`

### Asset Models
- **Category** — `id, organizationId, name, parentId (self-join), description, icon, sortOrder`
- **Model** — `id, organizationId, name, manufacturer, modelNumber, categoryId, description, image, images[], specifications (JSON), customFields (JSON), defaultRentalPrice, defaultPurchasePrice, replacementCost, weight, powerDraw, requiresTestAndTag, testAndTagIntervalDays, defaultEquipmentClass, defaultApplianceType, maintenanceIntervalDays, assetType (SERIALIZED|BULK), isActive`
- **Asset** — `id, organizationId, modelId, assetTag, serialNumber, customName, status (AVAILABLE|CHECKED_OUT|IN_MAINTENANCE|RETIRED|LOST|RESERVED), condition (NEW|GOOD|FAIR|POOR|DAMAGED), purchaseDate, purchasePrice, supplierId, warrantyExpiry, notes, locationId, customFieldValues (JSON), kitId, isActive`. Unique: `[organizationId, assetTag]`
- **BulkAsset** — `id, organizationId, modelId, assetTag, totalQuantity, availableQuantity, purchasePricePerUnit, locationId, status (ACTIVE|LOW_STOCK|OUT_OF_STOCK|RETIRED), reorderThreshold, isActive`. Unique: `[organizationId, assetTag]`

### Kit Models
- **Kit** — `id, organizationId, assetTag, name, description, categoryId, status (AVAILABLE|CHECKED_OUT|IN_MAINTENANCE|RETIRED|INCOMPLETE), condition, locationId, weight, caseType, caseDimensions, image, images[], notes, isActive`. Unique: `[organizationId, assetTag]`
- **KitSerializedItem** — `id, organizationId, kitId, assetId (unique per org), position, sortOrder, addedAt, addedById, notes`. Unique: `[kitId, assetId]`
- **KitBulkItem** — `id, organizationId, kitId, bulkAssetId, quantity, position, sortOrder, addedAt, addedById, notes`

### Client & Location Models
- **Client** — `id, organizationId, name, type (COMPANY|INDIVIDUAL|VENUE|PRODUCTION_COMPANY), contactName, contactEmail, contactPhone, billingAddress, shippingAddress, taxId, paymentTerms, defaultDiscount, notes, tags[], isActive`
- **Location** — `id, organizationId, name, address, type (WAREHOUSE|VENUE|VEHICLE|OFFSITE), isDefault, parentId (self-join), notes`
- **Supplier** — `id, organizationId, name, contactName, email, phone, website, address, notes, isActive`. Unique: `[organizationId, name]`

### Project & Line Item Models
- **Project** — `id, organizationId, projectNumber, name, clientId, status (ENQUIRY|QUOTING|QUOTED|CONFIRMED|PREPPING|CHECKED_OUT|ON_SITE|RETURNED|COMPLETED|INVOICED|CANCELLED), type (DRY_HIRE|WET_HIRE|INSTALLATION|TOUR|CORPORATE|THEATRE|FESTIVAL|CONFERENCE|OTHER), description, locationId, siteContactName/Phone/Email, loadInDate/Time, eventStartDate/Time, eventEndDate/Time, loadOutDate/Time, rentalStartDate, rentalEndDate, projectManagerId, crewNotes, internalNotes, clientNotes, subtotal, discountPercent, discountAmount, taxAmount, total, depositPercent, depositPaid, invoicedTotal, tags[], isTemplate`. Unique: `[organizationId, projectNumber]`
- **ProjectLineItem** — `id, organizationId, projectId, type (EQUIPMENT|SERVICE|LABOUR|TRANSPORT|MISC), modelId, assetId, bulkAssetId, kitId, isKitChild, parentLineItemId, pricingMode (KIT_PRICE|ITEMIZED), description, quantity, unitPrice, pricingType (PER_DAY|PER_WEEK|FLAT|PER_HOUR), duration, discount, lineTotal, sortOrder, groupName, notes, isOptional, status (QUOTED|CONFIRMED|PREPPED|CHECKED_OUT|RETURNED|CANCELLED), checkedOutQuantity, returnedQuantity, checkedOutAt/ById, returnedAt/ById, returnCondition (GOOD|DAMAGED|MISSING), returnNotes, isSubhire, showSubhireOnDocs, supplierId`

### Maintenance Models
- **MaintenanceRecord** — `id, organizationId, kitId, type (REPAIR|PREVENTATIVE|TEST_AND_TAG|INSPECTION|CLEANING|FIRMWARE_UPDATE), status (SCHEDULED|IN_PROGRESS|COMPLETED|CANCELLED), title, description, reportedById, assignedToId, scheduledDate, completedDate, cost, partsUsed, result (PASS|FAIL|CONDITIONAL), nextDueDate`
- **MaintenanceRecordAsset** — `id, maintenanceRecordId, assetId`. Unique: `[maintenanceRecordId, assetId]`

### Test & Tag Models
- **TestTagAsset** — `id, organizationId, testTagId, description, equipmentClass (CLASS_I|CLASS_II|CLASS_II_DOUBLE_INSULATED|LEAD_CORD_ASSEMBLY), applianceType (APPLIANCE|CORD_SET|EXTENSION_LEAD|POWER_BOARD|RCD_PORTABLE|RCD_FIXED|THREE_PHASE|OTHER), make, modelName, serialNumber, location, testIntervalMonths, status (NOT_YET_TESTED|CURRENT|DUE_SOON|OVERDUE|FAILED|RETIRED), lastTestDate, nextDueDate, notes, assetId (unique optional), bulkAssetId, isActive`. Unique: `[organizationId, testTagId]`
- **TestTagRecord** — `id, organizationId, testTagAssetId, testDate, testedById, testerName, result (PASS|FAIL|NOT_APPLICABLE)`, plus 20+ detailed inspection/test fields for visual inspection, earth continuity, insulation resistance, leakage current, polarity, RCD trip time, functional test, failure action

### Media & Files
- **FileUpload** — `id, organizationId, fileName, fileSize, mimeType, storageKey, url, thumbnailUrl, width, height, uploadedById`
- **ModelMedia, AssetMedia, KitMedia, ProjectMedia, ClientMedia, LocationMedia** — Join tables: `{entityType}Id, fileId, type, isPrimary, displayName, sortOrder`. Unique: `[{entityType}Id, fileId]`

### Scan Logs
- **AssetScanLog** — `id, organizationId, assetId, bulkAssetId, kitId, projectId, action (CHECK_OUT|CHECK_IN|SCAN_VERIFY|TRANSFER), scannedById, scannedAt, notes, location`

---

## 4. Authentication & Multi-Tenancy

### Better Auth Configuration (`src/lib/auth.ts`)
- Plugins: `organization()`, `twoFactor({ issuer: "GearFlow" })`, `admin()`
- Email verification, password reset via Resend
- Session stored in PostgreSQL `Session` table with `activeOrganizationId`

### Middleware (`src/middleware.ts`)
- Checks cookies: `better-auth.session_token` or `__Secure-better-auth.session_token` (HTTPS)
- Public routes exempted: `/login`, `/register`, `/api/auth`, `/invite`, `/two-factor`, `/no-organization`, `/onboarding`, `/api/platform-name`, `/api/registration-policy`
- Unauthenticated requests redirect to `/login?callbackUrl=...`

### Session Helpers (`src/lib/auth-server.ts`)
- `getSession()` — Returns session + user or null
- `requireSession()` — Throws if not authenticated
- `requireOrganization()` — Throws if no `activeOrganizationId`

### Organization Context (`src/lib/org-context.ts`)
- `getOrgContext()` — Returns `{ organizationId, userId }` for the current request
- `orgWhere()` — Returns `{ where: { organizationId } }` for Prisma queries
- `requireRole(roles)` — Validates member has one of the specified roles
- `requirePermission(resource, action)` — Checks permission map, throws 403 if denied

### Multi-Tenancy Rules
- Every database query MUST include `organizationId` in its WHERE clause
- Asset tags, project numbers, test tag IDs are unique per org (composite unique indexes)
- File storage is org-prefixed: `{orgId}/{folder}/{entityId}/{filename}`
- Users can belong to multiple orgs; `activeOrganizationId` on the session determines the current context

---

## 5. Permissions & Access Control

### Two-Tier Model
1. **Site-level**: `User.role` = `"user"` or `"admin"`. Admin gets access to `/admin` panel
2. **Org-level**: `Member.role` = `owner | admin | manager | member | viewer` (legacy: `staff`, `warehouse`)

### Resource-Action Matrix (`src/lib/permissions.ts`)
14 resources: `asset, bulkAsset, model, kit, project, client, warehouse, testTag, maintenance, location, document, orgSettings, orgMembers, reports`

Actions per resource: `create, read, update, delete` (varies by resource)

```typescript
type Resource = "asset" | "bulkAsset" | "model" | "kit" | "project" | ...;
type Action = "create" | "read" | "update" | "delete";
rolePermissions: Record<string, Record<Resource, Action[]>>
```

### Role Hierarchy (default permissions)
- **owner/admin**: All permissions on all resources
- **manager**: All CRUD except orgSettings.delete, orgMembers.delete
- **member**: Read + create + update on operational resources, no org settings
- **viewer**: Read-only on all resources
- **Custom roles**: JSON-stored permissions override defaults, managed via `src/server/custom-roles.ts`

### Client-Side Permission Checking
- `useCurrentRole()` hook from `src/lib/use-permissions.ts` — returns `{ permissions, isLoading }`
- `hasAccess(resource)` in sidebar checks if user has ANY permission for a resource
- `PermissionGate` component conditionally renders children

### Server-Side Enforcement
```typescript
const { organizationId, userId } = await getOrgContext();
await requirePermission("asset", "create"); // throws if denied
```

---

## 6. Server Actions

All server actions are in `src/server/` with `"use server"` directive. Every function calls `getOrgContext()` for org scoping and `serialize()` on return values.

### Pattern
```typescript
"use server";
import { getOrgContext } from "@/lib/org-context";
import { serialize } from "@/lib/serialize";
import { prisma } from "@/lib/prisma";

export async function getItems({ page, pageSize, search, sort, order }) {
  const { organizationId } = await getOrgContext();
  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where: { organizationId, ...filters },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [sort]: order },
    }),
    prisma.item.count({ where: { organizationId, ...filters } }),
  ]);
  return serialize({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
```

### Key Server Action Files
| File | Key Functions |
|------|--------------|
| `assets.ts` | `createAsset`, `createAssets` (bulk), `updateAsset`, `deleteAsset`, `getAssets`, `getAssetById` |
| `bulk-assets.ts` | `createBulkAsset`, `updateBulkAsset`, `deleteBulkAsset`, `getBulkAssets`, `getBulkAssetById` |
| `models.ts` | `createModel`, `updateModel`, `deleteModel`, `getModels`, `getModelById`, `getModelWithAssets` |
| `kits.ts` | `createKit`, `updateKit`, `deleteKit`, `getKits`, `getKitById`, `addKitSerializedItems`, `removeKitSerializedItem`, `addKitBulkItems`, `removeKitBulkItem`, `checkOutKit`, `checkInKit` |
| `categories.ts` | `createCategory`, `updateCategory`, `deleteCategory`, `getCategories`, `getCategoryHierarchy` |
| `locations.ts` | `createLocation`, `updateLocation`, `deleteLocation`, `getLocations`, `getLocationHierarchy` |
| `suppliers.ts` | `createSupplier`, `updateSupplier`, `deleteSupplier`, `getSuppliers` |
| `clients.ts` | `createClient`, `updateClient`, `deleteClient`, `getClients`, `getClientById` |
| `projects.ts` | `createProject`, `updateProject`, `updateProjectStatus`, `deleteProject`, `getProjects`, `getProjectById`, `duplicateProject`, `saveAsTemplate`, `recalculateProjectTotals` |
| `line-items.ts` | `addLineItem`, `updateLineItem`, `deleteLineItem`, `reorderLineItems`, `checkAvailability`, `checkKitAvailability` |
| `warehouse.ts` | `getProjectForWarehouse`, `lookupAssetForScan`, `checkOutItems`, `checkInItems`, `checkOutKit`, `checkInKit`, `getWarehouseProjects`, `getAvailableAssetsForModel`, `quickAddAndCheckOut` |
| `maintenance.ts` | `createMaintenanceRecord`, `updateMaintenanceRecord`, `deleteMaintenanceRecord`, `getMaintenanceRecords`, `getMaintenanceRecordById` |
| `search.ts` | `globalSearch(query)` — searches models, assets, bulk assets, kits, projects, clients, locations, categories, maintenance |
| `scan-lookup.ts` | `scanLookup(value)` — resolves barcode to `{ url, label }` by checking Asset → Kit → BulkAsset → TestTagAsset |
| `notifications.ts` | `getNotifications()` — generates 5 types: overdue_maintenance, overdue_return, upcoming_project, low_stock, pending_invitation |
| `dashboard.ts` | `getDashboardStats`, `getRecentActivity`, `getUpcomingProjects` |
| `csv.ts` | `exportModelsCSV`, `exportAssetsCSV`, `exportBulkAssetsCSV`, `importModelsCSV`, `importAssetsCSV` |
| `settings.ts` | `getOrgSettings`, `updateOrgSettings`, `getBrandingSettings`, `updateBrandingSettings` |
| `site-admin.ts` | `getOrganizations`, `getUsers`, `promoteToSiteAdmin`, `banUser`, `getSiteSettings`, `updateSiteSettings` |
| `org-members.ts` | `inviteTeamMember`, `getOrganizationMembers`, `updateMemberRole`, `removeMember` |
| `test-tag-assets.ts` | `createTestTagAsset`, `batchCreateTestTagAssets`, `getTestTagAssets`, `peekNextTestTagIds`, `reserveTestTagIds` |
| `test-tag-records.ts` | `createTestTagRecord`, `recalculateTestTagStatus` |
| `test-tag-reports.ts` | 10 report functions + CSV exports |

---

## 7. API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/[...all]` | GET/POST | Better Auth catch-all (login, signup, sessions, OAuth) |
| `/api/current-role` | GET | Get user's role in active org |
| `/api/files/[...path]` | GET | S3 file proxy — validates org prefix on `storageKey` |
| `/api/uploads` | POST | Multipart file upload to S3, returns `FileUpload` metadata |
| `/api/documents/[projectId]` | GET | PDF generation (query: `type=quote\|invoice\|packing-list\|return-sheet\|delivery-docket`) |
| `/api/test-tag-reports/[reportType]` | GET | T&T report PDF/CSV (10 types, query: `format=pdf\|csv`) |
| `/api/platform-name` | GET | Public site settings (name, icon, logo, policies) |
| `/api/registration-policy` | GET | Public registration policy only |
| `/api/admin/org-export/[orgId]` | GET | Stream org backup as ZIP (site admin only) |
| `/api/admin/org-import` | POST | Import org from ZIP (site admin only, FormData) |
| `/api/admin-register/verify` | GET | Verify admin registration token |
| `/api/admin-register/promote` | POST | Promote user to site admin (token-gated) |

---

## 8. Page Routes & Layouts

### Layout Architecture

**Root Layout** (`src/app/layout.tsx`): `html > body > ThemeProvider > QueryProvider > {children} > Toaster`

**App Layout** (`src/app/(app)/layout.tsx`):
```
div.app-shell (fixed inset-0 on mobile, relative on desktop)
├── SidebarProvider (flex-1, min-h-0)
│   ├── AppSidebar (Sheet on mobile, fixed sidebar on desktop)
│   └── SidebarInset (flex column)
│       ├── TopBar (sticky, safe area padding)
│       └── main (flex-1, overflow-auto, content scrolls here)
└── MobileNav (shrink-0, hidden on md+)
```

**Admin Layout** (`src/app/(admin)/admin/layout.tsx`): Server-side role check + `AdminShell` component with own responsive sidebar

**Auth Layout** (`src/app/(auth)/layout.tsx`): Centered card, no sidebar

### All Pages

**Authentication**
| Path | Page |
|------|------|
| `/login` | Login form |
| `/register` | Registration (respects registration policy) |
| `/register/admin` | Secret admin registration (token-gated) |
| `/two-factor` | TOTP verification after login |
| `/invite/[id]` | Accept team invitation |
| `/onboarding` | First-time org setup |
| `/no-organization` | No org memberships (shows pending invites) |

**App (Protected)**
| Path | Page |
|------|------|
| `/dashboard` | Overview, stats, recent activity, upcoming projects |
| `/assets/registry` | Serialized + bulk asset list |
| `/assets/registry/new` | Create asset(s) |
| `/assets/registry/[id]` | Asset detail (tabs: info, history, maintenance, media) |
| `/assets/registry/[id]/edit` | Edit asset |
| `/assets/models` | Equipment model list |
| `/assets/models/new` | Create model |
| `/assets/models/[id]` | Model detail (specs, assets, kits, media) |
| `/assets/models/[id]/edit` | Edit model |
| `/assets/availability` | Availability calendar |
| `/kits` | Kit list |
| `/kits/new` | Create kit |
| `/kits/[id]` | Kit detail (contents, media, status) |
| `/kits/[id]/edit` | Edit kit |
| `/projects` | Project list (filterable by status, client, date) |
| `/projects/new` | Create project |
| `/projects/[id]` | Project detail (line items, documents, financials) |
| `/projects/[id]/edit` | Edit project |
| `/projects/templates` | Template list |
| `/projects/templates/new` | Create template |
| `/clients` | Client list |
| `/clients/new` | Create client |
| `/clients/[id]` | Client detail |
| `/clients/[id]/edit` | Edit client |
| `/warehouse` | Warehouse project list |
| `/warehouse/[projectId]` | Check out/in interface |
| `/warehouse/[projectId]/pull-sheet` | Pull sheet preview + print |
| `/locations` | Location hierarchy |
| `/locations/new` | Create location |
| `/locations/[id]` | Location detail |
| `/locations/[id]/edit` | Edit location |
| `/maintenance` | Maintenance record list |
| `/maintenance/new` | Create maintenance record |
| `/maintenance/[id]` | Maintenance detail |
| `/test-and-tag` | T&T overview |
| `/test-and-tag/registry` | T&T item list |
| `/test-and-tag/new` | Create T&T item |
| `/test-and-tag/[id]` | T&T item detail + test records |
| `/test-and-tag/quick-test` | Quick test form |
| `/test-and-tag/reports` | 10 report types |
| `/reports` | Business analytics |
| `/settings` | Settings overview |
| `/settings/assets` | Asset tags, categories, suppliers |
| `/settings/test-and-tag` | T&T ID format, defaults |
| `/settings/billing` | Currency & tax |
| `/settings/branding` | Logo & colors |
| `/settings/team` | Members, invites, roles, permission matrix |
| `/account` | Profile, password, 2FA, sessions, organizations |
| `/changelog` | Product changelog |

**Admin**
| Path | Page |
|------|------|
| `/admin` | Admin dashboard |
| `/admin/organizations` | Org list (CRUD, export/import) |
| `/admin/organizations/[id]` | Org detail |
| `/admin/users` | User list (promote, ban) |
| `/admin/settings` | Platform settings |

---

## 9. UI Component Library

### Critical Convention: `render` prop
shadcn/ui v4 uses Base UI, which uses `render` prop for composition (NOT Radix's `asChild`):
```tsx
<DialogTrigger render={<Button variant="outline" />}>Open Dialog</DialogTrigger>
<DropdownMenuTrigger render={<Button size="sm" />}>Menu</DropdownMenuTrigger>
<SidebarMenuButton render={<Link href="/foo" />}>Link Text</SidebarMenuButton>
```

### Key Custom Components
- **BarcodeScanner** (`src/components/ui/barcode-scanner.tsx`) — Camera scanner with Web Audio chime, ref-based callbacks, continuous mode
- **ComboboxPicker** (`src/components/ui/combobox-picker.tsx`) — Searchable select with `creatable` mode for new entries
- **ScanInput** (`src/components/ui/scan-input.tsx`) — Text input optimized for barcode scanner focus
- **SortableTableHead** (`src/components/ui/sortable-table-head.tsx`) — Clickable column headers with sort indicators
- **DynamicIcon** (`src/components/ui/dynamic-icon.tsx`) — Renders Lucide icon by string name
- **MediaUploader** (`src/components/media/media-uploader.tsx`) — Drag-to-reorder, primary marking, bulk upload
- **MediaThumbnail** (`src/components/media/media-thumbnail.tsx`) — Image with fallback placeholder

### Dialog vs Sheet
- **Dialog**: Centered modal. Full-screen on mobile with safe area padding via `style` prop
- **Sheet**: Side drawer (sidebar). Safe area padding merged into `SheetContent` via extracted `style` prop

### Base UI Gotchas
- Checkbox uses `indeterminate` boolean prop, not string value
- SelectValue can't resolve text from portal-rendered items — pass explicit label children
- DropdownMenuLabel must be inside DropdownMenuGroup
- Use `onMouseDown` with `preventDefault` (not `onClick`) for buttons inside popovers

---

## 10. Asset Management System

### Three Asset Types
1. **Serialized** (`Asset`): Individually tracked, unique tag, has status lifecycle
2. **Bulk** (`BulkAsset`): Quantity-tracked, `totalQuantity`/`availableQuantity`
3. **Kit** (`Kit`): Container of serialized + bulk assets (see Kit System section)

### Auto-Incrementing Tags
Stored in `Organization.metadata` JSON:
```json
{ "assetTagPrefix": "TTP", "assetTagDigits": 5, "assetTagCounter": 42 }
```
- `peekNextAssetTags(count)` — Read-only preview for form pre-fill (no increment)
- `reserveAssetTags(count)` — Atomic increment, called ONLY after successful creation
- Users can override suggested tags. Adding/removing form rows doesn't burn numbers

### Asset Status Lifecycle
```
AVAILABLE → CHECKED_OUT (via warehouse checkout)
AVAILABLE → IN_MAINTENANCE (via maintenance record)
AVAILABLE → RESERVED (manual)
CHECKED_OUT → AVAILABLE (check in with GOOD condition)
CHECKED_OUT → IN_MAINTENANCE (check in with DAMAGED condition)
CHECKED_OUT → LOST (check in with MISSING condition)
IN_MAINTENANCE → AVAILABLE (maintenance completed)
Any → RETIRED (manual)
```

---

## 11. Kit System

### Data Model
- `Kit` has own `assetTag`, `status`, `condition`
- Contents: `KitSerializedItem[]` (Kit → Asset, one asset per kit) and `KitBulkItem[]` (Kit → BulkAsset with quantity)
- Join tables use `addedAt` (not `createdAt`), plus `position`, `sortOrder`, `addedById`, `notes`

### Line Item Representation
- Parent line item: `kitId` set, `isKitChild: false`, `pricingMode` = `KIT_PRICE` or `ITEMIZED`
- Child line items: `isKitChild: true`, `parentLineItemId` pointing to parent
- Detection: `!!lineItem.kitId && !lineItem.isKitChild` = kit parent

### Pricing Modes
- **KIT_PRICE**: Single price on parent row, children have `unitPrice: 0`
- **ITEMIZED**: Individual prices on each child row, parent has `unitPrice: 0`

### Warehouse Operations
- Kit checkout: `checkOutKit()` — atomic transaction updating kit + all member assets
- Kit checkin: `checkInKit()` — same atomic pattern
- If scanning a member asset, warehouse shows "scan the kit instead"
- In warehouse UI, kit items detected by `kitId` must route to `kitCheckOutMutation`, NOT regular `checkOutItems`

---

## 12. Project & Rental Management

### Status Flow
```
ENQUIRY → QUOTING → QUOTED → CONFIRMED → PREPPING → CHECKED_OUT → ON_SITE → RETURNED → COMPLETED → INVOICED
                                                                                         ↗
                                            Any status → CANCELLED ──────────────────────┘
```

### Financial Calculations (`recalculateProjectTotals()`)
- `subtotal` = sum of `lineTotal` for non-optional, non-cancelled items
- `discountAmount` = `subtotal * discountPercent / 100`
- `taxAmount` = `(subtotal - discountAmount) * 0.10` (10% GST hardcoded)
- `total` = `subtotal - discountAmount + taxAmount`
- `invoicedTotal` = manual override (e.g., from Xero)
- Called automatically whenever line items change

### Project Types
`DRY_HIRE, WET_HIRE, INSTALLATION, TOUR, CORPORATE, THEATRE, FESTIVAL, CONFERENCE, OTHER`

### Subhire
Line items with `isSubhire: true` and `supplierId` reference third-party equipment. `showSubhireOnDocs` controls visibility on client-facing PDFs.

---

## 13. Line Items & Groups

### Line Item Types
- **EQUIPMENT**: Links to `modelId`, optionally `assetId` (after checkout), `bulkAssetId`, or `kitId`
- **SERVICE / LABOUR / TRANSPORT / MISC**: No asset link, just description + pricing

### Pricing Types
- `PER_DAY`: `unitPrice * duration` (duration in days)
- `PER_WEEK`: `unitPrice * duration` (duration in weeks)
- `PER_HOUR`: `unitPrice * duration` (duration in hours)
- `FLAT`: `unitPrice` (no duration multiplier)

### Visual Groups
- `groupName` field on line items for visual grouping
- Groups are drag-and-drop reorderable via `reorderLineItems()`
- `ComboboxPicker` with `creatable` mode lets users type new group names
- New groups tracked in `extraGroups` local state for immediate UI updates

### Duplicate Model Handling
Adding a model that already exists as a line item on the project **merges** into the existing line item (increments quantity) rather than creating a new row.

---

## 14. Availability & Overbooking Engine

### How It Works (`src/lib/availability.ts`)
1. For each line item's model, query all other projects with overlapping rental dates
2. Exclude finished statuses: `CANCELLED, RETURNED, COMPLETED, INVOICED`
3. Exclude templates: `isTemplate: false`
4. Calculate `effectiveStock = totalStock - unavailableAssets` (IN_MAINTENANCE, LOST, RETIRED)
5. Calculate `totalBooked` across all overlapping projects
6. `isOverbooked = totalBooked > effectiveStock`
7. `isReducedStock = unavailableAssets > 0 && totalBooked > effectiveStock - unavailableAssets`

### `computeOverbookedStatus(organizationId, lineItems, startDate, endDate, projectId)`
- Batches all queries for efficiency (single pass over all line items)
- Returns `Map<lineItemId, { overBy, totalStock, effectiveStock, totalBooked, reducedOnly, inherited }>`
- Kit parents inherit overbooking from children (`hasOverbookedChildren`, `hasReducedChildren`)

### UI Indicators
- **Red badge**: "OVERBOOKED" — shown on project list (AlertTriangle), project detail, all 5 PDFs
- **Purple badge**: "REDUCED STOCK" — shown when overbooking is caused only by unavailable assets
- Overbooking allowed with explicit checkbox confirmation in add/edit dialogs

---

## 15. Warehouse Operations

### Check Out Flow
1. User opens project in warehouse view (`/warehouse/[projectId]`)
2. Scans barcode or selects asset from dropdown
3. `lookupAssetForScan` validates: asset exists, matches a line item model, not already checked out elsewhere
4. For serialized: `checkOutItems` assigns `assetId` to line item, sets asset status to `CHECKED_OUT`
5. For bulk: increments `checkedOutQuantity` on line item, decrements `availableQuantity` on bulk asset
6. For kit: `checkOutKit` atomically updates kit + all member assets + all child line items

### Check In Flow
1. User selects items to check in, specifies condition per item
2. `checkInItems` based on condition:
   - GOOD → asset status `AVAILABLE`, disconnects `assetId` from line item
   - DAMAGED → asset status `IN_MAINTENANCE`, disconnects
   - MISSING → asset status `LOST`, disconnects
3. For kit: `checkInKit` atomically reverses checkout

### Conflict Detection
`lookupAssetForScan` checks both line item status AND physical asset status. If asset is `CHECKED_OUT` on another project, returns error with project name/number.

### Online Pick List
Dialog with full item list showing checkout status per line item. Mobile full-screen with safe area padding.

---

## 16. PDF Document Generation

### Architecture
- `@react-pdf/renderer` renders React components to PDF
- API route: `GET /api/documents/[projectId]?type=quote` streams PDF
- Templates in `src/lib/pdf/`: `quote-pdf.tsx`, `invoice-pdf.tsx`, `packing-list-pdf.tsx`, `return-sheet-pdf.tsx`, `delivery-docket-pdf.tsx`
- Shared styles in `src/lib/pdf/styles.ts`

### Constraints
- **Helvetica only** — no Unicode symbols (use ASCII: `-` not `—`, `|` not `•`)
- Checkboxes rendered as `View` boxes with borders
- Kit contents rendered as indented children under kit parent row
- Line item notes shown as subtitles
- Badges: red "OVERBOOKED", purple "REDUCED STOCK"
- Pull slip: per-unit checkboxes for qty > 1 items

### T&T Reports
10 PDF templates in `src/lib/pdf/test-tag-*.tsx`. API route: `GET /api/test-tag-reports/[reportType]?format=pdf|csv`. Date objects must be JSON-serialized before passing to PDF components.

---

## 17. Test & Tag Module (AS/NZS 3760:2022)

### Equipment Classes
- `CLASS_I` — Earth continuity + insulation/leakage
- `CLASS_II` — Insulation/leakage only (no earth)
- `CLASS_II_DOUBLE_INSULATED` — Same as Class II
- `LEAD_CORD_ASSEMBLY` — Earth continuity + always polarity (like Class I but polarity not conditional)

### Status Lifecycle
```
NOT_YET_TESTED → (first test) → CURRENT
CURRENT → (interval expires soon) → DUE_SOON
DUE_SOON → (interval expires) → OVERDUE
Any → (test fails) → FAILED
Any → (manual) → RETIRED
FAILED → (retest passes) → CURRENT
```

### Auto-Incrementing IDs
Same pattern as asset tags. Stored in `Organization.metadata.testTag`:
```json
{ "prefix": "TT", "digits": 5, "counter": 1 }
```

### Reports (10 types)
| Report | PDF | CSV | Description |
|--------|-----|-----|-------------|
| Full Register | Y | Y | All T&T items with status |
| Overdue/Non-Compliant | Y | Y | Items past due or failed |
| Test Session | Y | Y | Tests performed in date range |
| Item History | Y | Y | All records for one item |
| Due Schedule | Y | Y | Upcoming tests by month |
| Class Summary | Y | Y | Stats by equipment class |
| Tester Activity | Y | Y | Tests per tester |
| Failed Items | Y | Y | Failed items with details |
| Bulk Asset Summary | Y | N | T&T items grouped by bulk asset |
| Compliance Certificate | Y | N | Single-item compliance cert |

---

## 18. Maintenance System

### Multi-Asset Records
One `MaintenanceRecord` links to multiple assets via `MaintenanceRecordAsset` join table. The form uses barcode scanning (continuous mode) to add assets.

### Types & Statuses
- Types: `REPAIR, PREVENTATIVE, TEST_AND_TAG, INSPECTION, CLEANING, FIRMWARE_UPDATE`
- Statuses: `SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED`
- Results: `PASS, FAIL, CONDITIONAL`

### Notifications
Overdue maintenance generates notifications. Shows first asset name + count for multi-asset records.

---

## 19. Search & Command Palette

### Global Search (`src/server/search.ts`)
`globalSearch(query)` searches across:
- Models (name, manufacturer, modelNumber, description) — children: assets
- Assets (assetTag, serialNumber, customName)
- Bulk assets (assetTag)
- Kits (assetTag, name)
- Projects (projectNumber, name) — non-templates only
- Clients (name, contactName) — children: projects
- Locations (name, address) — children: child locations
- Categories (name) — children: models
- Maintenance (title)

Uses PostgreSQL ILIKE and trigram similarity for fuzzy matching.

### Command Palette (`src/components/layout/command-search.tsx`)
- **Normal mode**: Free text → `globalSearch()` results
- **@ mode**: Page navigation via `PAGE_COMMANDS` (`src/lib/page-commands.ts`)
  - Each page has: `label, href, aliases[], icon, description, searchable?, searchType?, children?`
  - Tab drills into children, space after page name searches entities
  - Example: `@warehouse drum` → searches projects containing "drum" and links to warehouse view
- **Date shortcuts**: Typing DD/MM/YYYY navigates to availability calendar
- **Keyboard**: `Shift+↑/↓` skip children, `Tab` drill, `Esc` back, `Cmd+L` toggle children
- **Mobile**: Full-screen dialog with safe area padding

### Adding New Entities to Search
1. Add search case to `globalSearch()` in `src/server/search.ts`
2. Add page to `PAGE_COMMANDS` in `src/lib/page-commands.ts` with `searchable: true` and `searchType`

---

## 20. Notification System

### Types
| Type | Trigger | Link |
|------|---------|------|
| `overdue_maintenance` | scheduledDate passed, status != COMPLETED | `/maintenance/{id}` |
| `overdue_return` | rentalEndDate passed, status in active statuses | `/projects/{id}` |
| `upcoming_project` | rentalStartDate within 3 days | `/projects/{id}` |
| `low_stock` | bulkAsset.availableQuantity <= reorderThreshold | `/assets/registry/{id}` |
| `pending_invitation` | Pending invitations for current user | `/settings/team` |

### Implementation
- Server: `getNotifications()` in `src/server/notifications.ts` queries all types
- Client: `src/components/layout/notifications.tsx` — bell icon with dropdown
- Dismiss: localStorage-based via `getDismissedIds()`/`saveDismissedIds()`. Click dismisses + navigates to `href`

---

## 21. Media & File Storage

### Upload Flow
1. Client sends multipart form to `POST /api/uploads`
2. Server uploads to S3 under `{orgId}/{folder}/{entityId}/{uuid}-{filename}`
3. Returns `FileUpload` record with `storageKey, url, mimeType, fileSize`
4. Entity-specific media join table created (e.g., `ModelMedia`)

### File Proxy (`GET /api/files/[...path]`)
- Validates `storageKey` starts with user's `activeOrganizationId`
- Returns 403 if org mismatch (prevents cross-tenant access)
- Streams file from S3

### Photo Resolution Cascade
- `resolveAssetPhotoUrl(asset, model)`: asset primary photo → model primary photo → null
- `resolveModelPhotoUrl(model)`: model primary photo → null

---

## 22. Mobile & PWA

### PWA Configuration
- Manifest: `public/manifest.json` — `display: standalone`, icons 192/384/512, start URL `/dashboard`
- Service worker via `@ducanh2912/next-pwa`
- Offline page: `src/app/offline/page.tsx`
- Meta: `apple-mobile-web-app-capable: yes`, `statusBarStyle: black-translucent`

### iOS PWA Viewport Fix (`src/app/globals.css`)
With `viewport-fit: cover` + `black-translucent`, iOS pushes content into the status bar but doesn't extend viewport height, leaving a bottom gap. Fix:
```css
html { min-height: calc(100% + env(safe-area-inset-top)); }
@media (max-width: 767px) {
  .app-shell { position: fixed; inset: 0; overflow: hidden; }
}
```

### Safe Area Pattern
**Always use inline styles for `env()` values** — Tailwind arbitrary values don't reliably preserve `env()`:
```tsx
// CORRECT
style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
// WRONG - may not work on iOS
className="pt-[env(safe-area-inset-top,0px)]"
```

### App Layout Structure (mobile)
```
div.app-shell (position: fixed, inset: 0, flex column, overflow: hidden)
├── SidebarProvider (flex-1, min-h-0)
│   └── SidebarInset (min-h-0, flex column)
│       ├── TopBar (sticky, paddingTop: safe-area-top)
│       └── main (flex-1, overflow-auto ← content scrolls here)
└── MobileNav (shrink-0, paddingBottom: safe-area-bottom, md:hidden)
```

### Mobile Bottom Nav (`src/components/layout/mobile-nav.tsx`)
- Flow element (NOT position: fixed) — sits at bottom of flex column
- 5 items: Home, Assets, Scan, Projects, Warehouse
- Scan button opens camera overlay via `BarcodeScanner`
- Scan result resolved via `scanLookup()` → navigates to matched entity

---

## 23. Barcode & QR Code Scanning

### Scanner Component (`src/components/ui/barcode-scanner.tsx`)
- Uses `html5-qrcode` library
- No overlay — whole camera feed is scan area
- Audio chime: Web Audio API, 1200Hz sine wave, 150ms with exponential fade
- **Callbacks stored in refs** to prevent re-render loop (parent re-render → new callback → useEffect restart → immediate rescan)
- `continuous` prop: keeps scanning after first result (for multi-asset forms)
- `activeRef` guards against callbacks firing after scanner stop

### Scan Lookup (`src/server/scan-lookup.ts`)
Resolves barcode value to entity URL:
1. Check `Asset` by `assetTag` → `/assets/registry/{id}`
2. Check `Kit` by `assetTag` → `/kits/{id}`
3. Check `BulkAsset` by `assetTag` → `/assets/registry/{id}`
4. Check `TestTagAsset` by `testTagId` → `/test-and-tag/{id}`
5. Returns `{ url: null, label: null }` if no match

### QR Code Generation
- `src/components/assets/asset-qr-code.tsx` — generates and prints QR codes
- Encodes asset tag value for scanning

---

## 24. CSV Import/Export

### Export
- `exportModelsCSV()` — all active models with specs
- `exportAssetsCSV()` — all active serialized assets
- `exportBulkAssetsCSV()` — all active bulk assets

### Import
- `importModelsCSV(csvContent)` — upsert by name + manufacturer + modelNumber
- `importAssetsCSV(csvContent)` — upsert by assetTag, auto-generate tags if missing
- Custom CSV parser (no external deps) with flexible column matching (camelCase, snake_case, Title Case)

### UI
`CSVImportDialog` (`src/components/assets/csv-import-dialog.tsx`) — reusable file upload with progress bar and error display

---

## 25. Organization Export/Import

### Export (`src/lib/org-export.ts`)
- Queries all 27 org-scoped tables
- Builds streaming ZIP via `archiver`: `manifest.json` + `files/{storageKey}`
- Concurrent S3 downloads limited to 5
- API: `GET /api/admin/org-export/[orgId]` (site admin only)

### Import (`src/lib/org-import.ts`)
- Extracts ZIP via `unzipper`
- Creates new org with full ID remapping (`@paralleldrive/cuid2`)
- Topological sort (BFS) for hierarchical tables (Category, Location, ProjectLineItem parentId)
- User FKs resolved by email matching — unmatched users are skipped gracefully
- S3 files re-uploaded under new org prefix; `thumbnailUrl` cleared
- Image URL references (`model.image`, `kit.image`, etc.) updated via URL mapping
- `safeDate()`/`safeDateOpt()` handle invalid dates
- API: `POST /api/admin/org-import` (FormData with file + optional name/slug)

---

## 26. Project Templates

### Model
`Project.isTemplate = true`. Templates use the same `Project` table but are completely isolated.

### Auto-Generated Codes
`generateTemplateCode()` creates `TPL-0001`, `TPL-0002`, etc. Users don't set codes for templates.

### Isolation Rules
Templates MUST be excluded from:
- Dashboard stats, notifications, reports, search results, availability calendar
- Availability checks (`checkAvailability`, `checkKitAvailability`, `computeOverbookedStatus`)
- All project list queries: add `isTemplate: false` filter

### Server Guards
- `updateProjectStatus()` rejects templates
- `getProjectForWarehouse()` throws for templates

### UI Differences
Template detail page hides: status dropdown, documents button, cancel/archive/delete, financial summary, dates card

### Duplication
- "Use Template" → `duplicateProject(templateId, { isTemplate: false })` → creates real project
- "Save as Template" → `saveAsTemplate(projectId)` → creates template from real project
- Both call `recalculateProjectTotals` AFTER transaction commits (not inside)

---

## 27. Site Admin Panel

### Access
`User.role === "admin"` checked server-side in admin layout. First user auto-promoted.

### Pages
- `/admin` — Dashboard with org count, user count, storage stats
- `/admin/organizations` — CRUD org list, per-row export/download, import dialog
- `/admin/organizations/[id]` — Org detail with member list, export button
- `/admin/users` — User list, promote to admin, ban/unban, force-disable 2FA
- `/admin/settings` — Platform name, icon, logo, registration policy, 2FA global policy, default currency/tax

### Mobile Responsive
`AdminShell` component: desktop sidebar hidden on mobile, replaced with hamburger menu + dropdown nav. Safe area padding on mobile header.

---

## 28. Client & Location Management

### Clients
- Types: `COMPANY, INDIVIDUAL, VENUE, PRODUCTION_COMPANY`
- Fields: contact info, billing/shipping addresses, tax ID, payment terms, default discount, tags
- Relations: projects (links to all projects for this client)

### Locations
- Types: `WAREHOUSE, VENUE, VEHICLE, OFFSITE`
- Hierarchical: parent/child self-join for nested warehouse zones
- `isDefault` flag for primary warehouse location

### Suppliers
- Unique per org by name
- Referenced by: assets (purchase supplier), line items (subhire supplier)

---

## 29. Settings & Branding

### Org Settings (`Organization.metadata` JSON)
```json
{
  "assetTagPrefix": "TTP",
  "assetTagDigits": 5,
  "assetTagCounter": 42,
  "testTag": {
    "prefix": "TT",
    "digits": 5,
    "counter": 1,
    "defaultIntervalMonths": 6,
    "defaultEquipmentClass": "CLASS_I",
    "dueSoonThresholdDays": 30,
    "companyName": "...",
    "defaultTesterName": "...",
    "defaultTestMethod": "BOTH",
    "checkoutPolicy": "..."
  }
}
```

### Platform Branding (`SiteSettings`)
- `platformName` — Displayed in sidebar, page titles, emails
- `platformIcon` — Lucide icon name, rendered via `DynamicIcon`
- `platformLogo` — Uploaded image URL
- Dynamic favicon via `DynamicFavicon` component

### Client-Side Hooks
- `usePlatformName()` — Returns platform name string
- `usePlatformBranding()` — Returns `{ name, icon, logo }`
- `BrandingProvider` context wraps the app layout

---

## 30. Dashboard & Reporting

### Dashboard (`/dashboard`)
- Stats cards: Total Assets, Checked Out, Active Projects, Maintenance Due
- Recent activity feed: project status changes, maintenance records, T&T records
- Upcoming projects list

### Reports (`/reports`)
- Project stats by status
- Revenue calculations
- Asset utilization metrics

### Notification-Driven Alerts
Dashboard surfaces the same data as the notification system: overdue returns, upcoming projects, maintenance due, low stock.

---

## 31. Key Patterns & Conventions

### Server Action Pattern
```typescript
"use server";
export async function myAction(data: InputType) {
  const { organizationId, userId } = await getOrgContext();
  await requirePermission("resource", "action");
  const result = await prisma.model.create({ data: { ...data, organizationId } });
  return serialize(result);
}
```

### Form Validation Pattern
```typescript
// src/lib/validations/my-form.ts
export const mySchema = z.object({
  name: z.string().min(1, "Required"),
  date: z.union([z.literal(""), z.coerce.date()]).optional()
    .transform(v => v === "" ? undefined : v),
  price: z.coerce.number().optional(),
});
export type MyFormValues = z.input<typeof mySchema>; // NOT z.infer
```

### Client Component Pattern
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

### Date Handling
Server actions receive dates as strings after serialization. Always wrap:
```typescript
const date = input.scheduledDate ? new Date(input.scheduledDate) : null;
```

---

## 32. Integration Checklist for New Features

When implementing a new feature, ensure it integrates with ALL existing systems:

| System | What to Do |
|--------|-----------|
| **Permissions** | Add resource to `src/lib/permissions.ts`. Use `requirePermission()` in server actions. |
| **Sidebar** | Add nav item to `src/components/layout/app-sidebar.tsx` with `resource` for gating. |
| **Top bar** | Add segment label to `segmentLabels` in `src/components/layout/top-bar.tsx`. |
| **Search** | Add entity search to `globalSearch()` in `src/server/search.ts`. |
| **Page commands** | Add to `PAGE_COMMANDS` in `src/lib/page-commands.ts` for @ navigation. |
| **Notifications** | Add time-based alerts to `src/server/notifications.ts` if applicable. |
| **Dashboard** | Add stats/activity to `src/server/dashboard.ts` if relevant. |
| **Templates** | If querying projects, add `isTemplate: false` filter. |
| **Mobile** | Responsive tables, touch targets, text wrapping (`break-words min-w-0`). |
| **Safe areas** | Full-screen mobile dialogs need safe area padding via `style` prop. |
| **Org scoping** | Every query MUST include `organizationId`. Use `getOrgContext()`. |
| **Serialization** | Always `serialize()` return values from server actions. |
| **Validation** | Zod schema in `src/lib/validations/`. Use `z.input<>` for form types. |
| **Media** | If entity has photos, create `{Entity}Media` join table + `MediaUploader`. |
| **CSV** | Consider import/export if bulk data operations are useful. |
| **Org export** | Add new table to export manifest in `src/lib/org-export.ts` and import in `src/lib/org-import.ts`. |
