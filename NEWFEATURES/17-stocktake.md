# Feature: Stocktake / Inventory Verification

## Summary

Add a formal stocktake workflow that lets warehouse staff verify physical inventory against the system's records. A stocktake scans what's actually on the shelf, compares it to what the system says should be there (excluding checked-out items), and highlights discrepancies — missing items, items found in the wrong location, and unexpected items. Results can be reviewed, approved, and applied to update the system.

---

## Core Concepts

### What a Stocktake Does

1. **Generates an expected list**: All assets and bulk assets the system says should be at a specific location (excluding CHECKED_OUT, LOST, and RETIRED items)
2. **User scans/counts what's actually there**: Using barcode scanning or manual entry
3. **Compares expected vs found**: Produces a discrepancy report
4. **Applies corrections**: Missing items can be flagged, found items can have locations updated, quantities adjusted

### Stocktake Scope

A stocktake can be scoped to:
- **Full warehouse**: Everything at one location
- **Category**: Only items in a specific category at a location
- **Spot check**: A selection of specific models or asset tags

---

## Data Model

```prisma
model Stocktake {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  name            String               // "Q1 2026 Full Stocktake"
  locationId      String
  location        Location @relation(fields: [locationId], references: [id], onDelete: Cascade)

  scope           StocktakeScope       // FULL, CATEGORY, SPOT_CHECK
  categoryId      String?              // If scope = CATEGORY
  status          StocktakeStatus      // DRAFT, IN_PROGRESS, REVIEWING, COMPLETED, CANCELLED

  startedAt       DateTime?
  startedById     String?
  startedBy       User?    @relation("StocktakeStarted", fields: [startedById], references: [id], onDelete: SetNull)
  completedAt     DateTime?
  reviewedById    String?
  reviewedBy      User?    @relation("StocktakeReviewed", fields: [reviewedById], references: [id], onDelete: SetNull)

  // Summary stats (computed after completion)
  expectedCount   Int      @default(0)
  foundCount      Int      @default(0)
  missingCount    Int      @default(0)
  unexpectedCount Int      @default(0)
  discrepancyCount Int     @default(0)

  notes           String?
  items           StocktakeItem[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([organizationId])
  @@index([locationId])
}

model StocktakeItem {
  id              String   @id @default(cuid())
  stocktakeId     String
  stocktake       Stocktake @relation(fields: [stocktakeId], references: [id], onDelete: Cascade)

  // What was expected / found
  assetId         String?
  asset           Asset?   @relation(fields: [assetId], references: [id], onDelete: SetNull)
  bulkAssetId     String?
  bulkAsset       BulkAsset? @relation(fields: [bulkAssetId], references: [id], onDelete: SetNull)

  // Expected state (snapshot at stocktake start)
  expectedAtLocation Boolean @default(true)  // System says it should be here
  expectedQuantity   Int    @default(1)       // For bulk assets

  // Actual state (from scanning/counting)
  found           Boolean  @default(false)    // Was it scanned/counted?
  foundQuantity   Int      @default(0)        // For bulk assets: how many counted
  scannedAt       DateTime?
  scannedById     String?

  // Result
  result          StocktakeItemResult  // MATCH, MISSING, UNEXPECTED, QUANTITY_MISMATCH, WRONG_LOCATION
  conditionNote   String?              // "Damaged cable", "Missing power cord"
  actionTaken     String?              // "Marked as LOST", "Location updated", "No action"

  @@index([stocktakeId])
  @@index([assetId])
  @@index([bulkAssetId])
}

enum StocktakeScope {
  FULL
  CATEGORY
  SPOT_CHECK
}

enum StocktakeStatus {
  DRAFT         // Created, not started
  IN_PROGRESS   // Scanning/counting underway
  REVIEWING     // Scanning complete, reviewing discrepancies
  COMPLETED     // Discrepancies resolved, applied
  CANCELLED
}

enum StocktakeItemResult {
  MATCH              // Found where expected, correct quantity
  MISSING            // Expected but not found
  UNEXPECTED         // Found but not expected at this location
  QUANTITY_MISMATCH  // Bulk asset: counted ≠ expected
  WRONG_LOCATION     // Asset expected elsewhere but found here
}
```

---

## Workflow

### 1. Create Stocktake

Admin creates a stocktake: name, location, scope. Status = DRAFT. The system generates `StocktakeItem` records for every asset/bulk asset expected at that location.

