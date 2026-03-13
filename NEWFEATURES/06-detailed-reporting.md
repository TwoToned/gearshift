# Feature: Detailed & Customisable Reporting System

## Summary

Build a comprehensive reporting system that provides both pre-built reports (asset popularity, history, utilisation, location usage, etc.) and a custom report builder UI where users can create their own reports by selecting data scopes, filters, groupings, and output formats. All reports should be exportable as CSV and PDF.

## Current State

- `/reports` page exists with basic stats (project counts by status, revenue calculations, asset utilisation)
- `src/server/reports.ts` provides simple aggregate data
- Test & Tag module has its own 10 report types (separate system, keep as-is)
- Dashboard has summary cards but no drill-down reporting

## Architecture Overview

### Two-Tier System

1. **Pre-Built Reports** — ready-to-use report templates covering the most common needs, accessible from a report library
2. **Custom Report Builder** — a UI that lets users compose their own reports by choosing a data source, columns, filters, grouping, and sorting

Both tiers use the same underlying query engine on the server.

## Data Model

### New Prisma Model: `SavedReport`

Users can save custom report configurations for reuse.

```prisma
model SavedReport {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  name            String
  description     String?
  dataSource      String           // "assets", "models", "projects", "kits", "lineItems", "clients", "locations", "maintenance", "testTag", "activityLog"
  config          Json             // Full report config (see below)
  createdById     String?
  createdBy       User?    @relation(fields: [createdById], references: [id], onDelete: SetNull)
  isShared        Boolean  @default(false)   // Visible to all org members
  isPinned        Boolean  @default(false)   // Pinned to reports dashboard

  lastRunAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([organizationId])
  @@index([organizationId, createdById])
}
```

### Report Config JSON Structure

```typescript
interface ReportConfig {
  dataSource: DataSource;
  columns: ColumnConfig[];        // Which columns to include
  filters: FilterConfig[];        // WHERE conditions
  groupBy?: GroupByConfig;        // GROUP BY
  sortBy?: SortConfig[];          // ORDER BY
  dateRange?: {                   // Global date range filter
    field: string;                // Which date field to use
    start?: string;               // ISO date
    end?: string;
    preset?: string;              // "last7days", "last30days", "thisMonth", "lastMonth", "thisQuarter", "thisYear", etc.
  };
  aggregations?: AggregationConfig[];  // SUM, COUNT, AVG on numeric columns
  limit?: number;                      // Max rows
  includeInactive?: boolean;           // Include retired/inactive records
}

interface ColumnConfig {
  field: string;         // Field path: "assetTag", "model.name", "model.category.name"
  label?: string;        // Custom column header
  visible: boolean;
  width?: number;
}

interface FilterConfig {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "not_contains" | "gt" | "gte" | "lt" | "lte" | "in" | "not_in" | "is_empty" | "is_not_empty" | "between";
  value: string | number | boolean | string[] | [string, string];
}

interface GroupByConfig {
  field: string;         // e.g. "model.category.name", "status", "location.name"
  aggregateColumns: {
    field: string;
    function: "count" | "sum" | "avg" | "min" | "max";
    label?: string;
  }[];
}

interface SortConfig {
  field: string;
  direction: "asc" | "desc";
}
```

## Data Sources & Available Fields

Each data source defines the fields a report can access. Fields include direct columns and joined relations.

### `assets` Data Source
Fields: `assetTag, customName, serialNumber, status, condition, purchaseDate, purchasePrice, warrantyExpiry, notes, tags, isActive, createdAt, updatedAt`
Joins: `model.name, model.manufacturer, model.modelNumber, model.category.name, model.defaultRentalPrice, model.replacementCost, model.weight, model.powerDraw, location.name, location.type, supplier.name, kit.name, kit.assetTag`
Computed: `totalRentalRevenue` (sum of line item totals for this asset), `totalCheckouts` (count), `daysSincePurchase`, `daysUntilWarrantyExpiry`, `currentProject` (if checked out)

