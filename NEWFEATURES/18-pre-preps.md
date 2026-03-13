# Feature: Pre-Preps & Warehouse Staging

## Summary

Allow warehouse staff to pre-allocate assets into physical cases and containers before a project's checkout day. A prep container (which may itself be a tracked asset — a pelican case, road case, rack, etc.) holds a set of pre-packed assets. When the container is scanned at checkout, all its contents are automatically checked out in one go. Preps can be temporary (unpacked after the project returns) or semi-permanent (a rack that stays built between jobs). This dramatically speeds up warehouse dispatch and reduces errors.

---

## Core Concepts

### What's a Prep?

A prep is a staging record that says "these assets are currently packed inside this container, ready for this project." It's the bridge between the pull sheet (what needs to go out) and the checkout scan (what actually leaves the warehouse).

### Container = Asset

The container itself is often a tracked asset in GearFlow — a pelican case (`TTP-00150`), a road case (`TTP-00201`), a 19" rack (`TTP-00089`). When the container is an asset, scanning it at checkout checks out BOTH the container asset AND all the assets packed inside it.

Containers can also be unnamed/untracked (a generic cardboard box, a pallet). In this case, the prep still groups the assets but there's no container asset to scan — the prep is checked out by scanning any item inside it or by a "check out entire prep" button.

### Prep Lifecycle

```
CREATE → PACKING → PACKED → CHECKED_OUT → RETURNED → UNPACKED
```

1. **CREATE**: Warehouse staff creates a prep for a project, optionally linking a container asset
2. **PACKING**: Staff scan assets into the prep (removing them from the shelf, placing them in the case)
3. **PACKED**: All items are in the container, ready to go. The prep is sealed.
4. **CHECKED_OUT**: The prep (and all its contents) are checked out to the project
5. **RETURNED**: The project comes back, the container is checked in
6. **UNPACKED**: Contents are verified and returned to shelf locations (or packed into the next prep)

---

## Data Model

### `Prep`

```prisma
model Prep {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  projectId       String
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // Container (optional — may be a tracked asset)
  name            String               // "FOH Rack", "Mic Case A", "Cable Box 3"
  containerAssetId String?             // If the case/rack is a tracked asset
  containerAsset  Asset?   @relation("PrepContainer", fields: [containerAssetId], references: [id], onDelete: SetNull)

  status          PrepStatus
  isPermanent     Boolean  @default(false)  // Semi-permanent preps (racks) don't unpack between jobs

  // Metadata
  notes           String?
  preparedById    String?
  preparedBy      User?    @relation(fields: [preparedById], references: [id], onDelete: SetNull)
  preparedAt      DateTime?
  checkedOutAt    DateTime?
  returnedAt      DateTime?
  unpackedAt      DateTime?

  items           PrepItem[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([organizationId])
  @@index([projectId])
  @@index([containerAssetId])
}

model PrepItem {
  id              String   @id @default(cuid())
  prepId          String
  prep            Prep     @relation(fields: [prepId], references: [id], onDelete: Cascade)

  // What's in the container (one of these is set)
  assetId         String?
  asset           Asset?   @relation(fields: [assetId], references: [id], onDelete: SetNull)
  bulkAssetId     String?
  bulkAsset       BulkAsset? @relation(fields: [bulkAssetId], references: [id], onDelete: SetNull)
  quantity        Int      @default(1)       // For bulk assets

  // Which line item this fulfils (optional — links prep to the project's equipment list)
  lineItemId      String?
  lineItem        ProjectLineItem? @relation(fields: [lineItemId], references: [id], onDelete: SetNull)

  // Tracking
  addedAt         DateTime @default(now())
  addedById       String?
  addedBy         User?    @relation(fields: [addedById], references: [id], onDelete: SetNull)
  sortOrder       Int      @default(0)

  @@unique([prepId, assetId])           // Each asset in at most one prep
  @@index([prepId])
  @@index([assetId])
}

enum PrepStatus {
  PACKING         // Staff are adding items
  PACKED          // Ready to go
  CHECKED_OUT     // Out on a project
  RETURNED        // Back from project
  UNPACKED        // Contents returned to shelf
  CANCELLED
}
```

---

## Key Behaviours

### Scanning Assets Into a Prep

