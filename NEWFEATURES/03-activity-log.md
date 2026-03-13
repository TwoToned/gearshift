# Feature: Full Activity Log (Audit Trail)

## Summary

Implement a comprehensive, independent activity log that tracks every significant action taken on any entity in GearFlow. This provides a full audit trail visible on a dedicated page with filtering, searching, and CSV export.

## Current State

- `AssetScanLog` exists but only tracks scan/checkout/checkin actions
- Dashboard has a basic "recent activity" feed built from querying recent records across tables
- No unified, persistent log of create/update/delete operations

## Data Model

### New Prisma Model: `ActivityLog`

```prisma
model ActivityLog {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // What happened
  action          String   // CREATE, UPDATE, DELETE, STATUS_CHANGE, CHECK_OUT, CHECK_IN, SCAN, ASSIGN, UNASSIGN, EXPORT, IMPORT, INVITE, etc.
  entityType      String   // asset, bulkAsset, model, kit, project, client, location, category, supplier, maintenance, testTagAsset, testTagRecord, lineItem, member, invitation, settings, crewMember, crewAssignment, crewRole, crewTimeEntry
  entityId        String   // ID of the affected entity
  entityName      String   // Human-readable name/tag at time of action (denormalized for display)

  // Who did it
  userId          String?
  user            User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  userName        String   // Denormalized — in case user is deleted

  // Details
  summary         String   // Human-readable one-liner: "Created asset TTP-00042"
  details         Json?    // Structured change data (see below)
  metadata        Json?    // Extra context: IP, user agent, related entity IDs

  // Relations for quick filtering
  projectId       String?  // Set when action relates to a project (line item changes, checkout, etc.)
  assetId         String?  // Set when action relates to a specific asset
  kitId           String?  // Set when action relates to a kit
  crewMemberId    String?  // Set when action relates to a crew member (requires Crew Management feature)

  createdAt       DateTime @default(now())

  @@index([organizationId, createdAt])
  @@index([organizationId, entityType])
  @@index([organizationId, userId])
  @@index([organizationId, projectId])
  @@index([organizationId, assetId])
  @@index([organizationId, entityType, entityId])
  @@index([organizationId, crewMemberId])
}
```

### `details` JSON Structure

For UPDATE actions, store a changes object:
```json
{
  "changes": [
    { "field": "status", "from": "AVAILABLE", "to": "CHECKED_OUT" },
    { "field": "locationId", "from": "loc_abc", "to": "loc_xyz", "fromLabel": "Warehouse A", "toLabel": "Venue B" }
  ]
}
```

For CREATE actions, store key fields of the created entity (not the full record):
```json
{
  "created": {
    "assetTag": "TTP-00042",
    "model": "Shure SM58",
    "status": "AVAILABLE"
  }
}
```

For DELETE actions, store enough to identify what was deleted:
```json
{
  "deleted": {
    "assetTag": "TTP-00042",
    "name": "Shure SM58 #3"
  }
}
```

## Server-Side Logging Utility

### `src/lib/activity-log.ts`

Create a utility function that all server actions call:

```typescript
import { prisma } from "@/lib/prisma";

interface LogActivityInput {
  organizationId: string;
  userId: string;
  userName: string;
  action: string;           // CREATE, UPDATE, DELETE, STATUS_CHANGE, CHECK_OUT, CHECK_IN, etc.
  entityType: string;       // asset, model, kit, project, etc.
  entityId: string;
  entityName: string;       // "TTP-00042", "Project: Summer Festival", etc.
  summary: string;          // "Created asset TTP-00042"
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  projectId?: string;
  assetId?: string;
  kitId?: string;
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({ data: input });
  } catch (error) {
    // Log to console but never throw — activity logging must not break operations
    console.error("Failed to log activity:", error);
  }
}
```

### Diff Utility for Updates

Create a helper `buildChanges(before, after, fields)` that compares two objects and returns the `changes` array for the `details` JSON. Only include fields that actually changed.