### `models` Data Source
Fields: `name, manufacturer, modelNumber, description, defaultRentalPrice, defaultPurchasePrice, replacementCost, weight, powerDraw, assetType, isActive, createdAt`
Joins: `category.name`
Computed: `totalAssetCount, availableCount, checkedOutCount, inMaintenanceCount, totalRevenue, averageUtilisation` (percentage of time assets are checked out vs available), `popularity` (number of times added to projects), `lastUsedDate`

### `projects` Data Source
Fields: `projectNumber, name, status, type, description, loadInDate, eventStartDate, eventEndDate, loadOutDate, rentalStartDate, rentalEndDate, subtotal, discountPercent, discountAmount, taxAmount, total, depositPercent, depositPaid, invoicedTotal, tags, createdAt`
Joins: `client.name, client.type, location.name, projectManager.name`
Computed: `durationDays, lineItemCount, totalEquipmentItems, isOverdue, daysTillEvent, profitMargin` (if cost data available), `crewCount` (number of confirmed crew assignments), `totalLabourCost` (sum of crew assignment estimated costs), `totalProjectCost` (equipment + labour)

### `kits` Data Source
Fields: `assetTag, name, description, status, condition, weight, caseType, caseDimensions, notes, tags, createdAt`
Joins: `category.name, location.name`
Computed: `itemCount, totalValue` (sum of asset replacement costs), `totalCheckouts, lastUsedDate, currentProject`

### `lineItems` Data Source (for detailed rental analysis)
Fields: `type, description, quantity, unitPrice, pricingType, duration, discount, lineTotal, groupName, isOptional, status, isSubhire, sortOrder, notes`
Joins: `project.projectNumber, project.name, project.status, project.client.name, model.name, model.category.name, asset.assetTag, kit.name, supplier.name`
Computed: `effectivePrice` (after discount)

### `clients` Data Source
Fields: `name, type, contactName, contactEmail, contactPhone, paymentTerms, defaultDiscount, tags, isActive, createdAt`
Computed: `totalProjects, totalRevenue, averageProjectValue, lastProjectDate, activeProjectCount`

### `locations` Data Source
Fields: `name, address, type, isDefault, notes, createdAt`
Joins: `parent.name`
Computed: `assetCount, kitCount, projectCount` (projects at this location)

### `maintenance` Data Source
Fields: `title, type, status, description, scheduledDate, completedDate, cost, result, createdAt`
Joins: `reportedBy.name, assignedTo.name`
Computed: `assetCount` (assets on the record), `daysOpen` (scheduled to completed)

### `activityLog` Data Source (if Activity Log feature is implemented)
Fields: `action, entityType, entityName, summary, createdAt`
Joins: `user.name`

### `crew` Data Source (requires Crew Management feature)
Fields: `firstName, lastName, email, phone, type, status, department, defaultDayRate, defaultHourlyRate, tags, isActive, createdAt`
Joins: `skills.name, certifications.name`
Computed: `totalAssignments` (count of all assignments), `confirmedAssignments` (count of CONFIRMED/COMPLETED), `totalHoursWorked` (sum of time entries), `totalCost` (sum of assignment estimated costs), `lastProjectDate`, `averageRating` (if ratings implemented), `acceptanceRate` (accepted / offered)

### `crewAssignments` Data Source (requires Crew Management feature)
Fields: `status, phase, isProjectManager, startDate, endDate, startTime, endTime, rateOverride, rateType, estimatedHours, estimatedCost, createdAt`
Joins: `crewMember.firstName, crewMember.lastName, crewMember.type, crewMember.department, crewRole.name, project.projectNumber, project.name, project.status, project.client.name, project.location.name`
Computed: `actualHours` (from time entries), `actualCost`, `costVariance` (estimated vs actual)

## Pre-Built Report Templates

These are displayed as cards in a report library. Clicking one runs it immediately with sensible defaults. Users can customise filters and re-save as their own.

### Asset Reports

