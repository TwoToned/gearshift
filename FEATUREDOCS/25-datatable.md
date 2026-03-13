# Advanced DataTable System

## Core Component: `DataTable<TData>` (`src/components/ui/data-table.tsx`)
- **Props**: `data`, `columns`, `totalRows`, `page`, `pageSize`, `sortField`, `sortDirection`, `filters`, `searchValue`, `columnVisibility`, plus callbacks
- **Features**: Server-side pagination/sorting, column visibility toggles (localStorage), enum filter dropdowns as checkbox popovers, text search, row selection, active filter chips
- **Column definitions**: `ColumnDef<TData>[]` with `id`, `header`, `accessorKey`, `cell`, `sortKey`, `filterable`, `filterType`, `filterOptions`, `defaultVisible`, `alwaysVisible`, `responsiveHide`

## Filter System
- **Enum filters**: Checkbox popover multi-select. Active filters shown as removable chips.
- **Filter state**: `Record<string, FilterValue>` where `FilterValue = string[] | string | { from?: string; to?: string } | boolean`
- **Server-side**: `buildFilterWhere(filters, columnDefs)` in `src/lib/table-utils.ts` — supports nested dot-paths (e.g., `model.categoryId`)

## Column Visibility
- Toggle on/off via popover. `alwaysVisible` can't be hidden. `defaultVisible: false` hidden by default.
- Persisted to localStorage via `useTablePreferences`

## `useTablePreferences` Hook (`src/lib/use-table-preferences.ts`)
- Persists sort, page size, view mode, column visibility, and filters to localStorage per table key
- Key fields: `columnVisibility`, `toggleColumnVisibility`, `filters`, `setFilter`, `clearFilters`, `resetPreferences`

## Tables Using DataTable
| Table | Location | Key Filters |
|-------|----------|-------------|
| Assets Registry | `src/components/assets/asset-table.tsx` | Status, Condition, Location, Category |
| Equipment Models | `src/components/assets/model-table.tsx` | Category, Asset Type |
| Projects | `src/components/projects/project-table.tsx` | Status, Type |
| Kits | `src/app/(app)/kits/page.tsx` | Status, Condition, Location, Category |
| Clients | `src/components/clients/client-table.tsx` | Type |
| Locations | `src/components/locations/location-table.tsx` | Type |
| Suppliers | `src/components/suppliers/supplier-table.tsx` | Status (isActive) |
| Maintenance | `src/app/(app)/maintenance/page.tsx` | Status, Type, Result |
| T&T Registry | `src/components/test-tag/test-tag-table.tsx` | Equipment Class, Appliance Type, Status |
| Activity Log | `src/app/(app)/activity/page.tsx` | Action, Entity Type |

## Adding a New Table
1. Define `ColumnDef<TData>[]` with filterable columns and cell renderers
2. Use `useTablePreferences(tableKey, defaults)` for state management
3. Add `filters?: Record<string, FilterValue>` to the server action
4. Call `buildFilterWhere(filters, filterColumnDefs)` in the server action
5. Pass all state to `<DataTable>` component
6. For `tags` filters: handle separately with `{ hasSome: values }` (Prisma array filter)
