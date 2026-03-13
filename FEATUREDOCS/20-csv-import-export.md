# CSV Import/Export

## Export
- `exportModelsCSV()` — all active models with specs
- `exportAssetsCSV()` — all active serialized assets
- `exportBulkAssetsCSV()` — all active bulk assets

## Import
- `importModelsCSV(csvContent)` — upsert by name + manufacturer + modelNumber
- `importAssetsCSV(csvContent)` — upsert by assetTag, auto-generate tags if missing
- Custom CSV parser (no external deps) with flexible column matching (camelCase, snake_case, Title Case)
- Tags exported as semicolons; import parses them back with lowercase normalization

## UI
`CSVImportDialog` (`src/components/assets/csv-import-dialog.tsx`) — reusable file upload with progress bar and error display