| Report | Description | Key Config |
|--------|-------------|------------|
| **Asset Inventory** | Complete list of all assets with status and location | dataSource: assets, all core fields, grouped by status |
| **Asset Utilisation** | How often each asset model is rented out | dataSource: models, computed: averageUtilisation, sorted by utilisation desc |
| **Model Popularity** | Most frequently booked models | dataSource: models, computed: popularity, sorted by popularity desc |
| **Asset Value** | Total value of inventory by category | dataSource: assets, grouped by model.category.name, aggregation: sum(purchasePrice), sum(replacementCost) |
| **Assets Due for Maintenance** | Assets approaching or past maintenance due date | dataSource: assets, filter: maintenance due within X days |
| **Asset History** | Full checkout history for a specific asset | dataSource: lineItems, filter: assetId = (user selects), sorted by project date |
| **Warranty Expiry** | Assets with warranties expiring soon | dataSource: assets, filter: warrantyExpiry within next 90 days, sorted by warrantyExpiry asc |

### Project Reports

| Report | Description | Key Config |
|--------|-------------|------------|
| **Project Summary** | All projects by status with financial totals | dataSource: projects, grouped by status, aggregation: count, sum(total) |
| **Revenue by Client** | Total revenue grouped by client | dataSource: projects, grouped by client.name, aggregation: sum(total), filter: status in [COMPLETED, INVOICED] |
| **Revenue by Month** | Monthly revenue trend | dataSource: projects, grouped by month(rentalStartDate), aggregation: sum(total) |
| **Overdue Returns** | Projects past their return date | dataSource: projects, filter: rentalEndDate < today AND status in active statuses |
| **Projects by Location** | List of all projects at a venue/location | dataSource: projects, grouped by location.name |
| **Subhire Summary** | All subhired items across projects | dataSource: lineItems, filter: isSubhire = true, grouped by supplier.name |
| **Project Profitability** | Revenue vs total cost (equipment + labour + subhire) per project | dataSource: projects, computed: totalProjectCost, profitMargin, sorted by profitMargin desc |

### Kit Reports

| Report | Description | Key Config |
|--------|-------------|------------|
| **Kit Inventory** | All kits with contents summary | dataSource: kits, all core fields + itemCount |
| **Kit Utilisation** | Kit checkout frequency | dataSource: kits, computed: totalCheckouts, sorted desc |

### Client Reports

| Report | Description | Key Config |
|--------|-------------|------------|
| **Client Revenue** | Revenue per client with project count | dataSource: clients, computed: totalRevenue, totalProjects |
| **Top Clients** | Highest revenue clients | dataSource: clients, computed: totalRevenue, sorted desc, limit: 20 |
| **Client Activity** | Clients sorted by last project date | dataSource: clients, computed: lastProjectDate, sorted desc |

### Maintenance Reports

| Report | Description | Key Config |
|--------|-------------|------------|
| **Maintenance Costs** | Total maintenance spend by type | dataSource: maintenance, grouped by type, aggregation: sum(cost), count |
| **Open Maintenance** | All incomplete maintenance records | dataSource: maintenance, filter: status in [SCHEDULED, IN_PROGRESS] |

### Crew Reports (requires Crew Management feature)

| Report | Description | Key Config |
|--------|-------------|------------|
| **Crew Roster** | Full crew list with skills, department, rates, and status | dataSource: crew, all core fields, grouped by department |
| **Crew Utilisation** | How many days/projects each crew member has worked | dataSource: crewAssignments, grouped by crewMember, aggregation: count, sum(estimatedHours), filter: status in [CONFIRMED, COMPLETED] |
| **Crew Availability** | Who is available for a given date range | dataSource: crew, computed filter: no conflicting assignments or availability blocks in selected date range |
| **Project Crew Summary** | All crew assigned to a specific project with roles, phases, and costs | dataSource: crewAssignments, filter: projectId = (user selects), grouped by phase |
| **Labour Cost by Project** | Total labour cost per project | dataSource: crewAssignments, grouped by project.name, aggregation: sum(estimatedCost), sum(actualCost), filter: status in [CONFIRMED, COMPLETED] |
| **Labour Cost by Month** | Monthly labour spend trend | dataSource: crewAssignments, grouped by month(startDate), aggregation: sum(estimatedCost) |
| **Crew Cost Variance** | Estimated vs actual hours/cost per assignment | dataSource: crewAssignments, computed: costVariance, sorted by variance desc, filter: status = COMPLETED |
| **Freelancer Spend** | Total spend on freelancers grouped by crew member | dataSource: crewAssignments, filter: crewMember.type = FREELANCER, grouped by crewMember, aggregation: sum(estimatedCost) |
| **Crew Skills Matrix** | Which crew members have which skills | dataSource: crew, columns: name + all skills as boolean columns |
| **Certification Expiry** | Crew certifications expiring within a date range | dataSource: crew (certifications sub-query), filter: expiryDate within range, sorted by expiryDate asc |
| **Timesheet Summary** | Approved hours by crew member for a date range | dataSource: crewAssignments (time entries sub-query), grouped by crewMember, aggregation: sum(totalHours), filter: timeEntry.status = APPROVED |
| **Offer Response Rates** | How quickly and how often crew accept offers | dataSource: crewAssignments, grouped by crewMember, computed: acceptanceRate, avgResponseTime |

