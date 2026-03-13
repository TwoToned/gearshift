# Suppliers & Purchase Orders

## Suppliers
- **Routes**: `/suppliers` (list), `/suppliers/[id]` (detail), `/suppliers/[id]/edit`, `/suppliers/new`, `/suppliers/[id]/orders/new`
- **Fields**: name (required), contactName, email, phone, website, address, notes, accountNumber, paymentTerms, defaultLeadTime, tags, isActive
- **Server actions**: `src/server/suppliers.ts` — `getSuppliers()`, `getSuppliersPaginated()`, `getSupplierById()`, `getSupplierAssets()`, `getSupplierSubhires()`, `createSupplier()`, `updateSupplier()`, `deleteSupplier()`
- **Permissions**: `"supplier"` resource with full CRUD. Owner/admin: all, manager: create/read/update, member/viewer: read
- **Sidebar**: Between Clients and Locations with `Truck` icon
- **Search**: Global search matches name, contactName, accountNumber, email, tags. In PAGE_COMMANDS with `searchType: "supplier"`
- **Detail page**: Info cards (Contact, Account Details, Summary), tags, notes, 3 tabs (Orders, Assets, Subhires)
- **Delete guards**: Cannot delete supplier with linked assets, line items, or orders
- **Settings migration**: `/settings/assets` links to `/suppliers` instead of inline SupplierManager

## Supplier Orders (Purchase Orders)
- **Models**: `SupplierOrder` and `SupplierOrderItem`
- **Enums**: `SupplierOrderType` (PURCHASE, SUBHIRE, REPAIR, OTHER), `SupplierOrderStatus` (DRAFT, SUBMITTED, CONFIRMED, PARTIAL, RECEIVED, CANCELLED)
- **Server actions**: `src/server/supplier-orders.ts` — full CRUD for orders and items
- **Order fields**: orderNumber (unique per org), type, status, dates, financials (Decimal), supplierId, projectId, createdById, notes
- **Order items**: description, quantity, unitPrice, lineTotal (auto-calculated), modelId, assetId, notes, sortOrder
- **Auto-calculations**: `recalculateOrderTotals()` sums item lineTotals, applies 10% GST
- **Status shortcuts**: Setting to RECEIVED auto-sets receivedDate
- **Asset integration**: `purchaseOrderNumber` and `supplierOrderId` on Asset
- **Line item integration**: `subhireOrderNumber` and `supplierOrderId` on ProjectLineItem
