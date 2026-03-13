# Feature: Multi-Warehouse / Multi-Depot (Optional)

## Summary

Extend the Location system to support multiple warehouses with independent stock levels, inter-warehouse transfers, and per-warehouse availability. This is an opt-in feature — orgs with a single warehouse continue working exactly as before. Orgs that grow to multiple depots (satellite warehouses, trucks, lock-ups) enable multi-warehouse mode and gain per-location inventory tracking, transfer workflows, and warehouse-scoped availability.

---

## Opt-In Activation

Multi-warehouse is enabled in org settings (`Organization.metadata.multiWarehouseEnabled: boolean`). When disabled (default), the system behaves exactly as it does today — assets have a single `locationId` and availability is global. When enabled:

- Assets and bulk assets track which warehouse they're physically in
- Availability checks can be scoped to a specific warehouse
- Transfers between warehouses are logged and tracked
- The warehouse page shows a depot selector

---

## Data Model

### `AssetLocation` (Stock Ledger)

Instead of relying solely on `Asset.locationId` (which is a current-state snapshot), add a proper stock ledger for multi-warehouse:

```prisma
model StockTransfer {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // What moved
  assetId         String?
  asset           Asset?   @relation(fields: [assetId], references: [id], onDelete: Cascade)
  bulkAssetId     String?
  bulkAsset       BulkAsset? @relation(fields: [bulkAssetId], references: [id], onDelete: Cascade)
  kitId           String?
  kit             Kit?     @relation(fields: [kitId], references: [id], onDelete: Cascade)
  quantity        Int      @default(1)       // For bulk assets

  // Where it moved
  fromLocationId  String?
  fromLocation    Location? @relation("TransferFrom", fields: [fromLocationId], references: [id], onDelete: SetNull)
  toLocationId    String
  toLocation      Location @relation("TransferTo", fields: [toLocationId], references: [id], onDelete: Cascade)

  // Context
  type            TransferType         // MANUAL, CHECKOUT, CHECKIN, RESTOCK, INITIAL
  status          TransferStatus       // PENDING, IN_TRANSIT, COMPLETED, CANCELLED
  projectId       String?              // If transfer is for a project checkout/checkin
  project         Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
  transferredById String
  transferredBy   User     @relation(fields: [transferredById], references: [id], onDelete: Cascade)
  notes           String?
  completedAt     DateTime?

  createdAt       DateTime @default(now())

  @@index([organizationId])
  @@index([assetId])
  @@index([bulkAssetId])
  @@index([fromLocationId])
  @@index([toLocationId])
}

enum TransferType {
  MANUAL        // User initiated transfer between warehouses
  CHECKOUT      // Moved out for a project
  CHECKIN       // Returned from a project
  RESTOCK       // New stock added to a location
  INITIAL       // Initial location assignment
}

enum TransferStatus {
  PENDING       // Transfer requested
  IN_TRANSIT    // In transit between locations
  COMPLETED     // Arrived at destination
  CANCELLED
}
```

### `BulkAssetStock` (Per-Location Quantities)

For bulk assets, track quantity per warehouse:

```prisma
model BulkAssetStock {
  id              String   @id @default(cuid())
  bulkAssetId     String
  bulkAsset       BulkAsset @relation(fields: [bulkAssetId], references: [id], onDelete: Cascade)
  locationId      String
  location        Location @relation(fields: [locationId], references: [id], onDelete: Cascade)

  quantity        Int      @default(0)
  reservedQuantity Int     @default(0)  // Allocated to projects but not yet checked out

  @@unique([bulkAssetId, locationId])
  @@index([bulkAssetId])
  @@index([locationId])
}
```

### Location Model Updates

```prisma
model Location {
  // ... existing fields ...
  isWarehouse     Boolean  @default(false)   // Only warehouse-type locations participate in stock tracking
}
```

---

## Key Behaviours

### Availability Scoped by Warehouse

When `multiWarehouseEnabled` is true, the availability engine (`computeOverbookedStatus`) gains an optional `warehouseId` parameter. This shows "5 available at Warehouse A, 2 available at Warehouse B" instead of "7 available total".

### Transfer Workflow

1. User initiates a transfer: select asset(s), source warehouse, destination warehouse
2. Transfer created with status PENDING
3. Source warehouse confirms dispatch → status IN_TRANSIT, `asset.locationId` updated to destination
4. Destination warehouse confirms receipt → status COMPLETED
5. For simple orgs: skip IN_TRANSIT, go directly PENDING → COMPLETED

### Warehouse Checkout Integration

When checking out a project from the warehouse page, the system checks which warehouse the user is operating from (via a depot selector at the top of the page). Only assets at that location appear in the available-for-checkout list. If an asset is at a different warehouse, the system suggests a transfer.

### Backward Compatibility

When `multiWarehouseEnabled` is false:
- `Asset.locationId` continues to work as today
- `BulkAssetStock` is not used — `BulkAsset.availableQuantity` is the global count
- `StockTransfer` is not created for normal checkout/checkin
- The availability engine ignores warehouse scoping
- No depot selector on warehouse page

---

## UI

### Settings Toggle

In `/settings/assets` (or a new `/settings/warehouses` page):
- "Enable multi-warehouse tracking" toggle
- When enabled, show which locations are warehouses (`isWarehouse` flag)
- Instructions for initial stock allocation

### Transfer Page (`/warehouse/transfers`)

- List of transfers: asset, from, to, status, date, user
- "New Transfer" button → select assets/bulk assets, source, destination
- Status change actions (dispatch, receive, cancel)
- Filter by warehouse, status, date range

### Depot Selector on Warehouse Page

When multi-warehouse is enabled, the warehouse page (`/warehouse`) shows a depot selector dropdown at the top. This scopes the entire warehouse view to that location.

### Asset Detail — Location History

On the asset detail page, show a "Location History" section listing all `StockTransfer` records for that asset — a full audit trail of where it's been.

---

## Server Actions

### `src/server/transfers.ts` — New

```typescript
"use server";
export async function createTransfer(data: TransferInput): Promise<StockTransfer>;
export async function updateTransferStatus(id: string, status: TransferStatus): Promise<void>;
export async function getTransfers(filters: TransferFilters): Promise<PaginatedResult<StockTransfer>>;
export async function getAssetLocationHistory(assetId: string): Promise<StockTransfer[]>;
export async function getBulkAssetStockByLocation(bulkAssetId: string): Promise<BulkAssetStock[]>;
```

---

## Implementation Phases

1. `StockTransfer` and `BulkAssetStock` models + migration
2. Org setting toggle for multi-warehouse
3. Transfer CRUD + transfer page
4. Depot selector on warehouse page
5. Per-warehouse availability in `computeOverbookedStatus`
6. Asset detail location history
7. Bulk asset per-warehouse stock view
8. Integration with checkout/checkin (auto-create transfers)