## Server Actions

### `src/server/reports.ts` — Expand Significantly

```typescript
"use server";

// Report execution engine
export async function runReport(config: ReportConfig): Promise<ReportResult> {
  const { organizationId } = await getOrgContext();
  await requirePermission("reports", "read");
  // Build Prisma query from config
  // Execute query
  // Compute any computed fields
  // Return { rows, totals, metadata }
}

export async function runReportCSV(config: ReportConfig): Promise<string> {
  // Same as runReport but returns CSV string
}

// Saved report CRUD
export async function saveReport(data: SaveReportInput): Promise<SavedReport> { ... }
export async function updateSavedReport(id: string, data: Partial<SaveReportInput>): Promise<SavedReport> { ... }
export async function deleteSavedReport(id: string): Promise<void> { ... }
export async function getSavedReports(): Promise<SavedReport[]> { ... }
export async function getSavedReportById(id: string): Promise<SavedReport> { ... }

// Pre-built report shortcuts (call runReport with predefined configs)
export async function getAssetUtilisationReport(filters?: ReportFilters): Promise<ReportResult> { ... }
export async function getModelPopularityReport(filters?: ReportFilters): Promise<ReportResult> { ... }
export async function getRevenueByClientReport(filters?: ReportFilters): Promise<ReportResult> { ... }
// ... etc for each pre-built report
```

### Query Builder Engine (`src/lib/report-engine.ts`)

The core engine that translates `ReportConfig` into Prisma queries:

```typescript
export function buildReportQuery(
  config: ReportConfig,
  organizationId: string
): {
  where: Record<string, unknown>;
  select: Record<string, unknown>;
  orderBy: Record<string, unknown>[];
  groupBy?: string[];
  skip?: number;
  take?: number;
} {
  // 1. Start with organizationId filter
  // 2. Apply config.filters as Prisma where conditions
  // 3. Apply config.dateRange
  // 4. Map config.columns to Prisma select (including joins)
  // 5. Map config.sortBy to Prisma orderBy
  // 6. Handle groupBy with aggregations
  // 7. Apply limit
}
```

For computed fields that can't be done in Prisma (like utilisation percentages), compute them in a post-processing step after the query returns.

For groupBy reports, use `prisma.$queryRaw` or Prisma's `groupBy()` API depending on complexity.

## Routes & Pages

| Route | Page | Description |
|-------|------|-------------|
| `/reports` | Report dashboard | Library of pre-built + saved reports, with cards/tiles |
| `/reports/[id]` | View saved report | Run and display a saved report with current filters |
| `/reports/builder` | Custom report builder | Full builder UI |
| `/reports/builder/[id]` | Edit saved report | Builder pre-loaded with saved config |

### Report Dashboard (`/reports`)

Layout:
- **Quick Stats** section at top (same as current: total assets, revenue, active projects, etc.)
- **Pinned Reports** section: cards for reports the user has pinned
- **Pre-Built Reports** section: categorised cards (Asset Reports, Project Reports, Client Reports, etc.)
- **My Reports** section: user's saved custom reports with run/edit/delete actions
- **Shared Reports** section: reports shared by other org members
- "New Custom Report" button → navigates to `/reports/builder`

### Report Viewer (shared component used by pre-built and saved reports)