```typescript
export function buildChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
  labels?: Record<string, Record<string, string>> // field → id → label mappings
): Array<{ field: string; from: unknown; to: unknown; fromLabel?: string; toLabel?: string }> {
  // Compare each field, return only changed ones
}
```

## Server Actions to Instrument

Add `logActivity()` calls to every write operation. The call should happen **after** the successful database operation (not before, not in a transaction — logging must never block the main operation).

### Core Entity CRUD

| File | Functions to instrument |
|------|----------------------|
| `src/server/assets.ts` | `createAsset`, `createAssets`, `updateAsset`, `deleteAsset` |
| `src/server/bulk-assets.ts` | `createBulkAsset`, `updateBulkAsset`, `deleteBulkAsset` |
| `src/server/models.ts` | `createModel`, `updateModel`, `deleteModel` |
| `src/server/kits.ts` | `createKit`, `updateKit`, `deleteKit`, `addKitSerializedItems`, `removeKitSerializedItem`, `addKitBulkItems`, `removeKitBulkItem` |
| `src/server/projects.ts` | `createProject`, `updateProject`, `updateProjectStatus`, `deleteProject`, `duplicateProject`, `saveAsTemplate` |
| `src/server/line-items.ts` | `addLineItem`, `updateLineItem`, `deleteLineItem`, `reorderLineItems` |
| `src/server/clients.ts` | `createClient`, `updateClient`, `deleteClient` |
| `src/server/locations.ts` | `createLocation`, `updateLocation`, `deleteLocation` |
| `src/server/categories.ts` | `createCategory`, `updateCategory`, `deleteCategory` |
| `src/server/suppliers.ts` | `createSupplier`, `updateSupplier`, `deleteSupplier` |

### Warehouse Operations

| File | Functions |
|------|----------|
| `src/server/warehouse.ts` | `checkOutItems`, `checkInItems`, `checkOutKit`, `checkInKit` |

For checkout/checkin, set both `projectId` and `assetId`/`kitId` on the log entry for cross-referencing.

### Maintenance & Test Tag

| File | Functions |
|------|----------|
| `src/server/maintenance.ts` | `createMaintenanceRecord`, `updateMaintenanceRecord`, `deleteMaintenanceRecord` |
| `src/server/test-tag-assets.ts` | `createTestTagAsset`, `batchCreateTestTagAssets` |
| `src/server/test-tag-records.ts` | `createTestTagRecord` |

### Settings & Members

| File | Functions |
|------|----------|
| `src/server/settings.ts` | `updateOrgSettings`, `updateBrandingSettings` |
| `src/server/org-members.ts` | `inviteTeamMember`, `updateMemberRole`, `removeMember` |
| `src/server/custom-roles.ts` | Create, update, delete custom roles |

### Crew Management (requires Crew Management feature)

| File | Functions |
|------|----------|
| `src/server/crew.ts` | `createCrewMember`, `updateCrewMember`, `deleteCrewMember`, `linkCrewToUser`, `inviteCrewToRegister` |
| `src/server/crew-assignments.ts` | `createAssignment`, `updateAssignment`, `deleteAssignment`, `offerAssignment`, `confirmAssignment`, `respondToOffer`, `copyCrewFromProject` |
| `src/server/crew-availability.ts` | `addAvailability`, `removeAvailability` |
| `src/server/crew-time.ts` | `createTimeEntry`, `updateTimeEntry`, `deleteTimeEntry`, `approveTimeEntries` |
| `src/server/crew-roles.ts` | `createCrewRole`, `updateCrewRole`, `deleteCrewRole` |

For crew assignments, set `projectId` on the log entry for cross-referencing. The `entityType` should be `crewMember`, `crewAssignment`, `crewRole`, or `crewTimeEntry` as appropriate. Actions include `CREW_OFFERED`, `CREW_ACCEPTED`, `CREW_DECLINED`, `CREW_CONFIRMED` in addition to the standard CRUD actions.

## Server Action: Query Logs

### `src/server/activity-log.ts`

