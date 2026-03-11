# Extension Prompt — Test and Tag System (AS/NZS 3760:2022 Compliance)

## Context

This is an extension to the existing GearFlow asset/rental management platform. The core system already has a basic `MaintenanceRecord` model with a `TEST_AND_TAG` type, plus `testAndTagIntervalDays`, `lastTestAndTagDate`, and `nextTestAndTagDate` fields on models and assets. This prompt replaces that basic approach with a **fully fledged, standalone Test and Tag module** — a dedicated dashboard, its own asset registry (including standalone items for bulk assets like extension leads), full test recording per AS/NZS 3760:2022, and a quick-scan workflow for efficient batch testing.

---

## Why This Needs Its Own System

In the AV/theatre industry, test and tag isn't just a nice-to-have — it's a compliance obligation. Every piece of electrical equipment that gets plugged in on a job site needs a current test tag. Rental and hire equipment falls under the strictest interval in the standard (every 3 months). The existing maintenance record approach doesn't cut it because:

- **Bulk assets need individual test IDs.** You might have 50x 5m extension leads tracked as a single bulk asset. But each physical lead needs its own test tag with a unique ID, a test date, a result, and a next-due date. The existing bulk asset system has no concept of individual unit tracking.
- **Test records need structured data.** A test and tag record isn't just "pass/fail" — it includes visual inspection results, earth continuity readings, insulation resistance readings, leakage current readings, equipment class, and tester identification. The generic maintenance record can't capture this.
- **There needs to be a clear "what's due" workflow.** Techs need a dashboard showing what's overdue, what's due this week, and what's coming up — then blast through them with a scanner.

---

## Data Model

### New Model: `TestTagAsset`

This is the test and tag registry — every item that needs test and tag gets a record here. This can be linked to an existing serialized asset, an existing bulk asset (representing one physical unit from the bulk pool), or be completely standalone.

```
TestTagAsset
- id                      String (cuid)
- organizationId          String → Organization
- testTagId               String (unique within org — the ID printed on the physical tag, e.g., "TTP-TT-0001")
- description             String (what this item is, e.g., "5m Extension Lead", "Shure SM58 #001")
- equipmentClass          Enum: CLASS_I, CLASS_II, CLASS_II_DOUBLE_INSULATED
- applianceType           Enum: APPLIANCE, CORD_SET, EXTENSION_LEAD, POWER_BOARD, RCD_PORTABLE, RCD_FIXED, THREE_PHASE, OTHER
- make                    String? (manufacturer)
- modelName               String? (model/product name)
- serialNumber            String? (manufacturer serial)
- location                String? (where the item is normally stored/used)
- testIntervalMonths      Int (default from org settings, e.g., 3 for hire equipment)
- status                  Enum: CURRENT, DUE_SOON, OVERDUE, FAILED, RETIRED, NOT_YET_TESTED
- lastTestDate            DateTime?
- nextDueDate             DateTime?
- notes                   String?

// Links to existing GearFlow assets (nullable — only one should be set)
- assetId                 String? → Asset (link to a serialized asset)
- bulkAssetId             String? → BulkAsset (link to which bulk asset type this unit comes from)

- isActive                Boolean (default true — soft delete)
- createdAt               DateTime
- updatedAt               DateTime

// Relations
- testRecords             TestTagRecord[]

// Constraints
// @@unique([organizationId, testTagId])
// @@index([organizationId, status])
// @@index([organizationId, nextDueDate])
// @@index([organizationId, assetId])
// @@index([organizationId, bulkAssetId])
```

**Key design decisions:**

- `testTagId` is the human-readable ID that goes on the physical tag sticker. It follows an auto-increment pattern similar to asset tags (e.g., `TTP-TT-0001`). The org settings should store a `testTagPrefix`, `testTagDigits`, and `testTagCounter` just like asset tags.
- `assetId` links to an existing serialized asset when this T&T item corresponds to a tracked asset. This creates a two-way connection — the asset detail page can show its T&T status, and the T&T module can show which asset it relates to.
- `bulkAssetId` links to the bulk asset type (e.g., "5m Extension Lead") but does NOT represent a specific unit from the bulk pool. It's a reference saying "this T&T item is one of those." The T&T system gives it individual identity that the bulk system doesn't provide.
- An item with neither `assetId` nor `bulkAssetId` set is a standalone T&T item — something that needs testing but isn't tracked in the main asset registry (e.g., a personal tool, a venue-supplied item, a kettle in the workshop).

### New Model: `TestTagRecord`

A single test event for one item. Every time equipment is tested, a new record is created.