When a report runs, display:
- **Filter bar** at top: shows active filters with edit/remove capability, date range picker
- **Data table**: sortable columns, paginated, shows all configured columns
- **Summary row**: aggregation totals (sum, count, avg) at the bottom of relevant columns
- **Chart** (optional): if the report has a groupBy, show a bar/pie chart above the table
- **Export buttons**: CSV, PDF
- **Save/Save As**: save current configuration as a named report

### Custom Report Builder (`/reports/builder`)

A step-by-step or multi-panel builder UI:

**Step 1: Choose Data Source**
- Card selection: Assets, Models, Projects, Kits, Line Items, Clients, Locations, Maintenance
- Each card shows an icon, description, and available field count

**Step 2: Choose Columns**
- Checkbox list of all available fields for the chosen data source
- Organised into sections: "Core Fields", "Related Data" (joins), "Computed Fields"
- Drag to reorder columns
- Each column has an optional custom label input

**Step 3: Add Filters**
- "Add Filter" button → field picker → operator picker → value input
- Multiple filters combined with AND logic
- Date range filter has preset buttons (This Week, This Month, Last 30 Days, This Quarter, This Year, Custom)
- Value inputs should be smart: enum fields get a dropdown, relation fields get a searchable picker, dates get a date picker, etc.

**Step 4: Group & Aggregate (optional)**
- Toggle "Group results"
- If on: pick grouping field, then configure aggregation for numeric columns (count, sum, avg, min, max)

**Step 5: Sort & Limit**
- Pick sort field and direction
- Optional row limit

**Step 6: Preview & Save**
- "Run Preview" button shows the first 50 rows
- "Save Report" opens a dialog for name, description, shared toggle
- "Export CSV" and "Export PDF" available from preview

The builder should show a live preview panel that updates as the user changes configuration, or at least a "Refresh Preview" button.

## PDF Export for Reports

Create a generic report PDF template (`src/lib/pdf/report-pdf.tsx`) that accepts:
- Report title and description
- Column definitions
- Row data
- Optional summary/aggregation row
- Date range and filter descriptions
- Organization branding (name, logo if available)

This is a simple table-based PDF — no need for complex layouts. Use the same Helvetica constraint and ASCII-only rules as other GearFlow PDFs.

## Permissions

Reports use the existing `reports` resource:
- `reports: read` — view and run reports
- `reports: create` — save custom reports (maps to having the save ability)
- `reports: update` — edit saved reports
- `reports: delete` — delete saved reports

Data access within reports is implicitly scoped by `organizationId` — users can only see data from their own org.

## Search & Navigation

### Page Commands
```typescript
{
  label: "Reports",
  href: "/reports",
  aliases: ["analytics", "statistics", "data"],
  icon: "BarChart3",
  description: "Reports and analytics",
  children: [
    { label: "Custom Report Builder", href: "/reports/builder", aliases: ["new report", "create report", "build report"] },
  ]
}
```

### Sidebar
Already exists — update if needed to ensure the reports icon and link are prominent.

## Organization Export/Import

Add `SavedReport` to:
- `src/lib/org-export.ts`
- `src/lib/org-import.ts`
- Remap `organizationId`, `createdById`

## Validation

### `src/lib/validations/report.ts`

Zod schemas for:
- `SavedReport` creation (name, description, config)
- `ReportConfig` structure validation
- `FilterConfig` validation (ensure operator is valid for field type)

## Notes

- The report engine should be efficient — use Prisma's built-in aggregation and groupBy where possible, avoid fetching all rows into memory for large datasets.
- For very large reports, consider server-side pagination: the table shows page 1 by default, and exports stream all rows.
- Computed fields (utilisation, popularity, revenue totals) may require multiple queries or raw SQL. That's fine — just cache the results for the duration of the report run.
- Pre-built reports are just predefined `ReportConfig` objects — they use the same engine as custom reports. Users can "Customise" a pre-built report, which copies its config to the builder.
- Consider adding scheduled reports later (email a report PDF weekly/monthly). Out of scope for now but design the `SavedReport` model to support it (add `schedule`, `recipients` fields later).
- Charts are nice-to-have for v1. A simple bar chart for grouped reports using recharts (already a dependency) would be sufficient. Pie charts for categorical groupings.