### 2. Scan / Count (IN_PROGRESS)

Warehouse staff open the stocktake on their device (mobile optimised). They scan barcodes or manually check off items. Each scan:
- Looks up the asset by tag
- If the asset is in the expected list → marks `found = true`, result = MATCH
- If the asset is NOT in the expected list (e.g. it's supposed to be at a different location, or it's checked out) → marks as UNEXPECTED or WRONG_LOCATION
- For bulk assets: enter a counted quantity

The scanning UI uses the existing `BarcodeScanner` component in continuous mode, with a running tally: "142 of 380 scanned".

### 3. Review Discrepancies (REVIEWING)

After scanning is complete, the stocktake moves to review. A discrepancy report shows:
- **Missing**: expected but not scanned (result = MISSING)
- **Unexpected**: scanned but not expected (result = UNEXPECTED)
- **Quantity mismatches**: bulk asset counts differ
- **Wrong location**: asset found here but system says it's elsewhere

For each discrepancy, the reviewer can:
- **Mark as LOST**: updates asset status to LOST
- **Update location**: moves the asset to this location in the system
- **Adjust quantity**: updates bulk asset quantity
- **Ignore**: no system change, just acknowledged
- **Add note**: describe what happened

### 4. Apply & Complete

Reviewer applies all corrections in bulk. The stocktake moves to COMPLETED. Summary stats are computed and stored.

---

## UI

### Route: `/warehouse/stocktake`

| Path | Description |
|------|-------------|
| `/warehouse/stocktake` | Stocktake list (past and active) |
| `/warehouse/stocktake/new` | Create new stocktake |
| `/warehouse/stocktake/[id]` | Stocktake detail — scanning view during IN_PROGRESS, review view during REVIEWING, summary when COMPLETED |

### Scanning View

Mobile-optimised full-screen scanning interface:
- Large camera viewfinder for barcode scanning
- Running tally: "142 / 380 scanned"
- Recently scanned items list (last 10)
- Manual entry fallback (type asset tag)
- "Found unexpected item" indicator when scanning something not on the list
- Pause/resume capability

### Review View

Table of discrepancies with bulk action buttons:
- Filter by result type (MISSING, UNEXPECTED, etc.)
- Batch "Mark all missing as LOST" action
- Per-item action dropdowns
- Summary cards at the top (total expected, found, missing, unexpected)

---

## Integration Points

- **Multi-warehouse**: Stocktake scoped to a specific warehouse location. If multi-warehouse is enabled, the expected list only includes items at that depot.
- **Activity log**: Log stocktake creation, completion, and all corrections applied
- **Reports**: Add a "Stocktake History" report showing accuracy rates over time
- **Notifications**: "Stocktake found X missing items" notification to admins
- **Pre-preps**: Items in pre-prep containers are expected at the warehouse (they're not checked out yet) — the stocktake should account for pre-prepped items

---

## Server Actions

### `src/server/stocktake.ts`

```typescript
"use server";
export async function createStocktake(data: CreateStocktakeInput): Promise<Stocktake>;
export async function startStocktake(id: string): Promise<void>;  // Generate expected items, set IN_PROGRESS
export async function scanStocktakeItem(stocktakeId: string, assetTag: string): Promise<StocktakeItem>;
export async function updateBulkCount(itemId: string, quantity: number): Promise<void>;
export async function completeScanning(id: string): Promise<void>;  // Move to REVIEWING
export async function resolveDiscrepancy(itemId: string, action: DiscrepancyAction): Promise<void>;
export async function bulkResolveDiscrepancies(stocktakeId: string, action: BulkAction): Promise<void>;
export async function completeStocktake(id: string): Promise<void>;  // Apply corrections, compute stats
export async function getStocktakes(filters?: StocktakeFilters): Promise<PaginatedResult<Stocktake>>;
export async function getStocktakeById(id: string): Promise<Stocktake>;
export async function getStocktakeDiscrepancies(id: string): Promise<StocktakeItem[]>;
```

---

## Implementation Phases

1. `Stocktake` and `StocktakeItem` models + migration
2. Create stocktake + generate expected items
3. Scanning UI with barcode scanner integration
4. Discrepancy detection and review view
5. Correction actions (mark lost, update location, adjust quantity)
6. Summary stats and completion
7. Stocktake list page and history
8. Reports integration and notifications
