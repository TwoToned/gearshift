# Universal Tags System

All major entities support free-form string tags stored as Postgres `String[]` arrays.

## Tagged Entities
`Category`, `Model`, `Kit`, `Asset`, `BulkAsset`, `Location`, `MaintenanceRecord`, `Project`, `Client`, `Supplier` — all have `tags String[] @default([])`.

## Tag Normalization
Tags normalized to lowercase on save. Case is not preserved.

## Server Actions
- All entity create/update actions accept `tags` in their input.
- `getOrgTags()` (`src/server/tags.ts`): Returns all distinct tags across all entity types for autocomplete.

## Global Search
Matches tags via raw SQL: `EXISTS(SELECT 1 FROM unnest(tags) t WHERE t ILIKE $pattern)`.

## UI
- **TagInput** (`src/components/ui/tag-input.tsx`): Input with badge display, autocomplete, keyboard navigation.
- **Tables**: Tags shown as `Badge variant="secondary"`, hidden on small screens.

## CSV/Export
Tags exported as semicolons; import parses them back with lowercase normalization. Tags export/import automatically with parent entity in org transfer.

## Validation
All Zod schemas include `tags: z.array(z.string()).default([])`.
