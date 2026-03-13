# Asset Management System

## Three Asset Types
1. **Serialized** (`Asset`): Individually tracked, unique tag, has status lifecycle
2. **Bulk** (`BulkAsset`): Quantity-tracked, `totalQuantity`/`availableQuantity`
3. **Kit** (`Kit`): Container of serialized + bulk assets (see [kits.md](./09-kits.md))

## Auto-Incrementing Tags
Stored in `Organization.metadata` JSON:
```json
{ "assetTagPrefix": "TTP", "assetTagDigits": 5, "assetTagCounter": 42 }
```
- `peekNextAssetTags(count)` — Read-only preview for form pre-fill (no increment)
- `reserveAssetTags(count)` — Atomic increment, called ONLY after successful creation
- Users can override suggested tags. Adding/removing form rows doesn't burn numbers

## Asset Status Lifecycle
```
AVAILABLE → CHECKED_OUT (via warehouse checkout)
AVAILABLE → IN_MAINTENANCE (via maintenance record)
AVAILABLE → RESERVED (manual)
CHECKED_OUT → AVAILABLE (check in with GOOD condition)
CHECKED_OUT → IN_MAINTENANCE (check in with DAMAGED condition)
CHECKED_OUT → LOST (check in with MISSING condition)
IN_MAINTENANCE → AVAILABLE (maintenance completed)
Any → RETIRED (manual)
```

## Categories
- **Routes**: `/assets/categories` (list table), `/assets/categories/[id]` (detail page)
- **Hierarchy**: Self-referential `parentId` on Category model. Table view indents children under parents.
- **Relations**: Category → Model[], Category → Kit[], Category → children Category[]
- **Detail page**: Subcategories grid + tabbed Models/Kits tables with counts
- **Permissions**: Uses `"model"` resource (no dedicated category permission resource)
- **Sidebar**: Under Assets with `Tags` icon, `resource: "model"`