```typescript
export async function getActivityLogs({
  page = 1,
  pageSize = 50,
  entityType,       // filter by entity type
  action,           // filter by action type
  userId,           // filter by who performed it
  entityId,         // filter to a specific entity
  projectId,        // filter to a specific project
  assetId,          // filter to a specific asset
  search,           // free text search on summary
  startDate,        // date range filter
  endDate,
  sort = "createdAt",
  order = "desc",
}: ActivityLogFilters) {
  const { organizationId } = await getOrgContext();
  // Build where clause from filters
  // Return paginated results with user info
}

export async function getEntityActivityLog(entityType: string, entityId: string) {
  // Shortcut for getting all logs for a specific entity
}

export async function exportActivityLogCSV(filters: ActivityLogFilters) {
  // Same filters as getActivityLogs but returns CSV string
}
```

## Page: Activity Log (`/activity`)

### Route

Create `src/app/(app)/activity/page.tsx`

### Layout

Full-width table with:

**Filter bar (top):**
- Entity type dropdown (All, Assets, Models, Kits, Projects, Clients, Locations, etc.)
- Action dropdown (All, Created, Updated, Deleted, Status Change, Checked Out, Checked In, etc.)
- User dropdown (populated from org members)
- Date range picker (start/end dates)
- Free text search field (searches `summary`)
- Clear filters button

**Table columns:**
| Column | Notes |
|--------|-------|
| Timestamp | Formatted date/time, relative time tooltip |
| User | Name with avatar if available |
| Action | Badge (color coded: green=create, blue=update, red=delete, amber=checkout, etc.) |
| Entity Type | Icon + label |
| Summary | The human-readable summary text |
| → | Link to the entity detail page |

**Table features:**
- Sortable by timestamp (default: newest first)
- Paginated with page size selector
- Click a row to expand and show the `details` JSON formatted nicely (show field changes as "field: old → new")

**Export:**
- CSV export button that respects current filters
- Exports: timestamp, user, action, entity type, entity name, summary, details (flattened)

### Sidebar Entry

Add to sidebar:
```typescript
{
  title: "Activity Log",
  url: "/activity",
  icon: ScrollText, // or History or ClipboardList
  resource: "reports", // gate behind reports read permission
}
```

### Top Bar

Add `activity: "Activity Log"` to `segmentLabels`.

### Page Commands

Add to `PAGE_COMMANDS`:
```typescript
{
  label: "Activity Log",
  href: "/activity",
  aliases: ["audit", "log", "history", "trail"],
  icon: "ScrollText",
  description: "View all activity across the organization",
}
```

## Entity Detail Integration

On each entity's detail page, add an "Activity" tab or section that shows a filtered view of the activity log for that specific entity. Use `getEntityActivityLog(entityType, entityId)`.

This means adding a log timeline/table to:
- Asset detail page (`/assets/registry/[id]`)
- Model detail page (`/assets/models/[id]`)
- Kit detail page (`/kits/[id]`)
- Project detail page (`/projects/[id]`)
- Client detail page (`/clients/[id]`)
- Location detail page (`/locations/[id]`)
- Maintenance detail page (`/maintenance/[id]`)
- Test tag asset detail page (`/test-and-tag/[id]`)

The per-entity log should be a compact timeline (not the full table with filters), showing timestamp, user, action badge, and summary.

## Permissions

- Viewing the activity log page requires `reports: read` permission
- Per-entity activity on detail pages follows the parent entity's `read` permission
- No separate permission resource needed

## Organization Export/Import

Add `ActivityLog` to the org export manifest in `src/lib/org-export.ts`. On import, remap `organizationId`, `userId`, `projectId`, `assetId`, `kitId` using the ID mapping tables.

## Notes

- Activity logging must NEVER block or fail the primary operation. Always wrap in try/catch.
- The `entityName` and `userName` fields are denormalized — they capture the value at the time of the action so the log remains readable even if entities are renamed or users leave.
- Don't log reads (page views, search queries). Only log writes and significant actions.
- Consider adding a cleanup/retention policy later (e.g., delete logs older than 2 years), but for now keep everything.
- The `AssetScanLog` model can remain for backward compatibility, but new scan actions should also write to `ActivityLog`. Long-term, `AssetScanLog` could be deprecated.
