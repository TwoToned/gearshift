# Feature: Advanced Data Tables — Filtering, Column Management & Persistent Preferences

## Summary

Upgrade every data table in GearFlow to a standardised advanced table system with multi-column filtering (checkbox dropdown lists for enums/statuses), sorting, column reordering via drag-and-drop, column show/hide toggles, and persistent per-table preferences stored in localStorage. This replaces the current ad-hoc table implementations with a single, consistent `DataTable` component used across the entire app.

---

## Table of Contents

1. [Current State](#1-current-state)
2. [Design Goals](#2-design-goals)
3. [DataTable Component](#3-datatable-component)
4. [Column Definitions](#4-column-definitions)
5. [Filtering System](#5-filtering-system)
6. [Sorting](#6-sorting)
7. [Column Reordering](#7-column-reordering)
8. [Column Visibility](#8-column-visibility)
9. [Persistent Preferences](#9-persistent-preferences)
10. [Table Toolbar](#10-table-toolbar)
11. [Tables to Upgrade](#11-tables-to-upgrade)
12. [Server-Side vs Client-Side](#12-server-side-vs-client-side)
13. [Responsive Behaviour](#13-responsive-behaviour)
14. [Accessibility](#14-accessibility)
15. [Implementation Approach](#15-implementation-approach)
16. [Implementation Phases](#16-implementation-phases)

---

## 1. Current State

The codebase currently has:

- **`SortableTableHead`** (`src/components/ui/sortable-table-head.tsx`) — clickable column headers with sort direction indicators
- **`PageSizeSelect`** — page size dropdown (same file)
- **`useTablePreferences`** (`src/lib/use-table-preferences.ts`) — persists sort field, sort direction, page size, and view mode to localStorage per table key
- **Responsive column hiding** — uses Tailwind classes (`hidden sm:table-cell`, `hidden md:table-cell`) to progressively show columns at different breakpoints
- **No column reordering** — columns are hardcoded in render order
- **No column show/hide toggles** — visibility is breakpoint-only
- **No multi-column filtering** — some tables have a search input and maybe one status filter dropdown, but no standardised filtering pattern
- **Each table is hand-built** — no shared table component; every list page builds its own `<Table>` with inline mapping

---

## 2. Design Goals

1. **One component for all tables.** A single `DataTable` component used everywhere, configured via column definitions. No more hand-building tables.
2. **Consistent filtering.** Every filterable column gets the same filter UI — a dropdown with checkboxes for enum/status columns, a text search for string columns, a date range for date columns.
3. **User-controlled columns.** Users choose which columns to see, in what order, and those choices persist across sessions.
4. **Zero regression.** The upgrade replaces table markup, not business logic. Server actions, data fetching, and page structure remain the same.
5. **Mobile-first.** On small screens, the table degrades gracefully — fewer columns, card-style layout option, horizontal scroll if needed.

---

## 3. DataTable Component

### `src/components/ui/data-table.tsx`

The central component that replaces all hand-built tables.

```typescript
interface DataTableProps<TData> {
  // Data
  data: TData[];
  columns: ColumnDef<TData>[];
  
  // Pagination (server-side)
  totalRows?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;

  // Sorting (server-side)
  sortField?: string;
  sortDirection?: "asc" | "desc";
  onSortChange?: (field: string, direction: "asc" | "desc") => void;

  // Filtering (server-side)
  filters?: Record<string, FilterValue>;
  onFiltersChange?: (filters: Record<string, FilterValue>) => void;

  // Search
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  // Preferences
  tableKey: string;           // Unique key for localStorage persistence (e.g. "assets", "projects")

  // Features
  enableColumnReorder?: boolean;   // Default: true
  enableColumnVisibility?: boolean; // Default: true
  enableFiltering?: boolean;        // Default: true
  enableSearch?: boolean;           // Default: true

  // Selection (optional)
  enableRowSelection?: boolean;
  selectedRows?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  getRowId?: (row: TData) => string;

  // Actions
  onRowClick?: (row: TData) => void;
  bulkActions?: BulkAction[];

  // Empty state
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };

  // Loading
  isLoading?: boolean;
}
```

### Usage Example

```typescript
// On the assets list page:
<DataTable
  tableKey="assets-registry"
  data={assets}
  columns={assetColumns}
  totalRows={total}
  page={page}
  pageSize={pageSize}
  onPageChange={setPage}
  onPageSizeChange={setPageSize}
  sortField={sort}
  sortDirection={order}
  onSortChange={(field, dir) => { setSort(field); setOrder(dir); }}
  filters={filters}
  onFiltersChange={setFilters}
  searchValue={search}
  onSearchChange={setSearch}
  searchPlaceholder="Search assets..."
  onRowClick={(asset) => router.push(`/assets/registry/${asset.id}`)}
  isLoading={isLoading}
  emptyTitle="No assets found"
  emptyDescription="Create your first asset to get started."
  emptyAction={{ label: "Add Asset", onClick: () => router.push("/assets/registry/new") }}
/>
```

---

## 4. Column Definitions

### `ColumnDef<TData>` Interface

```typescript
interface ColumnDef<TData> {
  // Identity
  id: string;                          // Unique column identifier (used for persistence)
  header: string;                      // Display name in header and column visibility menu

  // Rendering
  accessorKey?: keyof TData | string;  // Dot-path to the data field (e.g. "model.name")
  cell?: (row: TData) => ReactNode;    // Custom cell renderer (overrides default text display)

  // Sorting
  sortable?: boolean;                  // Default: true if accessorKey is set
  sortKey?: string;                    // Server-side sort field (if different from accessorKey)

  // Filtering
  filterable?: boolean;                // Default: false
  filterType?: FilterType;             // "enum" | "text" | "date" | "number" | "boolean"
  filterOptions?: FilterOption[];      // For enum filters: the list of options
  filterKey?: string;                  // Server-side filter field (if different from accessorKey)

  // Visibility & ordering
  defaultVisible?: boolean;            // Default: true. Set false for columns hidden by default.
  alwaysVisible?: boolean;             // Default: false. If true, can't be hidden (e.g. name/title column)
  defaultOrder?: number;               // Initial position in column order (0-based)

  // Sizing
  width?: number | string;             // Fixed width (px or %)
  minWidth?: number;                   // Minimum width in px
  maxWidth?: number;                   // Maximum width in px
  responsiveHide?: "sm" | "md" | "lg" | "xl";  // Breakpoint below which column auto-hides

  // Behaviour
  sticky?: "left" | "right";          // Stick column to edge (for name or actions columns)
  align?: "left" | "center" | "right";
  truncate?: boolean;                  // Truncate with ellipsis (default: true for text)
}

type FilterType = "enum" | "text" | "date" | "number" | "boolean";

interface FilterOption {
  value: string;
  label: string;
  icon?: string;        // Lucide icon name
  color?: string;       // For status badges
  count?: number;       // Optional: show count next to option
}

type FilterValue =
  | string[]            // For enum: selected values
  | string              // For text: search string
  | { from?: string; to?: string }  // For date: range
  | { min?: number; max?: number }  // For number: range
  | boolean;            // For boolean
```

### Column Definition Example

```typescript
const assetColumns: ColumnDef<Asset>[] = [
  {
    id: "assetTag",
    header: "Asset Tag",
    accessorKey: "assetTag",
    alwaysVisible: true,
    sticky: "left",
    width: 120,
  },
  {
    id: "model",
    header: "Model",
    accessorKey: "model.name",
    cell: (row) => (
      <div>
        <div className="font-medium">{row.model.name}</div>
        <div className="text-xs text-muted-foreground">{row.model.manufacturer}</div>
      </div>
    ),
    sortKey: "model.name",
  },
  {
    id: "status",
    header: "Status",
    accessorKey: "status",
    filterable: true,
    filterType: "enum",
    filterOptions: [
      { value: "AVAILABLE", label: "Available", color: "green" },
      { value: "CHECKED_OUT", label: "Checked Out", color: "blue" },
      { value: "IN_MAINTENANCE", label: "In Maintenance", color: "amber" },
      { value: "RESERVED", label: "Reserved", color: "purple" },
      { value: "RETIRED", label: "Retired", color: "gray" },
      { value: "LOST", label: "Lost", color: "red" },
    ],
    cell: (row) => <StatusBadge status={row.status} />,
    width: 140,
  },
  {
    id: "condition",
    header: "Condition",
    accessorKey: "condition",
    filterable: true,
    filterType: "enum",
    filterOptions: [
      { value: "NEW", label: "New" },
      { value: "GOOD", label: "Good" },
      { value: "FAIR", label: "Fair" },
      { value: "POOR", label: "Poor" },
      { value: "DAMAGED", label: "Damaged" },
    ],
    defaultVisible: false,  // Hidden by default, user can enable
  },
  {
    id: "location",
    header: "Location",
    accessorKey: "location.name",
    filterable: true,
    filterType: "enum",
    // filterOptions populated dynamically from location list
    responsiveHide: "md",  // Hidden on mobile, shown on md+
  },
  {
    id: "category",
    header: "Category",
    accessorKey: "model.category.name",
    filterable: true,
    filterType: "enum",
    responsiveHide: "lg",
  },
  {
    id: "purchaseDate",
    header: "Purchase Date",
    accessorKey: "purchaseDate",
    filterable: true,
    filterType: "date",
    cell: (row) => row.purchaseDate ? formatDate(row.purchaseDate) : "—",
    defaultVisible: false,
  },
  {
    id: "tags",
    header: "Tags",
    accessorKey: "tags",
    cell: (row) => <TagBadges tags={row.tags} />,
    filterable: true,
    filterType: "enum",
    // filterOptions populated dynamically from org tags
    defaultVisible: false,
  },
];
```

---

## 5. Filtering System

### Filter UI: Dropdown with Checkboxes

For **enum/status** filters (the most common type):

1. The column header shows a small filter icon (funnel) when filterable
2. Clicking the filter icon opens a dropdown popover anchored to the header
3. The dropdown contains:
   - A search input at the top to filter the list of options (for long lists like locations, categories)
   - A "Select All" / "Clear All" toggle
   - A scrollable list of checkboxes, one per option
   - Each checkbox shows the option label, optional icon/colour, and optional count
   - Selected options are checked
4. Selecting/deselecting an option immediately updates the filter (no "Apply" button needed)
5. When any filter is active, the filter icon fills in / changes colour to indicate a filter is applied
6. Active filters are also shown as chips in the toolbar above the table (see Table Toolbar section)

### Filter Types

| Type | UI | Behaviour |
|------|------|-----------|
| **enum** | Checkbox dropdown list | Multi-select: show rows matching ANY selected value. All unchecked = show all (no filter). |
| **text** | Text input in dropdown | Case-insensitive contains match |
| **date** | Date range picker (from/to) | Show rows where the date is within the range. Either bound can be empty. |
| **number** | Min/max number inputs | Show rows where the value is within the range |
| **boolean** | Two checkboxes (Yes/No) or toggle | Show rows matching the selected boolean value |

### Dynamic Filter Options

Some enum filters have static options (status enums defined in the schema). Others need dynamic options loaded from the database:
- **Location**: fetched from org's locations
- **Category**: fetched from org's categories
- **Tags**: fetched from org's tag pool
- **Client**: fetched from org's clients (for project tables)
- **Crew Role**: fetched from org's crew roles (for crew tables)
- **Supplier**: fetched from org's suppliers

The `DataTable` component accepts `filterOptions` on the column definition. For dynamic options, the parent page fetches them (e.g. via a useQuery for locations) and passes them into the column definition. A helper function `useDynamicFilterOptions(entityType)` can standardise this.

### Filter State

Filters are stored as a `Record<string, FilterValue>` object:

```typescript
// Example filter state:
{
  "status": ["AVAILABLE", "CHECKED_OUT"],     // Enum: selected values
  "category": ["Audio", "Lighting"],           // Enum: selected values
  "purchaseDate": { from: "2025-01-01", to: "2025-12-31" },  // Date range
  "tags": ["fragile", "priority"],             // Enum (tags)
}
```

This state is lifted to the parent page and passed to the server action as filter parameters.

### Server-Side Filtering

Filters are applied server-side in the Prisma query. The server action receives the filter object and translates it to Prisma `where` clauses:

```typescript
// In the server action:
function buildFilterWhere(filters: Record<string, FilterValue>, columnDefs: ColumnDef[]) {
  const where: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filters)) {
    const col = columnDefs.find(c => c.filterKey === key || c.id === key);
    if (!col || !value) continue;

    switch (col.filterType) {
      case "enum":
        if (Array.isArray(value) && value.length > 0) {
          where[key] = { in: value };
        }
        break;
      case "text":
        if (typeof value === "string" && value.length > 0) {
          where[key] = { contains: value, mode: "insensitive" };
        }
        break;
      case "date":
        if (typeof value === "object" && "from" in value) {
          where[key] = {};
          if (value.from) where[key].gte = new Date(value.from);
          if (value.to) where[key].lte = new Date(value.to);
        }
        break;
      case "number":
        if (typeof value === "object" && "min" in value) {
          where[key] = {};
          if (value.min != null) where[key].gte = value.min;
          if (value.max != null) where[key].lte = value.max;
        }
        break;
      case "boolean":
        if (typeof value === "boolean") {
          where[key] = value;
        }
        break;
    }
  }
  return where;
}
```

A shared `buildFilterWhere` utility function in `src/lib/table-utils.ts` standardises this for all server actions.

---

## 6. Sorting

### Existing Behaviour (keep)

`SortableTableHead` already handles clickable headers with sort indicators. The `DataTable` wraps this pattern:

- Click a header to sort ascending
- Click again to sort descending
- Click again to clear sort (or cycle back to ascending)
- Sort state is a single `{ field, direction }` pair (single-column sort only for v1)

### Integration with DataTable

The `DataTable` component renders sortable headers for every column with `sortable: true` (default when `accessorKey` is set). The `onSortChange` callback is called with `(field, direction)`.

### Multi-Column Sort (stretch goal)

For v2, support secondary sort: hold Shift and click a second column to add it as a tiebreaker. The sort state becomes an array:
```typescript
[{ field: "status", direction: "asc" }, { field: "assetTag", direction: "asc" }]
```

For v1, single-column sort is sufficient.

---

## 7. Column Reordering

### Drag-and-Drop Column Headers

Users can drag column headers left/right to reorder columns. Implementation:

1. Each `<th>` has a drag handle (the header text itself, or a small grip icon)
2. Dragging a header shows a visual indicator of where it will be placed
3. Dropping the header reorders the columns
4. The new order is saved to preferences (see Persistent Preferences)

### Implementation

Use a lightweight drag library or native HTML Drag and Drop API on the `<thead>` row. The column order is stored as an array of column IDs:

```typescript
// Stored in preferences:
columnOrder: ["assetTag", "model", "status", "location", "category", "purchaseDate"]
```

When rendering, the `DataTable` maps the stored order to column definitions. Columns not in the order array (e.g. newly added columns) are appended at the end.

### Constraints

- Columns with `sticky: "left"` or `alwaysVisible: true` stay pinned and can't be moved past the sticky boundary
- The actions column (if present) is always last and can't be reordered

---

## 8. Column Visibility

### Column Visibility Menu

A button in the table toolbar (icon: `Columns3` or `SlidersHorizontal`) opens a popover/dropdown showing all available columns with toggles:

```
┌─ Columns ──────────────────┐
│ ☑ Asset Tag        (locked) │  ← alwaysVisible columns show as checked and disabled
│ ☑ Model                     │
│ ☑ Status                    │
│ ☑ Location                  │
│ ☐ Condition                 │  ← unchecked = hidden
│ ☐ Category                  │
│ ☐ Purchase Date              │
│ ☐ Purchase Price             │
│ ☐ Tags                       │
│ ☐ Serial Number              │
│ ☐ Supplier                   │
│ ☐ Warranty Expiry            │
│──────────────────────────── │
│ [Reset to Default]           │
└──────────────────────────────┘
```

### Behaviour

- Toggling a column on/off immediately shows/hides it in the table
- The visibility state is saved to preferences
- Columns with `alwaysVisible: true` are shown as checked and disabled (can't be unchecked)
- Columns with `defaultVisible: false` start unchecked but can be enabled by the user
- "Reset to Default" restores all columns to their `defaultVisible` state and default order

### The Key UX Principle

Every table should offer MORE columns than are shown by default. The defaults show the most useful columns; power users can enable additional columns (purchase price, warranty expiry, serial number, etc.) for their specific workflow. This is the same pattern used by Jira, Linear, and Airtable.

---

## 9. Persistent Preferences

### Enhanced `useTablePreferences`

Extend the existing `useTablePreferences` hook (`src/lib/use-table-preferences.ts`) to store the full table configuration:

```typescript
interface TablePreferences {
  // Existing
  sort: { field: string; direction: "asc" | "desc" } | null;
  pageSize: number;
  viewMode?: "table" | "grid" | "card";   // For pages that support multiple views

  // New
  columnOrder: string[];                    // Ordered array of column IDs
  columnVisibility: Record<string, boolean>; // Column ID → visible
  filters: Record<string, FilterValue>;     // Active filters
  searchValue?: string;                     // Last search query (optional — may not want to persist search)
}
```

### Storage Key

Preferences are stored in localStorage under a key derived from the `tableKey` prop:

```
gearflow-table-{tableKey}
```

Example: `gearflow-table-assets-registry`, `gearflow-table-projects`, `gearflow-table-crew`.

### Per-User Preferences

localStorage is inherently per-browser, not per-user. If a user logs in on a different device, they start with defaults. This is acceptable for v1. For v2, consider storing preferences server-side (in the User or Member model's metadata JSON) and syncing.

### Preference Lifecycle

1. **First visit:** No preferences in localStorage → use column `defaultVisible`, `defaultOrder`, and no filters
2. **User adjusts:** Reorder columns, hide/show, apply filters, change sort → preferences auto-saved to localStorage
3. **Page reload:** Preferences loaded from localStorage → table renders with user's configuration
4. **"Reset to Default":** Clears the stored preferences → reverts to column defaults

### What IS Persisted vs What ISN'T

| Persisted | Not Persisted |
|-----------|---------------|
| Column order | Current page number (always starts at page 1) |
| Column visibility | Row selection |
| Sort field + direction | Expanded row state |
| Page size | |
| Active filters | |
| View mode (table/grid) | |

---

## 10. Table Toolbar

### Standard Toolbar Layout

Every `DataTable` renders a consistent toolbar above the table:

```
┌──────────────────────────────────────────────────────────────────┐
│ [🔍 Search...]  [Status ▾] [Category ▾]  ···  [Columns] [⋮]    │
│                                                                   │
│ Active: Status: Available, Checked Out  ×  |  Category: Audio  × │
│──────────────────────────────────────────────────────────────────│
│ ☐ │ Asset Tag │ Model        │ Status    │ Location │ ...        │
│───┼───────────┼──────────────┼───────────┼──────────┼────────────│
```

### Toolbar Elements (left to right)

1. **Search input** — text search across key fields (always present if `enableSearch`)
2. **Filter buttons** — one button per filterable column that has `filterType: "enum"`. Each shows the column name and a dropdown indicator. When a filter is active, the button shows a badge with the count of selected values.
3. **More filters** — if there are many filterable columns, overflow into a "More Filters" dropdown
4. **Spacer**
5. **Columns button** — opens column visibility menu
6. **View toggle** — if the page supports multiple views (table/grid/card)
7. **Actions menu** — export CSV, bulk actions, etc.

### Active Filter Chips

Below the toolbar buttons, show a row of chips for every active filter:
```
Status: Available, Checked Out  ×  |  Category: Audio  ×  |  Clear All
```

Each chip shows the filter name and selected values. Clicking × on a chip clears that filter. "Clear All" clears all filters.

### Responsive Toolbar

On mobile:
- Search input takes full width
- Filter buttons collapse into a single "Filters" button that opens a sheet/drawer with all filter options
- Columns button and view toggle move into the actions menu (⋮)
- Active filter chips scroll horizontally

---

## 11. Tables to Upgrade

Every list page in the app needs to adopt `DataTable`. Here's each table with its filterable columns:

### Assets Registry (`/assets/registry`)

| Column | Filterable | Filter Type | Default Visible |
|--------|-----------|-------------|-----------------|
| Asset Tag | No (searchable) | — | Yes, always |
| Model | No (searchable) | — | Yes |
| Status | Yes | enum | Yes |
| Condition | Yes | enum | No |
| Location | Yes | enum (dynamic) | Yes |
| Category | Yes | enum (dynamic) | No |
| Supplier | Yes | enum (dynamic) | No |
| Purchase Date | Yes | date | No |
| Purchase Price | No | — | No |
| Warranty Expiry | Yes | date | No |
| Serial Number | No (searchable) | — | No |
| Tags | Yes | enum (dynamic) | No |
| Kit | Yes | enum (dynamic) | No |
| Asset Type | Yes | enum (Serialized/Bulk) | No |

### Models (`/assets/models`)

| Column | Filterable | Filter Type | Default Visible |
|--------|-----------|-------------|-----------------|
| Name | No (searchable) | — | Yes, always |
| Manufacturer | Yes | enum (dynamic) | Yes |
| Category | Yes | enum (dynamic) | Yes |
| Asset Type | Yes | enum | No |
| Asset Count | No | — | Yes |
| Rental Price | No | — | No |
| Replacement Cost | No | — | No |
| Weight | No | — | No |
| Active | Yes | boolean | No |

### Projects (`/projects`)

| Column | Filterable | Filter Type | Default Visible |
|--------|-----------|-------------|-----------------|
| Project Number | No (searchable) | — | Yes, always |
| Name | No (searchable) | — | Yes |
| Client | Yes | enum (dynamic) | Yes |
| Status | Yes | enum | Yes |
| Type | Yes | enum | No |
| Location | Yes | enum (dynamic) | No |
| Rental Start | Yes | date | Yes |
| Rental End | Yes | date | No |
| Event Start | Yes | date | No |
| Total | No | — | Yes |
| Tags | Yes | enum (dynamic) | No |
| Project Manager | Yes | enum (dynamic) | No |

### Kits (`/kits`)

| Column | Filterable | Filter Type | Default Visible |
|--------|-----------|-------------|-----------------|
| Asset Tag | No (searchable) | — | Yes, always |
| Name | No (searchable) | — | Yes |
| Status | Yes | enum | Yes |
| Condition | Yes | enum | No |
| Category | Yes | enum (dynamic) | Yes |
| Location | Yes | enum (dynamic) | No |
| Item Count | No | — | Yes |
| Weight | No | — | No |
| Tags | Yes | enum (dynamic) | No |

### Clients (`/clients`)

| Column | Filterable | Filter Type | Default Visible |
|--------|-----------|-------------|-----------------|
| Name | No (searchable) | — | Yes, always |
| Type | Yes | enum | Yes |
| Contact | No | — | Yes |
| Email | No (searchable) | — | No |
| Phone | No | — | No |
| Project Count | No | — | Yes |
| Tags | Yes | enum (dynamic) | No |
| Active | Yes | boolean | No |

### Crew Members (`/crew`) — requires Crew feature

| Column | Filterable | Filter Type | Default Visible |
|--------|-----------|-------------|-----------------|
| Name | No (searchable) | — | Yes, always |
| Type | Yes | enum | Yes |
| Status | Yes | enum | Yes |
| Department | Yes | enum (dynamic) | Yes |
| Skills | Yes | enum (dynamic) | No |
| Day Rate | No | — | No |
| Phone | No | — | No |
| Email | No (searchable) | — | No |
| Tags | Yes | enum (dynamic) | No |

### Locations (`/locations`)

| Column | Filterable | Filter Type | Default Visible |
|--------|-----------|-------------|-----------------|
| Name | No (searchable) | — | Yes, always |
| Type | Yes | enum | Yes |
| Address | No (searchable) | — | Yes |
| Asset Count | No | — | No |
| Default | Yes | boolean | No |

### Maintenance (`/maintenance`)

| Column | Filterable | Filter Type | Default Visible |
|--------|-----------|-------------|-----------------|
| Title | No (searchable) | — | Yes, always |
| Type | Yes | enum | Yes |
| Status | Yes | enum | Yes |
| Result | Yes | enum | No |
| Scheduled Date | Yes | date | Yes |
| Completed Date | Yes | date | No |
| Reported By | Yes | enum (dynamic) | No |
| Assigned To | Yes | enum (dynamic) | No |
| Cost | No | — | No |

### Test & Tag Registry (`/test-and-tag/registry`)

| Column | Filterable | Filter Type | Default Visible |
|--------|-----------|-------------|-----------------|
| Test Tag ID | No (searchable) | — | Yes, always |
| Description | No (searchable) | — | Yes |
| Equipment Class | Yes | enum | Yes |
| Appliance Type | Yes | enum | No |
| Status | Yes | enum | Yes |
| Last Test Date | Yes | date | No |
| Next Due Date | Yes | date | Yes |

### Suppliers (`/suppliers`) — requires Expanded Suppliers feature

| Column | Filterable | Filter Type | Default Visible |
|--------|-----------|-------------|-----------------|
| Name | No (searchable) | — | Yes, always |
| Contact Name | No (searchable) | — | Yes |
| Email | No | — | No |
| Phone | No | — | Yes |
| Active | Yes | boolean | No |
| Order Count | No | — | No |

### Activity Log (`/activity`) — requires Activity Log feature

| Column | Filterable | Filter Type | Default Visible |
|--------|-----------|-------------|-----------------|
| Timestamp | Yes | date | Yes, always |
| User | Yes | enum (dynamic) | Yes |
| Action | Yes | enum | Yes |
| Entity Type | Yes | enum | Yes |
| Summary | No (searchable) | — | Yes |

### Admin Tables (`/admin/organizations`, `/admin/users`)

These should also adopt `DataTable` with appropriate columns and filters. The admin panel tables tend to be simpler but should still have consistent filtering.

---

## 12. Server-Side vs Client-Side

### Server-Side (all tables by default)

All GearFlow tables use server-side pagination, sorting, and filtering. The `DataTable` component doesn't manipulate data itself — it sends the user's choices (sort, filters, page) to the parent page, which calls a server action with those parameters.

The server action pattern:
```typescript
export async function getAssets({
  page, pageSize, sort, order,
  search,
  filters,  // NEW: Record<string, FilterValue>
}: AssetQueryParams) {
  const { organizationId } = await getOrgContext();
  const filterWhere = buildFilterWhere(filters, assetColumnDefs);
  
  const where = {
    organizationId,
    isActive: true,
    ...filterWhere,
    ...(search ? {
      OR: [
        { assetTag: { contains: search, mode: "insensitive" } },
        { serialNumber: { contains: search, mode: "insensitive" } },
        { customName: { contains: search, mode: "insensitive" } },
      ],
    } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [sort]: order },
      include: { model: { include: { category: true } }, location: true },
    }),
    prisma.asset.count({ where }),
  ]);

  return serialize({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
```

### `buildFilterWhere` Utility

Create `src/lib/table-utils.ts` with:
- `buildFilterWhere(filters, columnDefs)` — translates filter state to Prisma `where`
- `buildSortOrder(sort, order, columnDefs)` — translates sort state to Prisma `orderBy` (handles dot-path joins like `model.name`)

This utility is shared by all server actions, ensuring consistent filter behaviour.

---

## 13. Responsive Behaviour

### Breakpoint-Based Column Hiding (existing, enhanced)

Columns with `responsiveHide: "md"` are auto-hidden below the `md` breakpoint. This is the existing pattern but now driven by column definitions rather than hardcoded Tailwind classes.

### User Visibility Overrides Responsive Hiding

If a user explicitly enables a column (via the Columns menu), it stays visible even below its `responsiveHide` breakpoint. The user's preference takes priority. Conversely, if a user hides a column, it stays hidden even above the breakpoint.

### Mobile Filter Sheet

On mobile (below `sm`), the filter buttons in the toolbar collapse into a single "Filters" button. Tapping it opens a full-screen sheet with all filter options stacked vertically — each filter section expandable/collapsible.

### Card View (optional per table)

Some tables may offer a card/grid view alongside the table view (e.g. assets could show as cards with photos). The `viewMode` preference controls this. Not all tables need a card view — it's opt-in per page.

---

## 14. Accessibility

- **Keyboard navigation:** Tab through filter controls, arrow keys within filter dropdowns
- **Screen readers:** Filter buttons have `aria-label` describing the filter state ("Status: 2 of 6 selected")
- **Focus management:** Opening a filter dropdown focuses the search input within it. Closing returns focus to the trigger button.
- **Column reorder:** Drag-and-drop should have a keyboard alternative (e.g. select column + Shift+Arrow to move)

---

## 15. Implementation Approach

### Build the Component First, Then Migrate

1. Build `DataTable`, column definitions, filter UI, column visibility, column reorder, and preferences as standalone components
2. Create the `buildFilterWhere` server utility
3. Pick ONE table (e.g. Assets Registry) as the pilot — migrate it fully to `DataTable` with all filters and columns
4. Verify it works end-to-end (server filtering, preference persistence, responsive behaviour)
5. Then systematically migrate every other table, one at a time

### Don't Change Server Action Signatures

Each table's server action already accepts `page`, `pageSize`, `sort`, `order`, and `search`. The only addition is the `filters` parameter. Existing parameters remain unchanged — this is additive.

### Column Definitions Live With the Page

Each list page defines its own `columns` array. The `DataTable` component is generic — it doesn't know about assets, projects, or kits. The column definitions contain all the entity-specific knowledge (field paths, filter options, cell renderers).

Create a file per table's columns: `src/lib/table-columns/assets.ts`, `src/lib/table-columns/projects.ts`, etc. This keeps column definitions separate from page components.

---

## 16. Implementation Phases

### Phase 1: DataTable Component & Core Features
1. Build `DataTable` component with column rendering, pagination, sorting
2. Build the column visibility popover with toggles
3. Build the enhanced `useTablePreferences` hook (column order, visibility, filters)
4. Build `buildFilterWhere` utility in `src/lib/table-utils.ts`
5. Migrate Assets Registry table as pilot

### Phase 2: Filter System
1. Build enum filter dropdown (checkbox list with search)
2. Build date range filter
3. Build text filter
4. Build boolean filter
5. Build filter chips row (active filters display with clear)
6. Build mobile filter sheet
7. Apply filters to Assets Registry server action

### Phase 3: Column Reordering
1. Implement drag-and-drop on column headers
2. Persist column order in preferences
3. Handle sticky columns and drag constraints
4. Keyboard alternative for reordering

### Phase 4: Migrate All Tables
1. Define column definitions for every table (one file per table)
2. Migrate tables one by one:
   - Assets Registry
   - Models
   - Projects
   - Kits
   - Clients
   - Locations
   - Maintenance
   - Test & Tag Registry
   - Categories
   - Suppliers (if feature exists)
   - Crew (if feature exists)
   - Activity Log (if feature exists)
   - Admin tables
3. Update each server action to accept `filters` parameter
4. Remove old hand-built table markup from each page
5. Verify responsive behaviour on all migrated tables

### Phase 5: Polish
1. Filter option counts (show how many rows match each filter value)
2. Empty state improvements per table
3. Card view option for asset/model tables
4. Performance optimisation for tables with many filter options
5. Verify localStorage preferences work correctly across all tables

---

## Notes

- **This is a UI infrastructure upgrade, not a feature.** It doesn't add new data or capabilities — it makes every existing table better. Prioritise it based on how painful the current tables are for users.
- **Column definitions are the contract.** Every table's behaviour is fully described by its column definitions array. Adding a new column to a table means adding one object to the array. Removing a column means removing the object. No other code changes needed.
- **Filters are server-side.** The `DataTable` component never sorts or filters data itself. It always delegates to the parent's server action. This means filter performance scales with the database, not the client.
- **Don't over-filter.** Not every column needs to be filterable. String columns that are already covered by the search input (name, description, etc.) don't need a separate filter. Filters are most valuable for enum/status columns where users want to narrow by category.
- **Preferences are per-table, not per-user.** localStorage means preferences don't roam across devices. This is fine for v1. If users ask for synced preferences, add a `tablePreferences` JSON field on the `Member` model later.
- **The `DataTable` component should be thorougly tested with the pilot table before migrating others.** Get one table working perfectly — then the rest are just column definition files.
