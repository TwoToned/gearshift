# Feature: Project Services — Delivery, Pickup, Bump In/Out, Labour & Custom Services

## Summary

Add a first-class Services system to projects that manages all non-equipment operational activities: deliveries, pickups, bump in (load-in), bump out (load-out), labour calls, and custom/miscellaneous services. Services live on their own tab on the project detail page, can have specific addresses, times, and assigned crew, and can optionally appear on client-facing documents (quotes, invoices). Each service integrates deeply with the Crew Management and Maps features.

This replaces the current pattern of using `ProjectLineItem` with type `SERVICE`, `LABOUR`, or `TRANSPORT` as generic text rows. Those line item types continue to exist for backward compatibility and simple cases, but the new Services system provides structured data, crew integration, scheduling, and operational management that text-only line items can't.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Service Types](#2-service-types)
3. [Data Model](#3-data-model)
4. [Service Templates](#4-service-templates)
5. [Project Services Tab](#5-project-services-tab)
6. [Crew Integration](#6-crew-integration)
7. [Address & Maps Integration](#7-address--maps-integration)
8. [Financial Integration](#8-financial-integration)
9. [Document Visibility](#9-document-visibility)
10. [Service Status & Workflow](#10-service-status--workflow)
11. [Server Actions](#11-server-actions)
12. [Validation Schemas](#12-validation-schemas)
13. [PDF Document Changes](#13-pdf-document-changes)
14. [Routes & Pages](#14-routes--pages)
15. [Search & Slash Commands](#15-search--slash-commands)
16. [Notifications](#16-notifications)
17. [Reporting Integration](#17-reporting-integration)
18. [Activity Log Integration](#18-activity-log-integration)
19. [Project Templates](#19-project-templates)
20. [Organization Export/Import](#20-organization-exportimport)
21. [Project Sharing Integration](#21-project-sharing-integration)
22. [Mobile Considerations](#22-mobile-considerations)
23. [Implementation Phases](#23-implementation-phases)

---

## 1. Core Concepts

### What Is a Service?

A service is a structured operational task attached to a project. Unlike equipment line items (which track physical assets), services describe *work to be done* — delivering gear, setting up a stage, running a show, packing down afterwards.

### Services vs Line Items

The existing `ProjectLineItem` model has types `SERVICE`, `LABOUR`, `TRANSPORT`, and `MISC`. These are simple rows with a description, quantity, and price. They work for billing but don't capture operational detail.

The new `ProjectService` model is richer:
- Has a specific **service type** (delivery, pickup, bump in, bump out, labour, misc)
- Has its own **schedule** (date, start time, end time — independent of the project dates)
- Has its own **address** (using `AddressInput` — a delivery might go to a different address than the venue)
- Has **crew assignments** directly linked to it (who's doing this service?)
- Has a **status workflow** (planned → confirmed → in progress → completed)
- Can **generate a line item** for billing purposes (the service creates a line item, not the other way around)

### Relationship

```
ProjectService (operational — what needs to happen)
    ↕ optionally generates
ProjectLineItem (financial — what to charge the client)
```

A service can exist without a line item (internal operations not billed to client). A line item can exist without a service (simple billing row for a miscellaneous charge). But when linked, the service drives the operational detail and the line item handles the financial side.

---

## 2. Service Types

### Built-In Types

| Type | Icon | Typical Fields | Description |
|------|------|---------------|-------------|
| **DELIVERY** | `Truck` | Address (destination), date, time window, vehicle, driver crew | Delivering equipment to the venue/site |
| **PICKUP** | `PackageCheck` | Address (collection point), date, time window, vehicle, driver crew | Collecting/returning equipment |
| **BUMP_IN** | `ArrowDownToLine` | Date, start time, end time, crew assignments | Load-in and setup at the venue |
| **BUMP_OUT** | `ArrowUpFromLine` | Date, start time, end time, crew assignments | Pack-down and load-out |
| **LABOUR** | `HardHat` | Date, start time, end time, crew count, crew role, crew assignments | General labour calls (stage hands, riggers, etc.) |
| **MISC** | `Wrench` | Date, description, notes | Anything else (power hookup, catering liaison, safety briefing, etc.) |

### Custom Service Types (stretch goal)

Allow orgs to define their own service types with custom names, icons, and default fields. For v1, the built-in types cover the main use cases. Custom types can be added later via an org settings page.

---

## 3. Data Model

### `ProjectService`

```prisma
model ProjectService {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  projectId       String
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // Type & description
  type            ServiceType          // DELIVERY, PICKUP, BUMP_IN, BUMP_OUT, LABOUR, MISC
  title           String               // User-editable title, defaults to type name
  description     String?              // Additional details
  notes           String?              // Internal notes (not on client docs)

  // Schedule
  date            DateTime?            // The day this service occurs
  startTime       String?              // "06:00"
  endTime         String?              // "22:00"
  estimatedDuration Int?               // In minutes (alternative to end time)

  // Address (for delivery/pickup — uses AddressInput pattern)
  address         String?
  latitude        Float?
  longitude       Float?

  // Status
  status          ServiceStatus        // PLANNED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED

  // Financial
  showOnDocuments Boolean  @default(false)  // Whether to include on quote/invoice
  unitPrice       Decimal? @db.Decimal(10, 2)
  quantity        Int      @default(1)
  pricingType     PricingType?         // PER_DAY, PER_HOUR, FLAT (reuse existing enum)
  duration        Decimal? @db.Decimal(6, 2)  // For PER_DAY/PER_HOUR pricing
  discount        Decimal? @db.Decimal(5, 2)
  lineTotal       Decimal? @db.Decimal(10, 2) // Auto-calculated
  taxable         Boolean  @default(true)

  // Linked line item (auto-generated when showOnDocuments is true)
  lineItemId      String?  @unique
  lineItem        ProjectLineItem? @relation(fields: [lineItemId], references: [id], onDelete: SetNull)

  // Subcontract (e.g. hired a truck from another company)
  isSubcontracted Boolean  @default(false)
  supplierId      String?
  supplier        Supplier? @relation(fields: [supplierId], references: [id], onDelete: SetNull)
  subcontractCost Decimal? @db.Decimal(10, 2)  // What we pay the supplier
  subcontractRef  String?                       // PO/reference number

  // Transport-specific (for DELIVERY/PICKUP)
  vehicleDescription String?           // "3-tonne truck", "Sprinter van"
  numberOfTrips      Int?              // If multiple loads required
  distanceKm         Decimal? @db.Decimal(8, 2) // For distance-based pricing

  // Labour-specific
  crewCountRequired  Int?              // How many crew needed (may differ from assigned)
  crewRoleId         String?           // Default role for crew on this service
  crewRole           CrewRole? @relation(fields: [crewRoleId], references: [id], onDelete: SetNull)

  // Crew assignments
  crewAssignments    ServiceCrewAssignment[]

  // Ordering
  sortOrder       Int      @default(0)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([organizationId])
  @@index([projectId])
  @@index([projectId, type])
  @@index([projectId, date])
}

enum ServiceType {
  DELIVERY
  PICKUP
  BUMP_IN
  BUMP_OUT
  LABOUR
  MISC
}

enum ServiceStatus {
  PLANNED       // Service created, not yet confirmed
  CONFIRMED     // Confirmed and scheduled
  IN_PROGRESS   // Currently happening
  COMPLETED     // Done
  CANCELLED     // Cancelled
}
```

### `ServiceCrewAssignment`

Links crew members to a specific service on a project. This is separate from `CrewAssignment` (which links crew to a project phase) — a service crew assignment is more granular.

```prisma
model ServiceCrewAssignment {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  serviceId       String
  service         ProjectService @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  crewMemberId    String
  crewMember      CrewMember @relation(fields: [crewMemberId], references: [id], onDelete: Cascade)

  crewRoleId      String?
  crewRole        CrewRole? @relation(fields: [crewRoleId], references: [id], onDelete: SetNull)

  // Schedule override (defaults to service date/time if not set)
  callTime        String?            // "06:00" — if different from service start
  endTime         String?
  
  // Status
  status          AssignmentStatus   // Reuse from Crew spec: PENDING, OFFERED, ACCEPTED, DECLINED, CONFIRMED, CANCELLED, COMPLETED

  // Rate override
  rateOverride    Decimal? @db.Decimal(10, 2)
  rateType        RateType?
  estimatedHours  Decimal? @db.Decimal(6, 2)
  estimatedCost   Decimal? @db.Decimal(10, 2)

  notes           String?
  sortOrder       Int      @default(0)

  createdAt       DateTime @default(now())

  @@unique([serviceId, crewMemberId])  // One assignment per person per service
  @@index([serviceId])
  @@index([crewMemberId])
}
```

### Relationship to CrewAssignment

`ServiceCrewAssignment` is the service-level granularity. The existing `CrewAssignment` from the Crew spec is the project-phase-level granularity. They serve different purposes:

- `CrewAssignment`: "Alex is assigned to this project for the Bump In phase, working Mon-Wed"
- `ServiceCrewAssignment`: "Alex is specifically assigned to the Delivery service on Monday morning"

When a service has crew assigned, those assignments can optionally sync up to create/update `CrewAssignment` records at the project phase level. This means crew added via services also appear in the project's Crew tab and the crew planner. The sync should be configurable — some orgs want the detail, others just want the overview.

For v1, `ServiceCrewAssignment` is the primary source. A convenience function `syncServiceCrewToProjectCrew()` can consolidate service crew assignments into `CrewAssignment` records grouped by phase.

---

## 4. Service Templates

### Org-Level Service Presets

Orgs can define default services that are auto-added to new projects or available as quick-add templates:

```prisma
model ServiceTemplate {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  type            ServiceType
  title           String
  description     String?
  defaultCrewCount Int?
  defaultCrewRoleId String?
  defaultVehicle  String?
  defaultPricingType PricingType?
  defaultUnitPrice Decimal? @db.Decimal(10, 2)
  showOnDocuments Boolean  @default(false)
  isAutoAdded     Boolean  @default(false)  // Auto-add to every new project
  sortOrder       Int      @default(0)
  isActive        Boolean  @default(true)

  @@index([organizationId])
}
```

### Auto-Added Services

When `isAutoAdded` is true, the service is automatically created on every new project. For example, an org might always auto-add:
- "Delivery" (DELIVERY type)
- "Bump In" (BUMP_IN type)
- "Bump Out" (BUMP_OUT type)
- "Pickup" (PICKUP type)

The auto-added services inherit their dates from the project:
- Delivery date → project's `loadInDate` (or day before)
- Bump In → `loadInDate` + `loadInTime`
- Bump Out → `loadOutDate` + `loadOutTime`
- Pickup → `loadOutDate` (or day after)

These are suggestions — the user can change everything.

### Quick-Add on Services Tab

A "Add Service" dropdown that shows:
1. The built-in types (Delivery, Pickup, Bump In, Bump Out, Labour, Misc)
2. Any org-defined service templates
3. "Custom Service" option for freeform

---

## 5. Project Services Tab

### Location: New Tab on Project Detail Page

The project detail page gets a new tab: **Services**. This sits alongside the existing tabs (Equipment/Line Items, Crew, Documents, etc.).

### Services Tab Layout

```
┌─ Services ──────────────────────────────────────────────────────┐
│                                                                  │
│  [+ Add Service ▾]                              [Timeline View]  │
│                                                                  │
│  ── Thu 14 Mar ──────────────────────────────────────────────── │
│                                                                  │
│  ┌ 🚚 Delivery                                    CONFIRMED ┐  │
│  │ To: Sydney Olympic Park, Homebush NSW 2127      📍        │  │
│  │ Time: 06:00 - 08:00                                       │  │
│  │ Vehicle: 3-tonne truck                                    │  │
│  │ Crew: Dave M. (Driver), Jake L. (Offsider)               │  │
│  │ 💰 $450 flat — On quote                                  │  │
│  └───────────────────────── [Edit] [Crew] [Status ▾] [···] ─┘  │
│                                                                  │
│  ┌ ⬇ Bump In                                      PLANNED   ┐  │
│  │ Time: 08:00 - 18:00                                       │  │
│  │ Crew needed: 4 (2 assigned)                    ⚠️ 2 short │  │
│  │ Assigned: Alex T. (Sound), Jordan K. (Lighting)           │  │
│  │ 💰 4x $65/hr × 10hr = $2,600 — On quote                 │  │
│  └───────────────────────── [Edit] [Crew] [Status ▾] [···] ─┘  │
│                                                                  │
│  ── Fri 15 Mar - Sat 16 Mar ────────────────────────────────── │
│                                                                  │
│  ┌ 👷 Labour — Show Crew                           CONFIRMED ┐  │
│  │ Fri 15 Mar 08:00 - 23:00, Sat 16 Mar 08:00 - 02:00       │  │
│  │ Crew: 6 assigned (Alex, Jordan, Sam, Chris, Pat, Riley)   │  │
│  │ 💰 Not on client documents                                │  │
│  └───────────────────────── [Edit] [Crew] [Status ▾] [···] ─┘  │
│                                                                  │
│  ── Sun 17 Mar ──────────────────────────────────────────────── │
│                                                                  │
│  ┌ ⬆ Bump Out                                     PLANNED   ┐  │
│  │ Time: 00:00 - 06:00                                       │  │
│  │ Crew needed: 6 (0 assigned)                   ⚠️ 6 short  │  │
│  │ 💰 $1,800 flat — On quote                                 │  │
│  └───────────────────────── [Edit] [Crew] [Status ▾] [···] ─┘  │
│                                                                  │
│  ┌ 🚚 Pickup                                      PLANNED   ┐  │
│  │ From: Sydney Olympic Park                       📍        │  │
│  │ Time: 06:00 - 08:00                                       │  │
│  │ Vehicle: 3-tonne truck                                    │  │
│  │ Crew: unassigned                               ⚠️         │  │
│  │ 💰 $450 flat — On quote                                   │  │
│  └───────────────────────── [Edit] [Crew] [Status ▾] [···] ─┘  │
│                                                                  │
│  ── Services Financial Summary ──────────────────────────────── │
│  Services subtotal (on documents): $5,300                        │
│  Internal labour cost (not on documents): $3,200                 │
│  Total services cost: $8,500                                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Key UI Elements

**Service cards:** Each service is a card showing:
- Type icon and title
- Date and time
- Address with map pin icon (if geocoded — links to map or "Get Directions")
- Crew summary (assigned count vs required count, names, shortage warning)
- Financial info: price, whether it appears on client documents
- Status badge
- Actions: Edit, Manage Crew, Change Status, More (duplicate, delete, subcontract)

**Grouped by date:** Services are grouped by their date, ordered chronologically. This gives a day-by-day operational view of the project.

**Timeline view toggle:** An optional horizontal timeline showing all services as bars on a date axis — similar to the crew planner but focused on services. This is a stretch goal.

**Crew shortage warnings:** When `crewCountRequired` is set and fewer crew are assigned, show an amber warning with the shortfall count. This is the primary operational signal — "you need to find 2 more people."

---

## 6. Crew Integration

### Adding Crew to a Service

The "Crew" button on each service card opens a dialog/sheet to manage `ServiceCrewAssignment` records:

1. Search crew by name, role, skill, availability
2. See availability indicators (available/busy/blocked) for the service date
3. Select crew members, assign roles
4. Optionally override rate per crew member
5. See estimated cost as crew are added

### Sync with Project Crew Tab

When crew are assigned to services, they should also appear on the project's Crew tab (from the Crew Management spec). The sync works:

- **Services → Crew tab:** When a crew member is assigned to a service, check if they already have a `CrewAssignment` for the matching `ProjectPhase` on this project. If not, create one. Map service types to phases:
  - DELIVERY → `ProjectPhase.DELIVERY`
  - PICKUP → `ProjectPhase.PICKUP`
  - BUMP_IN → `ProjectPhase.BUMP_IN`
  - BUMP_OUT → `ProjectPhase.BUMP_OUT`
  - LABOUR → `ProjectPhase.EVENT` (or `FULL_DURATION` depending on context)
  - MISC → `ProjectPhase.FULL_DURATION`

- **Crew tab → Services:** When a crew member is assigned at the project phase level (via the Crew tab), they don't automatically appear on individual services. The project-level assignment is the overview; service-level is the detail.

This is a one-way sync: services push to the crew tab, but not the reverse. This prevents circular updates and keeps the service as the operational source of truth.

### Crew Role on Services

Each service can have a default `crewRoleId` (e.g. "Driver" for delivery, "Stage Hand" for bump in). When crew are added to the service, they inherit this role by default but can override it individually.

---

## 7. Address & Maps Integration

### AddressInput on Services

Services that have addresses (DELIVERY, PICKUP, and optionally MISC) use the `AddressInput` component from the Maps spec:

- DELIVERY: "Delivery to" address — defaults to the project's location address, but can be overridden
- PICKUP: "Pickup from" address — defaults to the project's location address, but can be overridden
- BUMP_IN / BUMP_OUT: No separate address field — these happen at the project venue. The project's location is used.
- LABOUR: No address by default — inherits the project venue
- MISC: Optional address field (shown via toggle)

### Map on Service Cards

If a service has geocoded coordinates (user selected an autocomplete suggestion in `AddressInput`):
- Show a small map pin icon on the service card
- Clicking it opens the `AddressDisplay` component (compact map + "Get Directions")
- On the crew portal, the "Get Directions" button for a service uses the service's address if set, falling back to the project venue

---

## 8. Financial Integration

### Per-Service Pricing

Each service can have its own pricing:

| Field | Description |
|-------|-------------|
| `unitPrice` | Price per unit (per hour, per day, or flat) |
| `quantity` | Number of units (e.g. 2 trucks, 4 crew) |
| `pricingType` | `PER_HOUR`, `PER_DAY`, `FLAT` — reuses the existing enum |
| `duration` | Duration in hours or days (for per-hour/per-day pricing) |
| `discount` | Percentage discount |
| `lineTotal` | Auto-calculated: `unitPrice × quantity × duration - discount` |
| `taxable` | Whether GST applies |

### `showOnDocuments` Toggle

Each service has a `showOnDocuments` boolean:

- **true:** The service appears on client-facing documents (quote, invoice). A corresponding `ProjectLineItem` is auto-created/synced with type `SERVICE`, `LABOUR`, or `TRANSPORT` based on the service type. The line item inherits the service's pricing, and updating the service updates the line item.
- **false:** The service is internal only — it appears on the Services tab but not on any client documents. No line item is created. This is for operational tracking (e.g. you want to schedule the bump in crew but not charge the client separately for it because it's included in the hire rate).

### Line Item Sync

When `showOnDocuments` is toggled to true:
1. Create a `ProjectLineItem` with the service's pricing details
2. Set `ProjectLineItem.type` based on service type mapping:
   - DELIVERY, PICKUP → `TRANSPORT`
   - BUMP_IN, BUMP_OUT, LABOUR → `LABOUR`
   - MISC → `SERVICE`
3. Store `ProjectService.lineItemId` → the created line item
4. The line item's `description` is the service title
5. The line item's financial fields mirror the service's pricing
6. Changes to the service's pricing update the linked line item
7. Deleting the service deletes the linked line item
8. `recalculateProjectTotals()` includes these line items in the project total

When toggled to false:
1. Delete the linked `ProjectLineItem` (if it exists)
2. Clear `ProjectService.lineItemId`
3. `recalculateProjectTotals()` runs to update the project total

### Services Financial Summary

The Services tab shows a financial summary at the bottom:
- **Services subtotal (on documents):** Sum of `lineTotal` for services with `showOnDocuments: true`
- **Internal services cost:** Sum of `lineTotal` for services with `showOnDocuments: false` (operational cost tracking)
- **Crew cost on services:** Sum of `estimatedCost` from all `ServiceCrewAssignment` records
- **Subcontract cost:** Sum of `subcontractCost` from all subcontracted services

### Project Financial Summary Update

The main project financial summary should show services alongside equipment:
- Equipment subtotal: (existing)
- Services subtotal: (sum of document-visible services)
- Subtotal: equipment + services
- Discount, tax, total: (unchanged calculation, now includes services)

---

## 9. Document Visibility

### Per-Service Control

The `showOnDocuments` toggle is the primary control. When true, the service appears on:
- **Quote PDF:** In a "Services" section below the equipment table
- **Invoice PDF:** Same layout
- **Packing List / Pull Sheet:** Delivery and pickup services show as "Transport" items with address and time
- **Delivery Docket:** Delivery services are prominently featured with address, time, and driver info

### Document Section Layout

On quotes and invoices, services with `showOnDocuments: true` appear in a separate "Services" section:

```
── Equipment ──────────────────────────────────────
| Item                  | Qty | Rate    | Total   |
| Shure SM58            | 10  | $15/day | $750    |
| QSC K12.2             | 4   | $40/day | $800    |
| ...                   |     |         |         |
|                       |     | Equip:  | $3,200  |

── Services ───────────────────────────────────────
| Service               | Details          | Total   |
| Delivery              | 14 Mar, 06:00   | $450    |
| Bump In - Stage Crew  | 14 Mar, 4 crew  | $2,600  |
| Bump Out              | 17 Mar          | $1,800  |
| Pickup                | 17 Mar, 06:00   | $450    |
|                       |        Services: | $5,300  |
```

Services that have `showOnDocuments: false` are never included in any PDF — they exist only on the web UI.

### Subcontracted Services on Documents

Services with `isSubcontracted: true` follow the same pattern as subhired equipment:
- `showSubhireOnDocs` equivalent: the `showOnDocuments` toggle
- When shown, the subcontract supplier name can optionally be displayed (similar to `showSubhireOnDocs` for equipment)

---

## 10. Service Status & Workflow

### Status Flow

```
PLANNED → CONFIRMED → IN_PROGRESS → COMPLETED
                Any → CANCELLED
```

- **PLANNED:** Service created with details. Default for new services.
- **CONFIRMED:** Schedule and crew are locked in. Admin explicitly confirms.
- **IN_PROGRESS:** Service is currently happening (delivery is en route, bump in has started).
- **COMPLETED:** Service is done. Timestamp recorded.
- **CANCELLED:** Service was cancelled. Preserved in the list with strikethrough styling.

### Status Change Actions

On each service card, a status dropdown allows quick transitions. Status changes are logged in the activity log and can trigger notifications.

### Bulk Status

The Services tab has a "Confirm All" action that moves all PLANNED services to CONFIRMED at once (useful for locking in the whole operation).

---

## 11. Server Actions

### `src/server/project-services.ts` — New File

```typescript
"use server";

// Service CRUD
export async function createProjectService(data: CreateServiceInput): Promise<ProjectService>;
export async function updateProjectService(id: string, data: UpdateServiceInput): Promise<ProjectService>;
export async function deleteProjectService(id: string): Promise<void>;
export async function getProjectServices(projectId: string): Promise<ProjectService[]>;
export async function getProjectServiceById(id: string): Promise<ProjectService>;

// Bulk operations
export async function reorderProjectServices(projectId: string, orderedIds: string[]): Promise<void>;
export async function bulkUpdateServiceStatus(ids: string[], status: ServiceStatus): Promise<void>;
export async function autoCreateServicesFromTemplate(projectId: string): Promise<ProjectService[]>;

// Crew on services
export async function addServiceCrew(serviceId: string, data: ServiceCrewInput): Promise<ServiceCrewAssignment>;
export async function updateServiceCrew(assignmentId: string, data: Partial<ServiceCrewInput>): Promise<ServiceCrewAssignment>;
export async function removeServiceCrew(assignmentId: string): Promise<void>;
export async function getServiceCrew(serviceId: string): Promise<ServiceCrewAssignment[]>;

// Line item sync
export async function syncServiceLineItem(serviceId: string): Promise<void>;
// Called when showOnDocuments changes or pricing is updated

// Template CRUD (org settings)
export async function createServiceTemplate(data: ServiceTemplateInput): Promise<ServiceTemplate>;
export async function updateServiceTemplate(id: string, data: Partial<ServiceTemplateInput>): Promise<ServiceTemplate>;
export async function deleteServiceTemplate(id: string): Promise<void>;
export async function getServiceTemplates(): Promise<ServiceTemplate[]>;

// Financial summary
export async function getProjectServicesSummary(projectId: string): Promise<ServicesSummary>;
```

### Financial Recalculation

`syncServiceLineItem()` is called whenever:
- `showOnDocuments` changes
- Service pricing fields change (unitPrice, quantity, pricingType, duration, discount)
- A service is deleted

After syncing, call `recalculateProjectTotals()` to update the project total.

---

## 12. Validation Schemas

### `src/lib/validations/project-service.ts`

```typescript
import { z } from "zod";

export const projectServiceSchema = z.object({
  type: z.enum(["DELIVERY", "PICKUP", "BUMP_IN", "BUMP_OUT", "LABOUR", "MISC"]),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  notes: z.string().optional(),

  date: z.union([z.literal(""), z.coerce.date()]).optional()
    .transform(v => v === "" ? undefined : v),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  estimatedDuration: z.coerce.number().optional(),

  address: z.string().optional(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),

  showOnDocuments: z.boolean().default(false),
  unitPrice: z.coerce.number().optional(),
  quantity: z.coerce.number().min(1).default(1),
  pricingType: z.enum(["PER_DAY", "PER_HOUR", "FLAT"]).optional(),
  duration: z.coerce.number().optional(),
  discount: z.coerce.number().optional(),
  taxable: z.boolean().default(true),

  isSubcontracted: z.boolean().default(false),
  supplierId: z.string().optional(),
  subcontractCost: z.coerce.number().optional(),
  subcontractRef: z.string().optional(),

  vehicleDescription: z.string().optional(),
  numberOfTrips: z.coerce.number().optional(),
  distanceKm: z.coerce.number().optional(),

  crewCountRequired: z.coerce.number().optional(),
  crewRoleId: z.string().optional(),
});

export type ProjectServiceFormValues = z.input<typeof projectServiceSchema>;
```

---

## 13. PDF Document Changes

### Quote & Invoice PDFs

Add a "Services" section after the equipment table. Only services with `showOnDocuments: true` appear.

The section uses the same table styling but with different columns:
- Service name/title
- Date (formatted)
- Details (time, crew count, vehicle — varies by type)
- Price

### Packing List / Pull Sheet

Delivery and pickup services appear in a "Transport" section showing:
- Delivery/Pickup label
- Address
- Date and time
- Vehicle info
- Driver name(s)

### Call Sheet PDF

If the Crew Management feature is implemented, call sheets should include service details:
- For each day, show which services are happening alongside crew call times
- Delivery crew see the delivery address and vehicle
- Bump in/out crew see the schedule

### Delivery Docket PDF

If a project has delivery services, the delivery docket should pull data from the service:
- Delivery address (from `ProjectService.address`, falling back to `project.location.address`)
- Delivery date and time window
- Vehicle description
- Driver names (from `ServiceCrewAssignment`)

---

## 14. Routes & Pages

No new top-level routes. Services live on the project detail page:

| Location | Description |
|----------|-------------|
| `/projects/[id]` — Services tab | Main services view |
| `/settings/services` (new) | Service templates management |

### Settings Page

Add a new settings page for service templates:
- List of templates with type, title, default pricing, auto-add toggle
- Create/edit/delete templates
- Drag to reorder
- Toggle `isAutoAdded` per template

Add to settings sidebar:
```typescript
{ title: "Services", url: "/settings/services", icon: "Truck" }
```

---

## 15. Search & Slash Commands

### Slash Commands on Project Detail Page

Add to the project detail page commands (from slash commands spec):

| Command | Aliases | Action | Description |
|---------|---------|--------|-------------|
| `/services` | `ops`, `logistics` | Switch to Services tab | View project services |
| `/add-delivery` | `delivery` | Open add service dialog with DELIVERY pre-selected | Add a delivery |
| `/add-pickup` | `pickup`, `collection` | Open add service dialog with PICKUP pre-selected | Add a pickup |
| `/add-bumpin` | `bumpin`, `load-in`, `loadin` | Open add service dialog with BUMP_IN pre-selected | Add a bump in |
| `/add-bumpout` | `bumpout`, `load-out`, `loadout` | Open add service dialog with BUMP_OUT pre-selected | Add a bump out |
| `/add-labour` | `labor`, `crew-call` | Open add service dialog with LABOUR pre-selected | Add a labour service |

### Global Search

Services are not independently searchable in global search (they're always accessed via their project). But when searching for a project, the result could show a subtitle like "3 services, 8 crew" if useful.

---

## 16. Notifications

Add notification types:

| Type | Trigger | Link |
|------|---------|------|
| `service_uncrewed` | Service date is within 48 hours and crew count < required | `/projects/{id}` (Services tab) |
| `service_tomorrow` | Service is scheduled for tomorrow, status is still PLANNED (not confirmed) | `/projects/{id}` (Services tab) |
| `delivery_today` | Delivery or pickup service is scheduled for today | `/projects/{id}` (Services tab) |

---

## 17. Reporting Integration

If the Reporting feature is implemented, add a `services` data source:

### `services` Data Source
Fields: `type, title, date, startTime, endTime, status, showOnDocuments, unitPrice, quantity, lineTotal, isSubcontracted, subcontractCost, vehicleDescription, crewCountRequired, createdAt`
Joins: `project.projectNumber, project.name, project.client.name, project.location.name, supplier.name, crewRole.name`
Computed: `crewAssignedCount, crewShortfall, totalCrewCost, profitMargin` (lineTotal - subcontractCost - crewCost)

### Pre-Built Reports

| Report | Description |
|--------|-------------|
| **Delivery Schedule** | All delivery/pickup services for a date range, with addresses and crew |
| **Services by Project** | All services on a project with costs and crew |
| **Subcontracted Services** | All subcontracted services with supplier, cost, and margin |
| **Crew Utilisation on Services** | How many service hours each crew member worked |
| **Uncrewed Services** | Services missing crew (shortage report) |

---

## 18. Activity Log Integration

Log:
- Service created / updated / deleted
- Service status changed (with old → new status)
- Crew assigned / removed from service
- `showOnDocuments` toggled (impacts billing)
- Subcontract details changed

---

## 19. Project Templates

When saving a project as a template (`isTemplate: true`):
- Include `ProjectService` records (with their type, title, pricing, showOnDocuments, crewCountRequired)
- Strip specific dates, addresses, and crew assignments (these are project-specific)
- When creating a project from a template, services are duplicated with dates auto-populated from the new project's schedule

---

## 20. Organization Export/Import

Add to export/import:
- `ProjectService`
- `ServiceCrewAssignment`
- `ServiceTemplate`

Remap: `organizationId`, `projectId`, `lineItemId`, `supplierId`, `crewMemberId`, `crewRoleId`.

---

## 21. Project Sharing Integration

Add to `ShareScope` (from the Project Sharing spec):

```typescript
interface ShareScope {
  // ... existing fields ...
  showServices: boolean;              // Show the services list
  showServiceCrew: boolean;           // Show who's assigned to each service
  showServicePricing: boolean;        // Show service costs (separate from equipment pricing)
  showServiceAddresses: boolean;      // Show delivery/pickup addresses
}
```

Update the "Crew View" preset to include: `showServices: true, showServiceCrew: true, showServicePricing: false, showServiceAddresses: true`.

Update the "Client View" preset to include: `showServices: true, showServiceCrew: false, showServicePricing: true, showServiceAddresses: true`.

Update `loadScopedProjectData` to include/exclude services based on scope.

---

## 22. Mobile Considerations

### Services Tab on Mobile

- Service cards stack vertically (already the natural layout)
- Date group headers are sticky on scroll
- Swipe actions on service cards: swipe right to change status, swipe left for more options
- Crew count badge prominent (the shortage warning is the key mobile signal)
- "Get Directions" button on delivery/pickup services is large and tappable

### Service Form on Mobile

- Full-screen dialog with safe area padding
- Address uses the `AddressInput` component (mobile autocomplete dropdown)
- Crew picker is a separate step/screen (not inline on the form)

---

## 23. Implementation Phases

### Phase 1: Core Service Model & UI
1. Create `ProjectService` and `ServiceCrewAssignment` models, run migration
2. Service CRUD server actions
3. Services tab on project detail page with card layout
4. Create/edit service dialog with type-specific fields
5. Status workflow and status dropdown
6. Date grouping and ordering

### Phase 2: Financial & Document Integration
1. `showOnDocuments` toggle with line item sync
2. `syncServiceLineItem()` and `recalculateProjectTotals()` integration
3. Services section in Quote and Invoice PDFs
4. Services financial summary on the Services tab
5. Update project financial summary to include services subtotal

### Phase 3: Crew & Address Integration
1. Service crew assignment CRUD
2. Crew picker dialog on services (search, availability, role assignment)
3. Crew shortage warnings
4. `AddressInput` on delivery/pickup services
5. Map display on service cards
6. Sync service crew to project-level `CrewAssignment` records

### Phase 4: Templates & Polish
1. `ServiceTemplate` model and settings page
2. Auto-add services from templates on project creation
3. Quick-add from templates on Services tab
4. Delivery docket PDF integration
5. Slash commands
6. Notifications (uncrewed, upcoming)
7. Reporting data source and pre-built reports
8. Project sharing scope fields

---

## Notes

- **Services and line items coexist.** The old `SERVICE`, `LABOUR`, `TRANSPORT` line item types still work for simple text-only billing rows. The new `ProjectService` model is for structured operational management. Over time, users will naturally migrate to using services instead of typing service descriptions into line items.
- **The Services tab is the operational view; line items are the financial view.** A service with `showOnDocuments: false` never appears on the Equipment tab or any PDF — it's purely for internal scheduling.
- **Service crew assignments and project crew assignments are related but separate.** Services are the granular operational level ("who's driving the truck at 6am"). Project crew is the overview level ("who's on this project for the bump in phase"). Services push up to project crew, but not the reverse.
- **Date inheritance:** When services are auto-created from templates, they inherit dates from the project schedule. When project dates change, offer to update service dates too (with a confirmation dialog — don't silently change them since the user may have manually adjusted).
- **Subcontracting mirrors subhire.** Just as equipment can be subhired from a supplier, services can be subcontracted. The `supplierId` and `subcontractCost` fields enable tracking what you pay a third party for a service vs what you charge the client.
- **Current RMS calls these "bookable services" and uses a Resource Planner to allocate people/vehicles.** GearFlow's approach is simpler — services are project-scoped records with crew assignments, not a separate resource booking system. This keeps the mental model straightforward: services belong to projects, crew are assigned to services.
