# Organization Export/Import

## Export (`src/lib/org-export.ts`)
- Queries all 27+ org-scoped tables (including supplierOrders, supplierOrderItems, modelAccessories)
- Builds streaming ZIP via `archiver`: `manifest.json` + `files/{storageKey}`
- Concurrent S3 downloads limited to 5
- API: `GET /api/admin/org-export/[orgId]` (site admin only)

## Import (`src/lib/org-import.ts`)
- Extracts ZIP via `unzipper`
- Creates new org with full ID remapping (`@paralleldrive/cuid2`)
- Topological sort (BFS) for hierarchical tables (Category, Location, ProjectLineItem parentId)
- User FKs resolved by email matching — unmatched users are skipped gracefully
- S3 files re-uploaded under new org prefix; `thumbnailUrl` cleared
- Image URL references (`model.image`, `kit.image`, etc.) updated via URL mapping
- `safeDate()`/`safeDateOpt()` handle invalid dates
- SupplierOrders imported after Projects (due to projectId FK)
- ModelAccessories imported after Models (remaps parentModelId, accessoryModelId)
- API: `POST /api/admin/org-import` (FormData with file + optional name/slug)

## Type Definitions
`src/lib/org-transfer-types.ts` — `OrgExportManifest` interface, `MANIFEST_VERSION = 1`

## UI
- Export button on org detail page + per-row download button
- Import button + dialog on org list page