```
TestTagRecord
- id                      String (cuid)
- organizationId          String → Organization
- testTagAssetId          String → TestTagAsset
- testDate                DateTime
- testedBy                String → User
- testerName              String (free text — the name printed on the tag, in case it's an external tester)

// Overall result
- result                  Enum: PASS, FAIL

// Visual inspection (per AS/NZS 3760:2022 Section 4)
- visualInspectionResult  Enum: PASS, FAIL
- visualCordCondition     Boolean? (cord/cable free from damage, cuts, abrasion, tape repairs)
- visualPlugCondition     Boolean? (plug undamaged, pins not bent/discoloured, insulated pins intact)
- visualHousingCondition  Boolean? (housing/casing free from cracks, dents, damage, discolouration)
- visualSwitchCondition   Boolean? (switches/controls secure, operational, correctly labelled)
- visualVentsUnobstructed Boolean? (ventilation openings clear and unblocked)
- visualCordGrip          Boolean? (cord grip/strain relief secure at plug and appliance end)
- visualEarthPin          Boolean? (earth pin present and intact — Class I only)
- visualMarkingsLegible   Boolean? (rating plate/markings legible, warning labels intact on EPODs)
- visualNoModifications   Boolean? (no unauthorised modifications or non-standard joints)
- visualNotes             String? (free text notes on visual findings)

// Electrical tests
- equipmentClassTested    Enum: CLASS_I, CLASS_II (what class was it tested as)
- testMethod              Enum: INSULATION_RESISTANCE, LEAKAGE_CURRENT, BOTH (which electrical test method was used)

// Earth continuity test (Class I only)
- earthContinuityResult   Enum: PASS, FAIL, NOT_APPLICABLE
- earthContinuityReading  Float? (resistance in ohms — pass limit is < 1.0 ohm)

// Insulation resistance test (500V DC)
- insulationResult        Enum: PASS, FAIL, NOT_APPLICABLE
- insulationReading       Float? (resistance in megaohms — pass limit is >= 1.0 megaohm)
- insulationTestVoltage   Int? (test voltage used, typically 500 or 250 for sensitive equipment)

// Leakage current test (at operating voltage)
- leakageCurrentResult    Enum: PASS, FAIL, NOT_APPLICABLE
- leakageCurrentReading   Float? (leakage in milliamps — Class I limit 5mA, Class II limit 1mA)

// Polarity test (for cord sets, extension leads, power boards)
- polarityResult          Enum: PASS, FAIL, NOT_APPLICABLE

// RCD test (for portable RCDs)
- rcdTripTimeResult       Enum: PASS, FAIL, NOT_APPLICABLE
- rcdTripTimeReading      Float? (trip time in milliseconds — <= 300ms for Type II, <= 40ms for Type I at rated current)

// Functional test
- functionalTestResult    Enum: PASS, FAIL, NOT_APPLICABLE
- functionalTestNotes     String?

// Actions taken
- failureAction           Enum: NONE, REPAIRED, REMOVED_FROM_SERVICE, DISPOSED, REFERRED_TO_ELECTRICIAN
- failureNotes            String? (what was wrong, what action was taken)

// Next test
- nextDueDate             DateTime (calculated from testDate + interval, or manually overridden)

- createdAt               DateTime
- updatedAt               DateTime

// Constraints
// @@index([organizationId, testTagAssetId])
// @@index([organizationId, testDate])
```

### New Model: `TestTagSettings` (stored in Organization metadata JSON)

Rather than a separate table, store these in the org's existing metadata/settings JSON:

```json
{
  "testTag": {
    "prefix": "TTP-TT",
    "digits": 4,
    "counter": 0,
    "defaultIntervalMonths": 3,
    "defaultEquipmentClass": "CLASS_I",
    "dueSoonThresholdDays": 14,
    "companyName": "Two Toned Productions",
    "defaultTesterName": "John Smith",
    "defaultTestMethod": "INSULATION_RESISTANCE"
  }
}
```

### Modifications to Existing Models

#### Asset (Serialized)

Add a convenience relation (no schema change needed if using Prisma relation mapping):
```
- testTagAsset            TestTagAsset? (one-to-one via testTagAsset.assetId)
```

This lets the asset detail page show the T&T status directly: "Last tested: 15/01/2026 — Next due: 15/04/2026 — CURRENT."

#### BulkAsset

Add a convenience relation:
```
- testTagAssets           TestTagAsset[] (one-to-many via testTagAsset.bulkAssetId)
```

This lets the bulk asset detail page show: "This bulk asset has 50 individual T&T items. 48 current, 1 due soon, 1 overdue."

#### Model

The existing `testAndTagIntervalDays` field remains useful — it sets the default interval when creating T&T items for assets of this model. No changes needed, but the T&T system should read from it when auto-populating.

#### MaintenanceRecord

The existing `TEST_AND_TAG` maintenance type can remain for backwards compatibility but new T&T activity should go through the dedicated `TestTagRecord` system. Do not create maintenance records for T&T going forward — the `TestTagRecord` is the source of truth.

---

## Auto-Incrementing Test Tag IDs

Follow the same pattern as asset tags:

