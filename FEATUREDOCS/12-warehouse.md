# Warehouse Operations

## Check Out Flow
1. User opens project in warehouse view (`/warehouse/[projectId]`)
2. Scans barcode or selects asset from dropdown
3. `lookupAssetForScan` validates: asset exists, matches a line item model, not already checked out elsewhere
4. For serialized: `checkOutItems` assigns `assetId` to line item, sets asset status to `CHECKED_OUT`
5. For bulk: increments `checkedOutQuantity` on line item, decrements `availableQuantity` on bulk asset
6. For kit: `checkOutKit` atomically updates kit + all member assets + all child line items

## Check In Flow
1. User selects items to check in, specifies condition per item
2. `checkInItems` based on condition:
   - GOOD → asset status `AVAILABLE`, disconnects `assetId` from line item
   - DAMAGED → asset status `IN_MAINTENANCE`, disconnects
   - MISSING → asset status `LOST`, disconnects
3. For kit: `checkInKit` atomically reverses checkout

## Conflict Detection
`lookupAssetForScan` checks both line item status AND physical asset status. If asset is `CHECKED_OUT` on another project, returns error with project name/number.

## Online Pick List
Dialog with full item list showing checkout status per line item. Mobile full-screen with safe area padding.
