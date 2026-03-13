# Feature: Universal Tags System

## Summary

Add a consistent, searchable tagging system to all major entities in GearFlow. Tags should be free-form text labels (like the existing `tags` field on Project and Client) extended across every entity type that appears in search results. Tags should be filterable, searchable, and visible in list views.

## Current State

- `Project` already has a `tags String[]` field
- `Client` already has a `tags String[]` field
- No other entities have tags
- Global search (`src/server/search.ts`) does not search by tag

## Entities to Add Tags To

All of these already appear in global search results:

| Entity | Has tags? | Action |
|--------|-----------|--------|
| Project | Yes (`tags String[]`) | No schema change needed |
| Client | Yes (`tags String[]`) | No schema change needed |
| Asset | No | Add `tags String[] @default([])` |
| BulkAsset | No | Add `tags String[] @default([])` |
| Model | No | Add `tags String[] @default([])` |
| Kit | No | Add `tags String[] @default([])` |
| Location | No | Add `tags String[] @default([])` |
| Category | No | Add `tags String[] @default([])` |
| MaintenanceRecord | No | Add `tags String[] @default([])` |
| CrewMember | Yes (in Crew spec) | Already has `tags String[] @default([])` in the Crew Management spec. When implementing tags, ensure crew member tags use the same `TagInput` component and are included in the org-wide tag suggestion pool. |

## Database Changes

### Prisma Schema

Add `tags String[] @default([])` to each model listed above that doesn't already have it. Run migration.

No new tables needed — Postgres native string arrays are sufficient (same pattern as Project and Client).

## Server Action Changes

### CRUD Actions

For every entity that gains tags, update:

1. **Create action** — accept `tags` in input, pass to `prisma.create()`
2. **Update action** — accept `tags` in input, pass to `prisma.update()`
3. **Get/list actions** — include `tags` in the select/return. No special handling needed since `serialize()` passes arrays through.

Files to update:
- `src/server/assets.ts` — `createAsset`, `updateAsset`, `getAssets`, `getAssetById`
- `src/server/bulk-assets.ts` — `createBulkAsset`, `updateBulkAsset`, `getBulkAssets`, `getBulkAssetById`
- `src/server/models.ts` — `createModel`, `updateModel`, `getModels`, `getModelById`
- `src/server/kits.ts` — `createKit`, `updateKit`, `getKits`, `getKitById`
- `src/server/locations.ts` — `createLocation`, `updateLocation`, `getLocations`
- `src/server/categories.ts` — `createCategory`, `updateCategory`, `getCategories`, `getCategory`
- `src/server/maintenance.ts` — `createMaintenanceRecord`, `updateMaintenanceRecord`, `getMaintenanceRecords`, `getMaintenanceRecordById`

### Global Search (`src/server/search.ts`)

Update `globalSearch()` to also match against `tags` for all entity types:

```typescript
// For each entity search, add tag matching to the OR clause:
{
  OR: [
    { name: { contains: query, mode: "insensitive" } },
    // ... existing fields ...
    { tags: { has: query } },           // exact tag match
    { tags: { hasSome: [query] } },     // or use array contains
  ]
}
```

Consider also doing a partial/ILIKE match on tags — since tags are string arrays, you may need a raw query or `arrayContains`-style approach. Alternatively, check if any tag in the array contains the search term using a Prisma raw filter.

## Validation Changes

Update Zod schemas in `src/lib/validations/` for each entity:

```typescript
tags: z.array(z.string()).optional().default([]),
```

Files to update:
- `src/lib/validations/asset.ts`
- `src/lib/validations/model.ts`
- `src/lib/validations/kit.ts`
- `src/lib/validations/location.ts` (create if it doesn't exist)
- `src/lib/validations/category.ts` (create if it doesn't exist)
- `src/lib/validations/maintenance.ts` (create if it doesn't exist)

## UI Changes

### Tag Input Component

Create a reusable `TagInput` component (e.g. `src/components/ui/tag-input.tsx`):
- Text input field where user types a tag and presses Enter or comma to add it
- Each tag displays as a pill/badge with an X to remove
- Suggests existing tags from the organization as the user types (autocomplete from previously used tags)
- Should work with React Hook Form via `Controller`

### Autocomplete: Org-Wide Tag Suggestions

Create a server action `getOrgTags(entityType?: string)` that returns all distinct tags used across the org (optionally filtered by entity type). This powers the autocomplete dropdown in `TagInput`.

Alternatively, query all tags across all entity types for a universal suggestion list — this is probably better UX since tags like "fragile" or "priority" apply across entity types.

### Entity Forms

Add `TagInput` to every create/edit form for the entities listed above. Place it in a sensible location — typically after description/notes fields.

### List/Table Views

- Show tags as small badges/pills in entity table rows (similar to how Project already shows tags)
- Add a tag filter dropdown to list pages: multi-select of available tags, filters the table to items that have ANY of the selected tags
- Make tags clickable in table views — clicking a tag filters the current list to that tag

### Detail Pages

Display tags as badges on entity detail pages, with an inline edit capability (or just rely on the edit form).

## CSV Import/Export

Update CSV export functions to include a `tags` column (comma-separated within the cell). Update CSV import to parse the tags column back into an array.

Files: `src/server/csv.ts` — `exportModelsCSV`, `exportAssetsCSV`, `exportBulkAssetsCSV`, `importModelsCSV`, `importAssetsCSV`.

## Organization Export/Import

Update `src/lib/org-export.ts` and `src/lib/org-import.ts` to handle the new `tags` field on entities that didn't previously have it. Since tags are just string arrays stored directly on the model, this should work automatically — but verify.

## Notes

- Tags are free-form strings, not a separate Tag entity. This keeps the implementation simple and matches the existing Project/Client pattern.
- Tags are case-insensitive for matching but preserve the case the user entered for display.
- No separate permissions for tags — they follow the parent entity's permissions (if you can edit an asset, you can edit its tags).
- Consider normalising tags to lowercase on save to avoid duplicates like "Fragile" vs "fragile".