- `peekNextTestTagIds(count)` — read-only preview for forms, no counter increment
- `reserveTestTagIds(count)` — atomically increment counter, called after successful creation
- Org settings store `testTagPrefix`, `testTagDigits`, `testTagCounter`
- Users can override the suggested ID when creating a T&T item (e.g., if they're importing existing tagged items with their own numbering)

---

## Behaviour & Business Logic

### Creating Test Tag Assets

There are three entry points for creating a T&T item:

**1. From a serialized asset:**
- On the asset detail page, add a "Set up Test & Tag" action (only shown if the asset's model has `testAndTagIntervalDays > 0` or if the user manually triggers it)
- Auto-populates: description from model name + asset tag, make from manufacturer, model from model number, serial number from asset, equipment class from model (or user selects), interval from model's `testAndTagIntervalDays` (converted to months)
- Sets `assetId` to link back to the asset
- Generates a `testTagId` automatically

**2. From a bulk asset (batch creation):**
- On the bulk asset detail page, add a "Set up Test & Tag" action
- User specifies how many individual T&T items to create (e.g., "Create 50 T&T items for 5m Extension Leads")
- Each item gets its own unique `testTagId` (auto-incremented sequentially)
- All items share: description, make, model, interval, equipment class, `bulkAssetId`
- Status starts as `NOT_YET_TESTED` for all

**3. Standalone creation (from the T&T dashboard):**
- "Add New Item" form where the user fills in everything manually
- Optionally search and link to an existing asset or bulk asset
- Used for items not in the main asset registry

### Test Tag Status Calculation

Status is **computed from `nextDueDate`** and recalculated whenever a test record is saved:

| Status | Condition |
|---|---|
| `NOT_YET_TESTED` | No test records exist |
| `CURRENT` | `nextDueDate` is in the future and more than `dueSoonThresholdDays` away |
| `DUE_SOON` | `nextDueDate` is within `dueSoonThresholdDays` of today |
| `OVERDUE` | `nextDueDate` is in the past |
| `FAILED` | Most recent test record has `result: FAIL` |
| `RETIRED` | Manually set — item is no longer in service |

When a new `TestTagRecord` is saved with `result: PASS`:
1. Set `lastTestDate` = record's `testDate`
2. Set `nextDueDate` = record's `nextDueDate` (calculated as `testDate + testIntervalMonths`, but can be overridden)
3. Recalculate `status`

When a new `TestTagRecord` is saved with `result: FAIL`:
1. Set `lastTestDate` = record's `testDate`
2. Set `status` = `FAILED`
3. `nextDueDate` stays as-is (the item needs to be retested after repair)

### Interaction with Asset Checkout

When checking out a serialized asset on a project, if the linked `TestTagAsset` has status `OVERDUE` or `FAILED`:
- Show a **warning** (not a hard block by default): "Asset TTP-AUD-001 has an overdue test & tag (was due 15/12/2025). Proceed anyway?"
- Make this configurable in org settings: `testTagCheckoutPolicy` — `WARN` (default) or `BLOCK`
- Log that the warning was acknowledged or that checkout was blocked

---

## Test and Tag Dashboard

### Route: `src/app/(app)/test-and-tag/page.tsx`

The main T&T dashboard. This is the primary interface for the person doing the testing.

#### Dashboard Header Stats

Show at a glance:
- **Total items** in the T&T registry
- **Overdue** count (red)
- **Due soon** count (within threshold, amber)
- **Current** count (green)
- **Failed** count (red, separate from overdue)
- **Not yet tested** count

#### Dashboard Sections

**1. Overdue Items (top priority)**
- Table of all items where `nextDueDate < today`
- Sorted by how overdue they are (most overdue first)
- Columns: Test Tag ID, Description, Equipment Class, Last Tested, Due Date, Days Overdue, Linked Asset
- Row action: "Test Now" — opens the quick test form pre-populated with this item

**2. Due Soon**
- Items where `nextDueDate` is within the `dueSoonThresholdDays` window
- Same columns as overdue
- Helps plan upcoming testing sessions

**3. Recently Tested**
- Last 20 test records, most recent first
- Columns: Test Tag ID, Description, Test Date, Result (pass/fail badge), Tested By

**4. Quick Actions**
- "Quick Test Mode" button — enters the scan-and-test workflow (see below)
- "Add New Item" button
- "Batch Create from Bulk Asset" button
- "Export T&T Report" button (CSV/PDF export of all items with current status)

### Route: `src/app/(app)/test-and-tag/registry/page.tsx`

Full registry/list of all T&T items with search, filter, and sort.

- Search by: test tag ID, description, serial number, make, model
- Filter by: status (CURRENT, DUE_SOON, OVERDUE, FAILED, NOT_YET_TESTED, RETIRED), equipment class, appliance type, linked asset type (serialized, bulk, standalone)
- Sort by: test tag ID, description, next due date, last test date, status
- Bulk actions: retire selected, export selected, batch test selected (enters quick mode with a pre-loaded list)

### Route: `src/app/(app)/test-and-tag/[id]/page.tsx`

Detail page for a single T&T item.

- **Header:** Test tag ID, description, status badge, equipment class badge, appliance type
- **Details card:** Make, model, serial number, location, test interval, linked asset (clickable link to asset detail page if linked)
- **Test History tab:** Chronological list of all test records for this item. Each record expandable to show full test details (visual inspection items, readings, notes). Most recent at top.
- **Actions:** "Record New Test", "Edit Item", "Retire Item", "Print Tag Label"

---

## Quick Test Mode

### Route: `src/app/(app)/test-and-tag/quick-test/page.tsx`

This is the core workflow for efficiently testing a batch of items. A tech sits at a bench with their PAT tester, a pile of gear, and a phone/tablet/laptop running this page.

#### Flow

1. **Enter/scan a test tag ID** — text input with auto-focus. Supports barcode scanner input (which acts like fast keyboard typing followed by Enter) or manual keyboard entry.

2. **System looks up the item:**
   - **Found, existing item:** Pre-populates the test form with the item's details (description, class, last test info). Shows the last test results for reference.
   - **Not found:** Prompt to create a new T&T item with this ID. Show a quick creation form (description, class, appliance type, link to asset). After creation, proceed to the test form.

3. **Record the test:**
   - Pre-populate defaults from org settings (tester name, test method, test date = now)
   - **Visual inspection section:** Quick pass/fail toggles for each visual check item. "Pass All Visual" shortcut button that ticks all to pass.
   - **Electrical test section:** Based on equipment class:
     - **Class I:** Earth continuity (reading in ohms), insulation resistance or leakage current (based on test method), polarity (if cord/lead/power board)
     - **Class II:** Insulation resistance or leakage current only
     - **RCD:** Trip time test
   - **Overall result:** Auto-calculated from individual results (if any sub-test fails, overall = FAIL). Can be manually overridden.
   - **If FAIL:** Show failure action field (repaired, removed from service, disposed, referred to electrician) and notes field

4. **Save and move to next item:**
   - On save, update the `TestTagAsset` record (lastTestDate, nextDueDate, status)
   - Clear the scan input and auto-focus it for the next item
   - Show a brief success toast ("TTP-TT-0042 — PASS — Next due 11/06/2026")
   - Play an audible beep: success sound for pass, error/alert sound for fail
   - The scanned item appears in a "Session Log" panel at the bottom showing all items tested in this session

#### Quick Test UI Layout

```
┌────────────────────────────────────────────────────────────────┐
│  QUICK TEST MODE                              [Exit Quick Test] │
│                                                                 │
│  ┌──────────────────────────────────────────┐                  │
│  │  Scan or enter Test Tag ID: [__________] │  ← auto-focus    │
│  └──────────────────────────────────────────┘                  │
│                                                                 │
│  ┌─ Item Details ──────────────────────────────────────────┐   │
│  │ TTP-TT-0042  |  5m Extension Lead  |  Class I  |  Cord │   │
│  │ Last tested: 11/12/2025  |  Status: DUE SOON           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ Visual Inspection ─────────────────────────────────────┐   │
│  │  [Pass All Visual]                                      │   │
│  │  ☑ Cord condition    ☑ Plug condition   ☑ Housing       │   │
│  │  ☑ Switches          ☑ Vents            ☑ Cord grip     │   │
│  │  ☑ Earth pin         ☑ Markings         ☑ No mods       │   │
│  │  Visual notes: [________________________________]       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ Electrical Tests ──────────────────────────────────────┐   │
│  │  Earth continuity:    [0.05] Ω    ✅ PASS (< 1.0 Ω)   │   │
│  │  Insulation resistance: [>999] MΩ  ✅ PASS (≥ 1.0 MΩ)  │   │
│  │  Polarity:            PASS ○ FAIL ○ N/A ●              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Overall: ✅ PASS          [Save & Next]  [Save as Fail]       │
│                                                                 │
│  ┌─ Session Log (12 items tested) ─────────────────────────┐   │
│  │ TTP-TT-0041  5m Ext Lead         PASS  11/03/2026      │   │
│  │ TTP-TT-0040  5m Ext Lead         PASS  11/03/2026      │   │
│  │ TTP-TT-0039  Power Board 4-way   PASS  11/03/2026      │   │
│  │ TTP-TT-0038  SM58 Mic            FAIL  11/03/2026      │   │
│  │ ...                                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

#### Quick Test Keyboard Shortcuts

For efficiency when testing dozens of items:
- `Enter` in the scan field → look up item
- `Ctrl+Shift+P` → "Pass All Visual" shortcut
- `Tab` through electrical test fields to enter readings
- `Ctrl+Enter` → Save & Next (pass)
- `Ctrl+Shift+F` → Save as Fail

#### Quick Test Session Summary

When exiting quick test mode, show a session summary:
- Total items tested
- Pass count / Fail count
- List of failed items with failure notes
- Option to export session as a PDF report or CSV

---

## Test Record Detail — Electrical Test Reference

The system should display contextual pass/fail limits based on equipment class and test type. These are the key limits per AS/NZS 3760:2022:

### Earth Continuity (Class I only)
- Test current: 200mA DC for 5 seconds
- **Pass:** resistance < 1.0 ohm between earth pin and accessible metal parts
- For extension leads/power boards: < 1.0 ohm between plug earth pin and socket earth contact

### Insulation Resistance (500V DC)
- **Pass:** ≥ 1.0 megaohm (MΩ) for Class I and Class II
- For equipment with MOVs/EMI suppression: test at 250V DC if the item fails at 500V due to surge protection components
- For heating elements with mineral insulation: pass limit is ≥ 0.01 MΩ (10,000 Ω)

### Leakage Current (at operating voltage, 230V AC)
- **Class I:** pass limit ≤ 5mA (earth leakage)
- **Class II:** pass limit ≤ 1mA (touch current)

### Polarity (cord sets, extension leads, power boards)
- Active, neutral, and earth conductors are correctly wired to their respective pins/sockets
- **Pass/Fail** — no numeric reading

### RCD Trip Time
- **Type I (≤ 10mA rated):** must trip in ≤ 40ms
- **Type II (> 10mA rated):** must trip in ≤ 300ms
- Push-button test: must trip when pressed

The UI should show these limits alongside the input fields so the tester knows what they're aiming for. Auto-calculate pass/fail from the entered reading where possible.

---

## Test Intervals (AS/NZS 3760:2022 Table 2.4)

The system should have a reference table and use it to suggest default intervals when creating T&T items:

| Environment / Use | Interval |
|---|---|
| Hire or rental equipment | 3 months |
| Factories, workshops, warehouses | 6 months |
| Equipment subject to flexing, abuse, or hostile environments | 12 months |
| Portable office equipment (not hostile) | 12 months |
| Residential/accommodation settings | 2 years |
| Static equipment, not subject to abuse, not hostile | 5 years |
| After repair or service affecting electrical safety | Before return to service |

For GearFlow's use case (AV rental company), the default should be **3 months** since all equipment is hire/rental gear. But allow overriding per item.

---

## Reports, Exports & PDF Generation

### Route: `src/app/(app)/test-and-tag/reports/page.tsx`

A dedicated reports page accessible from the sidebar. This is the single entry point for generating any T&T report as either a PDF or CSV. The page shows a grid of available report types, each with a card describing what it produces. Clicking a report card opens a configuration panel where the user sets filters before generating.

### Universal Report Filters

Every report should accept a standard set of filters (not all apply to every report — show only the relevant ones):

```typescript
interface ReportFilters {
  dateFrom?: Date;               // Filter test records from this date
  dateTo?: Date;                 // Filter test records up to this date
  statuses?: TestTagStatus[];    // CURRENT, DUE_SOON, OVERDUE, FAILED, NOT_YET_TESTED, RETIRED
  equipmentClasses?: EquipmentClass[];  // CLASS_I, CLASS_II, CLASS_II_DOUBLE_INSULATED
  applianceTypes?: ApplianceType[];     // APPLIANCE, CORD_SET, EXTENSION_LEAD, POWER_BOARD, RCD_PORTABLE, etc.
  results?: TestResult[];        // PASS, FAIL
  assetLinkType?: 'all' | 'serialized' | 'bulk' | 'standalone';  // Filter by what the T&T item is linked to
  locations?: string[];          // Filter by location field
  testedBy?: string[];           // Filter by tester (user IDs)
  testTagIds?: string[];         // Specific items (for ad-hoc selection)
  bulkAssetId?: string;          // All T&T items linked to a specific bulk asset
  searchQuery?: string;          // Free text search across description, make, model, serial
}
```

The filter panel should use the existing UI patterns — comboboxes for multi-select, date pickers for ranges, and a search field. Show a preview count ("This report will include 142 items") before generating.

### Report Types

#### 1. Full Test & Tag Register

**Purpose:** Complete inventory of every T&T item and its current compliance status. This is the report you hand to an auditor or insurer.

**Filters:** status, equipment class, appliance type, location, asset link type, search  
**Formats:** PDF, CSV

**PDF layout:**
- Header: org name, logo, report title, date generated, filter summary
- Summary block: total items, breakdown by status (current/due soon/overdue/failed/not yet tested), compliance rate percentage
- Table: Test Tag ID, Description, Class, Type, Make/Model, Serial, Location, Last Test Date, Result, Next Due Date, Status
- Colour-coded status column (green/amber/red)
- Footer: page numbers, "Generated by GearFlow"

**CSV columns:** testTagId, description, equipmentClass, applianceType, make, modelName, serialNumber, location, testIntervalMonths, lastTestDate, lastResult, nextDueDate, status, linkedAssetTag, linkedBulkAsset

#### 2. Overdue & Non-Compliant Report

**Purpose:** A focused list of items that need immediate attention — overdue, failed, or not yet tested. Hand this to the warehouse manager as a to-do list.

**Filters:** equipment class, appliance type, location, asset link type  
**Formats:** PDF, CSV  
**Note:** This report auto-filters to only `OVERDUE`, `FAILED`, and `NOT_YET_TESTED` items. No date range filter needed — it's always "as of today."

**PDF layout:**
- Header with urgency framing ("Non-Compliant Equipment Report — Requires Immediate Action")
- Section 1: Overdue items sorted by days overdue (worst first), showing how many days overdue each item is
- Section 2: Failed items with failure date and failure notes from the most recent test record
- Section 3: Not yet tested items
- Each section has its own count and subtotal
- Footer with a signature line for the responsible person to acknowledge

#### 3. Test Session Report

**Purpose:** Record of a single testing session (batch of tests done in one sitting). Suitable for filing as a compliance record.

**Filters:** date range (defaults to today), tested by (defaults to current user)  
**Formats:** PDF, CSV  
**Also generated from:** Quick Test Mode session summary (auto-populates filters from the session)

**PDF layout:**
- Header: org name, tester name, date, session summary (X items tested, Y passed, Z failed)
- Table: Test Tag ID, Description, Class, Visual Inspection (P/F), Earth Continuity (reading + P/F), Insulation Resistance (reading + P/F), Leakage Current (reading + P/F), Polarity (P/F), RCD Trip Time (reading + P/F), Overall Result
- Failed items highlighted with a row background colour and failure notes shown below the row
- Totals row at bottom
- Signature line for tester

#### 4. Individual Item Test History

**Purpose:** Full test history for a single item. Used during audits when someone asks "show me every test this extension lead has ever had."

**Filters:** select a specific T&T item (by test tag ID or search)  
**Formats:** PDF  
**Also accessible from:** T&T item detail page ("Export History" action)

**PDF layout:**
- Header: item details (test tag ID, description, class, type, make, model, serial, location, linked asset)
- Current status with next due date
- Table of all test records, most recent first: test date, tester, visual result, earth continuity reading, insulation reading, leakage reading, polarity, RCD, overall result, notes
- Each record gets enough vertical space to show all detail — this is a detailed compliance document, not a summary

#### 5. Due For Testing Report (Upcoming Schedule)

**Purpose:** Planning tool. "What needs testing in the next X days/weeks?" Used to schedule testing sessions.

**Filters:** date range (required — e.g., "next 30 days", "next 7 days", "this month"), equipment class, appliance type, location  
**Formats:** PDF, CSV

**PDF layout:**
- Header: org name, report title, date range
- Items grouped by due date (or by week if the range is large)
- Columns: Test Tag ID, Description, Class, Type, Location, Due Date, Days Until Due
- Summary: total items due in this period

#### 6. Equipment Class Summary Report

**Purpose:** Breakdown of the T&T register by equipment class and appliance type. Useful for understanding your fleet composition and compliance posture at a glance.

**Filters:** status, location  
**Formats:** PDF, CSV

**PDF layout:**
- Grouped sections: Class I, Class II, Class II (Double Insulated)
- Within each class, sub-grouped by appliance type
- Columns: Appliance Type, Total Count, Current, Due Soon, Overdue, Failed, Not Yet Tested, Compliance Rate %
- Grand totals row

#### 7. Tester Activity Report

**Purpose:** Shows what each tester has done over a period. Useful for verifying competency records and workload distribution.

**Filters:** date range (required), tested by (optional — defaults to all testers)  
**Formats:** PDF, CSV

**PDF layout:**
- Grouped by tester name
- Per tester: total tests, pass count, fail count, pass rate, date range of activity
- Itemised list under each tester: test date, test tag ID, description, result
- Org-level totals at the bottom

#### 8. Failed Items Report

**Purpose:** Detailed log of every item that has failed testing in a period, with failure reasons and actions taken. Useful for tracking patterns (e.g., "we keep failing extension leads — maybe we need to replace the whole batch").

**Filters:** date range (required), equipment class, appliance type, location, failure action  
**Formats:** PDF, CSV

**PDF layout:**
- Table: Test Tag ID, Description, Class, Type, Test Date, Tester, Which Tests Failed (visual/earth/insulation/leakage/polarity/RCD), Failure Notes, Action Taken
- Summary: total failures, breakdown by failure type (how many failed visual, how many failed earth continuity, etc.), breakdown by action taken

#### 9. Bulk Asset T&T Summary Report

**Purpose:** For a specific bulk asset type (e.g., "5m Extension Leads"), show all associated T&T items and their status. Answers "how many of our 50 extension leads are currently compliant?"

**Filters:** select a bulk asset (required), status  
**Formats:** PDF, CSV

**PDF layout:**
- Header: bulk asset name, total quantity (from bulk asset), T&T items registered, discrepancy note if counts don't match
- Status summary: current/due soon/overdue/failed/not yet tested counts
- Table: Test Tag ID, Serial Number, Location, Last Test Date, Result, Next Due Date, Status
- Compliance rate percentage prominently displayed

#### 10. Compliance Certificate / Statement

**Purpose:** A formal, client-facing document stating that all equipment for a specific purpose (e.g., a project, or "all hire stock") has current test and tag. Can be attached to project documentation or handed to a venue/client who requires proof of compliance.

**Filters:** status filter (auto-set to CURRENT only), equipment class, appliance type, location, or specific test tag IDs  
**Formats:** PDF only

**PDF layout:**
- Formal letterhead style with org name, logo, ABN, address
- Title: "Electrical Equipment Compliance Statement"
- Body text: "This is to certify that the following electrical equipment owned by [Org Name] has been inspected and tested in accordance with AS/NZS 3760:2022 and found to be safe for use."
- Table: Test Tag ID, Description, Class, Last Test Date, Next Due Date, Tester
- Only items with CURRENT status are included (items that are overdue/failed are excluded — this is a declaration of compliance)
- Statement: "All items listed above held a current test tag as of [date]."
- Signature line for the responsible person
- Note: "This statement covers only the items listed. It does not constitute a guarantee of ongoing safety beyond the stated test dates."

---

### Report Generation UI

#### Reports Page Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  TEST & TAG REPORTS                                                │
│                                                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │ Full Register    │  │ Overdue /        │  │ Test Session     │ │
│  │                  │  │ Non-Compliant    │  │ Report           │ │
│  │ Complete T&T     │  │                  │  │                  │ │
│  │ inventory with   │  │ Items needing    │  │ Results from a   │ │
│  │ current status   │  │ immediate action │  │ testing session  │ │
│  │                  │  │                  │  │                  │ │
│  │ [PDF] [CSV]      │  │ [PDF] [CSV]      │  │ [PDF] [CSV]      │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│                                                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │ Item History     │  │ Due For Testing  │  │ Class Summary    │ │
│  │                  │  │                  │  │                  │ │
│  │ Full test history│  │ Upcoming testing │  │ Fleet breakdown  │ │
│  │ for one item     │  │ schedule         │  │ by class & type  │ │
│  │                  │  │                  │  │                  │ │
│  │ [PDF]            │  │ [PDF] [CSV]      │  │ [PDF] [CSV]      │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│                                                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │ Tester Activity  │  │ Failed Items     │  │ Bulk Asset       │ │
│  │                  │  │                  │  │ T&T Summary      │ │
│  │ Tests per tester │  │ Failures with    │  │                  │ │
│  │ over a period    │  │ reasons & actions│  │ Status of all    │ │
│  │                  │  │                  │  │ units for a type │ │
│  │ [PDF] [CSV]      │  │ [PDF] [CSV]      │  │ [PDF] [CSV]      │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│                                                                    │
│  ┌──────────────────┐                                              │
│  │ Compliance       │                                              │
│  │ Certificate      │                                              │
│  │                  │                                              │
│  │ Formal statement │                                              │
│  │ for clients or   │                                              │
│  │ venues           │                                              │
│  │ [PDF]            │                                              │
│  └──────────────────┘                                              │
└────────────────────────────────────────────────────────────────────┘
```

#### Report Configuration Flow

1. User clicks a report card → a slide-over panel or modal opens
2. Panel shows: report description, available filters (only the relevant ones for this report type), format selection (PDF / CSV / both)
3. User sets filters → live preview count updates ("This report will include 142 items across 87 test records")
4. User clicks "Generate Report"
5. For PDF: opens in a new tab or downloads directly (follow the existing document generation pattern via an API route)
6. For CSV: downloads directly as a file
7. Show a loading spinner during generation for large reports

#### Report API Route

Create `GET /api/test-tag-reports/[reportType]`:

- Accepts report type as a path parameter: `register`, `overdue`, `session`, `item-history`, `due-schedule`, `class-summary`, `tester-activity`, `failed-items`, `bulk-summary`, `compliance-certificate`
- Accepts filters as query parameters
- Accepts `format=pdf` or `format=csv` as a query parameter
- Validates org membership
- Returns the generated file with appropriate `Content-Type` and `Content-Disposition` headers

### Server Actions

#### Test Tag Asset Actions (`src/server/test-tag-assets.ts`)

```
getTestTagAssets(filters, pagination): paginated list with search/filter/sort
getTestTagAsset(id): single item with test records
createTestTagAsset(data): create a new T&T item, reserve testTagId
createTestTagAssetsFromBulk(data: { bulkAssetId, count, equipmentClass, applianceType, testIntervalMonths }): batch create for bulk assets
updateTestTagAsset(id, data): edit item details
retireTestTagAsset(id): set status to RETIRED, isActive to false
getTestTagDashboardStats(): counts by status, overdue list, due soon list, recent tests
lookupTestTagAsset(testTagId): look up by the human-readable tag ID (for quick test scanner)
peekNextTestTagIds(count): preview next IDs without incrementing
```

#### Test Tag Record Actions (`src/server/test-tag-records.ts`)

```
createTestTagRecord(data): save a new test record, update parent TestTagAsset status/dates
getTestTagRecords(testTagAssetId, pagination): paginated history for one item
getRecentTestRecords(pagination): recent tests across all items (for dashboard)
getSessionSummary(recordIds): summary stats for a batch of records (for session report)
```

#### Server Actions for Reports (`src/server/test-tag-reports.ts`)

```
// Data fetching for reports (returns structured data that can be rendered as PDF or CSV)
getRegisterReportData(filters: ReportFilters): RegisterReportData
getOverdueReportData(filters: ReportFilters): OverdueReportData
getSessionReportData(filters: ReportFilters): SessionReportData
getItemHistoryReportData(testTagAssetId: string): ItemHistoryReportData
getDueScheduleReportData(filters: ReportFilters): DueScheduleReportData
getClassSummaryReportData(filters: ReportFilters): ClassSummaryReportData
getTesterActivityReportData(filters: ReportFilters): TesterActivityReportData
getFailedItemsReportData(filters: ReportFilters): FailedItemsReportData
getBulkSummaryReportData(bulkAssetId: string, filters: ReportFilters): BulkSummaryReportData
getComplianceCertificateData(filters: ReportFilters): ComplianceCertificateData

// CSV generation (returns CSV string)
exportRegisterCSV(filters: ReportFilters): string
exportOverdueCSV(filters: ReportFilters): string
exportSessionCSV(filters: ReportFilters): string
exportDueScheduleCSV(filters: ReportFilters): string
exportClassSummaryCSV(filters: ReportFilters): string
exportTesterActivityCSV(filters: ReportFilters): string
exportFailedItemsCSV(filters: ReportFilters): string
exportBulkSummaryCSV(bulkAssetId: string, filters: ReportFilters): string
```

All server actions must:
- Call `getOrgContext()` for organization scoping
- Call `serialize()` on return values
- Follow existing pagination and error patterns
- CSV generators should use the existing custom CSV escaper pattern from `src/server/csv.ts`

### PDF Templates (`src/lib/pdf/`)

Create a PDF template for each report type. Follow existing PDF patterns (`@react-pdf/renderer`, Helvetica only, no Unicode — use ASCII alternatives like `-` not `—`, `|` not bullet characters).

```
src/lib/pdf/
├── test-tag-register-pdf.tsx          // Report 1: Full Register
├── test-tag-overdue-pdf.tsx           // Report 2: Overdue & Non-Compliant
├── test-tag-session-pdf.tsx           // Report 3: Test Session
├── test-tag-item-history-pdf.tsx      // Report 4: Individual Item History
├── test-tag-due-schedule-pdf.tsx      // Report 5: Due For Testing
├── test-tag-class-summary-pdf.tsx     // Report 6: Equipment Class Summary
├── test-tag-tester-activity-pdf.tsx   // Report 7: Tester Activity
├── test-tag-failed-items-pdf.tsx      // Report 8: Failed Items
├── test-tag-bulk-summary-pdf.tsx      // Report 9: Bulk Asset T&T Summary
├── test-tag-compliance-cert-pdf.tsx   // Report 10: Compliance Certificate
└── test-tag-pdf-shared.tsx            // Shared styles, header/footer components, status badges
```

All PDF templates should share:
- A common header component (org name, logo if available, report title, date generated, filter summary)
- A common footer component (page numbers, "Generated by GearFlow", timestamp)
- Shared table styles (consistent column widths, alternating row colours, header row styling)
- Status badge rendering (coloured backgrounds: green for current/pass, amber for due soon, red for overdue/fail)
- The compliance certificate uses a more formal/letterhead layout distinct from the tabular reports

### Test Tag Label PDF (Bonus)

Generate a printable tag label for physical tags:

- **Route:** accessible from the item detail page and from Quick Test Mode after saving a PASS result
- **Layout:** small format (standard test tag sticker size, approximately 40mm x 20mm or configurable)
- **Content:** Test Tag ID, "TESTED" or "PASSED", test date, next due date, tester name/initials, org name
- **Batch printing:** from the registry page, select multiple items and print labels for all of them in one PDF (multiple labels per page, grid layout)

---

## Sidebar Navigation

Add a new top-level sidebar item:

```
Test & Tag (icon: Shield or Zap or ClipboardCheck from lucide-react)
├── Dashboard          /test-and-tag
├── Registry           /test-and-tag/registry
├── Quick Test         /test-and-tag/quick-test
└── Reports            /test-and-tag/reports
```

Position it after "Maintenance" in the sidebar order.

---

## Migration Plan

### Phase 1: Data Model

1. Create `TestTagAsset` and `TestTagRecord` Prisma models
2. Run migration
3. Add T&T settings to organization metadata JSON schema
4. Implement server actions for CRUD operations
5. Implement auto-incrementing test tag ID logic (mirror asset tag pattern)

### Phase 2: Registry & Item Management

1. Build the T&T registry list page with search/filter/sort
2. Build the T&T item detail page with test history
3. Build the "Create T&T Item" form (standalone)
4. Build the "Create from Serialized Asset" flow (action on asset detail page)
5. Build the "Batch Create from Bulk Asset" flow (action on bulk asset detail page)
6. Add sidebar navigation

### Phase 3: Quick Test Mode

1. Build the quick test page with scanner input
2. Implement the lookup-or-create flow
3. Build the test recording form with visual inspection and electrical test sections
4. Implement auto pass/fail calculation from readings
5. Add session log panel
6. Add audio feedback (pass/fail sounds)
7. Add keyboard shortcuts
8. Build session summary view

### Phase 4: Dashboard

1. Build the dashboard page with stats cards
2. Build the overdue items table
3. Build the due soon table
4. Build the recently tested table
5. Wire up quick actions

### Phase 5: Integration

1. Add T&T status display on serialized asset detail pages
2. Add T&T summary on bulk asset detail pages
3. Add checkout warning/block for overdue/failed T&T items
4. Add T&T settings to org settings page (prefix, default interval, checkout policy)

### Phase 6: Reports & Exports

1. Build the reports page with report type cards and configuration panels
2. Implement the universal `ReportFilters` interface and filter UI components
3. Create the report API route (`/api/test-tag-reports/[reportType]`)
4. Implement report data-fetching server actions (`src/server/test-tag-reports.ts`)
5. Build shared PDF components (header, footer, table styles, status badges) in `test-tag-pdf-shared.tsx`
6. Build PDF templates one at a time in priority order:
   a. Full Register PDF (most commonly needed)
   b. Overdue & Non-Compliant PDF (daily operational use)
   c. Test Session PDF (generated after every Quick Test session)
   d. Compliance Certificate PDF (client-facing)
   e. Item History PDF
   f. Due Schedule PDF
   g. Failed Items PDF
   h. Tester Activity PDF
   i. Class Summary PDF
   j. Bulk Asset Summary PDF
7. Implement CSV export functions for each report type that supports it
8. Build the Test Tag Label PDF (batch label printing)
9. Wire up "Export" / "Generate Report" actions from the dashboard, registry, and item detail pages into the reports system

### Phase 7: Polish

1. Status badge component (colour-coded: green=current, amber=due soon, red=overdue, red outline=failed)
2. Countdown display ("Due in 12 days" / "3 days overdue")
3. Bulk actions on registry (retire, re-test, export)
4. Mobile optimisation for quick test mode (this will be used on phones/tablets at the test bench)
5. Report generation loading states and progress indicators for large datasets

---

## Edge Cases

1. **Duplicate test tag IDs:** The `testTagId` is unique per org. If a user tries to create or import an item with an existing ID, show a clear error. The lookup in quick test mode should find the existing item rather than creating a duplicate.

2. **Changing equipment class:** If an item's class is changed (e.g., from Class I to Class II), future tests use the new class. Historical records retain the class they were tested as (`equipmentClassTested` on the record).

3. **Relinking assets:** A T&T item can be unlinked from an asset (e.g., if the asset is retired but the physical tag is moved to a replacement). Allow editing the `assetId`/`bulkAssetId` links on the T&T item.

4. **Bulk asset quantity changes:** If the bulk asset's `totalQuantity` changes, the T&T item count doesn't automatically sync. The T&T registry is its own source of truth — the user needs to create or retire T&T items manually. Show a note on the bulk asset page if the T&T item count doesn't match the total quantity.

5. **External testers:** If an external contractor does the testing, the `testerName` free text field captures their name. The `testedBy` User field should be the GearFlow user who entered the record (may be different from the physical tester).

6. **Backdating tests:** Allow setting `testDate` to a past date (e.g., entering records from a paper-based testing session that happened yesterday). The `nextDueDate` should be calculated from the entered `testDate`, not from today.

7. **Items failing then being retested:** When an item fails, it stays in `FAILED` status until a new test record with `result: PASS` is added (presumably after repair). The system should track the full chain: FAIL → repair → retest PASS.

8. **Importing existing T&T data:** Provide a CSV import for organizations migrating from spreadsheets or other systems. Columns: test tag ID, description, class, type, make, model, serial, last test date, last result, interval months. Create `TestTagAsset` records and optionally a `TestTagRecord` for the last test.

9. **RCD-specific items:** RCDs have additional test requirements (push-button test, trip time). The `applianceType` of `RCD_PORTABLE` or `RCD_FIXED` should show the RCD-specific fields in the test form and hide irrelevant fields.

10. **Three-phase equipment:** Three-phase items use the same tests but may require different PAT testing equipment. The `applianceType` of `THREE_PHASE` should flag this in the UI so the tester knows to use appropriate test equipment (most standard PAT testers are single-phase only).

---

## Summary

This extension replaces the basic maintenance-record approach with a purpose-built test and tag system that:

- **Gives every physical item its own test tag identity**, including individual units from bulk asset pools
- **Records structured test data** per AS/NZS 3760:2022 — visual inspection, earth continuity, insulation resistance, leakage current, polarity, RCD trip time
- **Provides a dedicated dashboard** showing what's overdue, what's due soon, and recent test activity
- **Enables rapid batch testing** via Quick Test Mode with scanner input, keyboard shortcuts, and audio feedback
- **Integrates with the existing asset system** — linked serialized and bulk assets show their T&T status, and checkout warnings can flag overdue items
- **Produces a full suite of compliance-ready reports** — 10 report types covering the full register, overdue items, test sessions, item histories, upcoming schedules, class breakdowns, tester activity, failure analysis, bulk asset summaries, and formal compliance certificates — all filterable by date range, equipment class, appliance type, location, and more, exportable as both PDF and CSV