1. Staff opens/creates a prep for a project
2. Scans an asset barcode → `PrepItem` created, asset logically "in the container"
3. The system validates: asset is AVAILABLE, belongs to the org, matches a line item on the project (warn if not)
4. Asset status stays AVAILABLE (it hasn't left the warehouse yet) but gains a visual "prepped" indicator
5. Bulk assets: enter a quantity being packed

### Container Scan at Checkout

When the container asset is scanned during warehouse checkout:
1. System detects it's a prep container (`containerAssetId` match)
2. Loads all `PrepItem` records for this prep
3. Checks out the container asset AND all prep items in one atomic transaction
4. Each `PrepItem.assetId` → matched to a `ProjectLineItem` → `checkOutItems` called
5. Prep status → CHECKED_OUT
6. This replaces scanning 20 individual items — one scan does them all

### Non-Asset Containers

If the prep has no `containerAssetId` (generic box/pallet):
- The prep appears in the warehouse checkout view as a group
- A "Check Out Prep" button checks out all items at once
- Or scanning any individual item inside the prep offers to "check out entire prep"

### Check-In and Unpacking

On return:
1. Scanning the container checks in all prep contents
2. Prep status → RETURNED
3. Staff can then unpack: verify each item is present and in good condition
4. "Unpack All" marks everything as back on the shelf, prep → UNPACKED
5. Damaged/missing items are flagged during unpacking (same condition flow as normal check-in)

### Semi-Permanent Preps (`isPermanent`)

Some containers stay built between jobs (a FOH rack with a console, DI boxes, and cabling). These preps:
- Don't get unpacked after return — they go back to PACKED status
- Can be re-assigned to a different project
- Their contents are "always in the container" until explicitly removed
- Show as a reusable prep in the warehouse prep list

### Prep vs Kit

Preps and kits are related but different:

| | Kit | Prep |
|---|---|---|
| **Purpose** | Permanent grouping of assets that travel together | Temporary project-specific packing |
| **Lifecycle** | Created once, reused across projects | Created per project, unpacked after |
| **Contents** | Fixed (add/remove changes the kit definition) | Dynamic (packed for one job) |
| **Container** | The kit IS the container (has its own asset tag) | Container is optional, may be any asset |
| **Checkout** | Kit checked out as a unit via `checkOutKit` | Prep checked out by scanning container |
| **On documents** | Shows as a kit line item with children | Individual items show on pull sheet |

A kit CAN be placed inside a prep (e.g. a drum mic kit packed into a road case alongside other items). The kit is one of the prep's items.

---

## UI

### Warehouse Page — Preps Tab

Add a "Preps" tab to the project warehouse view (`/warehouse/[projectId]`):

- List of preps for this project with status badges
- "New Prep" button → name the prep, optionally select a container asset
- Each prep card shows: container name, item count, status, "Open" button
- Status action buttons (Mark as Packed, Check Out Prep, Mark as Returned, Unpack)

### Prep Detail View

Click into a prep to see:
- Container info (asset tag, name, photo if available)
- Contents list: asset tag, model name, linked line item
- Barcode scanner (continuous mode) for adding items
- Remove button per item
- "Check Out All" button (when at PACKED status)

### Pull Sheet Integration

The pull sheet (packing list) should show which items are already prepped:
- Items in a prep show a "Prepped in [Container Name]" badge
- Items not yet prepped show as "Not prepped" — clear signal of what still needs packing
- Group the pull sheet by prep container when preps exist

### Prep Indicator on Asset Detail

On an asset's detail page, if the asset is currently in a prep, show: "Currently in prep: [Prep Name] for [Project Name]"

---

## Integration Points

- **Warehouse checkout** (`src/server/warehouse.ts`): `lookupAssetForScan` detects prep containers and offers bulk checkout. `checkOutItems` handles prep items atomically.
- **Stocktake**: Items in preps are at the warehouse (not checked out) — stocktake should list them as expected, possibly grouped under their container.
- **Multi-warehouse**: Preps are at a specific warehouse location (the container's location). Transferring a prep container transfers all its contents.
- **Activity log**: Log prep creation, item additions/removals, checkout, return, unpack.
- **Pull sheet PDF**: Add prep container grouping.

---

## Server Actions

### `src/server/preps.ts`

```typescript
"use server";
export async function createPrep(data: CreatePrepInput): Promise<Prep>;
export async function updatePrep(id: string, data: UpdatePrepInput): Promise<Prep>;
export async function deletePrep(id: string): Promise<void>;
export async function getProjectPreps(projectId: string): Promise<Prep[]>;
export async function getPrepById(id: string): Promise<Prep>;

// Packing
export async function addPrepItem(prepId: string, assetTag: string): Promise<PrepItem>;
export async function addBulkPrepItem(prepId: string, bulkAssetId: string, quantity: number): Promise<PrepItem>;
export async function removePrepItem(itemId: string): Promise<void>;
export async function markPrepPacked(id: string): Promise<void>;

// Checkout/checkin via prep
export async function checkOutPrep(prepId: string): Promise<void>;  // Atomic: checks out container + all items
export async function checkInPrep(prepId: string, conditions?: PrepItemCondition[]): Promise<void>;
export async function unpackPrep(id: string): Promise<void>;

// Lookup
export async function lookupPrepByContainerScan(assetTag: string, projectId: string): Promise<Prep | null>;
```

---

## Implementation Phases

1. `Prep` and `PrepItem` models + migration
2. Prep CRUD + packing UI with barcode scanner
3. Container scan detection in `lookupAssetForScan`
4. Atomic prep checkout in warehouse
5. Prep check-in and unpacking workflow
6. Pull sheet prep grouping
7. Semi-permanent preps
8. Stocktake integration (preps at warehouse)
9. Multi-warehouse transfer of preps
