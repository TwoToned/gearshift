# Feature: Expanded Suppliers — Notes, Orders & Order Tracking

## Summary

Expand the Supplier system from a simple reference entity into a fully functional supplier management module with rich notes, order tracking, and integration into asset purchases and subhire line items. When recording a supplier on an asset purchase or subhire line item, users can attach an order/PO number, creating a browsable record of all orders placed with each supplier.

## Current State

- `Supplier` model: `id, organizationId, name, contactName, email, phone, website, address, notes (single text field), isActive`
- Suppliers are referenced by:
  - `Asset.supplierId` — purchase supplier
  - `ProjectLineItem.supplierId` — subhire supplier (when `isSubhire: true`)
- Supplier CRUD is basic: `src/server/suppliers.ts`
- Managed via the Settings > Assets page (simple inline list)
- No dedicated supplier detail page, list page, or order tracking

## Database Changes

### Update `Supplier` Model

```prisma
model Supplier {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name            String
  contactName     String?
  email           String?
  phone           String?
  website         String?
  address         String?
  notes           String?  // Existing — keep as "general notes"
  accountNumber   String?  // Our account number with this supplier
  paymentTerms    String?  // e.g. "Net 30", "COD", "Prepay"
  defaultLeadTime String?  // e.g. "3-5 business days"
  tags            String[] @default([])
  isActive        Boolean  @default(true)

  // Relations
  assets          Asset[]
  lineItems       ProjectLineItem[]
  orders          SupplierOrder[]  // NEW

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([organizationId, name])
  @@index([organizationId])
}
```

### New Model: `SupplierOrder`

Track purchase orders and subhire orders placed with suppliers.

```prisma
model SupplierOrder {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  supplierId      String
  supplier        Supplier @relation(fields: [supplierId], references: [id], onDelete: Cascade)

  orderNumber     String           // PO number or supplier's order ref
  type            SupplierOrderType // PURCHASE, SUBHIRE, REPAIR, OTHER
  status          SupplierOrderStatus // DRAFT, ORDERED, PARTIAL, RECEIVED, CANCELLED
  orderDate       DateTime?
  expectedDate    DateTime?        // Expected delivery/return date
  receivedDate    DateTime?

  // Financial
  subtotal        Decimal?  @db.Decimal(10, 2)
  taxAmount       Decimal?  @db.Decimal(10, 2)
  total           Decimal?  @db.Decimal(10, 2)

  // References
  projectId       String?          // For subhire orders — which project is this for
  project         Project?         @relation(fields: [projectId], references: [id], onDelete: SetNull)

  notes           String?
  createdById     String?
  createdBy       User?    @relation(fields: [createdById], references: [id], onDelete: SetNull)

  // Items on this order
  items           SupplierOrderItem[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([organizationId])
  @@index([organizationId, supplierId])
  @@index([organizationId, orderNumber])
}

model SupplierOrderItem {
  id              String   @id @default(cuid())
  orderId         String
  order           SupplierOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  description     String           // What was ordered
  quantity        Int      @default(1)
  unitPrice       Decimal? @db.Decimal(10, 2)
  lineTotal       Decimal? @db.Decimal(10, 2)

  // Optional links to what this order item became
  modelId         String?          // If ordering a new model/asset type
  model           Model?   @relation(fields: [modelId], references: [id], onDelete: SetNull)
  assetId         String?          // If a specific asset was purchased via this order
  asset           Asset?   @relation(fields: [assetId], references: [id], onDelete: SetNull)

  notes           String?
  sortOrder       Int      @default(0)

  @@index([orderId])
}

enum SupplierOrderType {
  PURCHASE
  SUBHIRE
  REPAIR
  LABOUR      // Labour PO for crew contractors/freelancers (requires Crew Management feature)
  OTHER
}

enum SupplierOrderStatus {
  DRAFT
  ORDERED
  PARTIAL
  RECEIVED
  CANCELLED
}
```

### Update `Asset` Model

Add an optional order reference:
```prisma
model Asset {
  // ... existing fields ...
  purchaseOrderNumber  String?          // PO/order number when purchased
  supplierOrderId      String?          // Link to a SupplierOrder if tracked
  supplierOrder        SupplierOrder?   @relation(fields: [supplierOrderId], references: [id], onDelete: SetNull)
}
```

### Update `ProjectLineItem` Model

Add an order number field for subhire tracking:
```prisma
model ProjectLineItem {
  // ... existing fields ...
  subhireOrderNumber   String?          // Order/PO number for subhired items
  supplierOrderId      String?          // Link to a SupplierOrder if tracked
  supplierOrder        SupplierOrder?   @relation(fields: [supplierOrderId], references: [id], onDelete: SetNull)
}
```

## Server Actions

### `src/server/suppliers.ts` — Expand Existing

Update existing supplier CRUD to handle new fields (`accountNumber`, `paymentTerms`, `defaultLeadTime`, `tags`). Add:

- `getSupplierById(id)` — full detail with order history and linked assets/line items
- `getSupplierOrders(supplierId, filters)` — paginated order list for a supplier
- `getSupplierStats(supplierId)` — summary: total orders, total spend, active subhires

### New: `src/server/supplier-orders.ts`

```typescript
"use server";

export async function createSupplierOrder(data: SupplierOrderInput) { ... }
export async function updateSupplierOrder(id: string, data: Partial<SupplierOrderInput>) { ... }
export async function updateSupplierOrderStatus(id: string, status: SupplierOrderStatus) { ... }
export async function deleteSupplierOrder(id: string) { ... }
export async function getSupplierOrders(filters: OrderFilters) { ... } // all orders across suppliers
export async function getSupplierOrderById(id: string) { ... }
export async function addOrderItem(orderId: string, item: OrderItemInput) { ... }
export async function updateOrderItem(itemId: string, data: Partial<OrderItemInput>) { ... }
export async function removeOrderItem(itemId: string) { ... }
export async function recalculateOrderTotals(orderId: string) { ... }
```

## Validation Schemas

### `src/lib/validations/supplier.ts` — Update

Add validation for new fields: `accountNumber`, `paymentTerms`, `defaultLeadTime`, `tags`.

### `src/lib/validations/supplier-order.ts` — New

Zod schemas for order creation/update and order items.

## Routes & Pages

### Promote Suppliers to Full Pages

Move suppliers out of the settings inline manager into proper list + detail + form pages.

| Route | Page | Description |
|-------|------|-------------|
| `/suppliers` | Supplier list | Table with search, filter by active/inactive, sort |
| `/suppliers/new` | Create supplier | Full form with all fields |
| `/suppliers/[id]` | Supplier detail | Info, orders tab, linked assets tab, linked subhires tab |
| `/suppliers/[id]/edit` | Edit supplier | Same form as create, pre-populated |
| `/suppliers/[id]/orders/new` | New order | Order form linked to this supplier |

### Supplier Detail Page Tabs

1. **Overview** — Contact info, account details, notes
2. **Orders** — Table of all orders with this supplier (filterable by type, status, date range)
3. **Assets** — All assets purchased from this supplier
4. **Subhires** — All subhire line items from this supplier (across projects)

### Order Detail (inline or separate page)

Can be a dialog/sheet or its own page — either works. Should show:
- Order header (number, dates, status, supplier, project link if subhire)
- Order items list (description, qty, unit price, total, linked asset/model)
- Status change buttons (Mark as Ordered, Mark as Received, etc.)

## UI Changes

### Asset Form (`src/components/assets/asset-form.tsx`)

When a supplier is selected in the asset creation/edit form:
- Show a new "Purchase Order #" text field
- Optional: "Link to Order" button that opens a picker to select an existing `SupplierOrder` from that supplier

### Subhire Line Item (Add/Edit Equipment Dialog)

When `isSubhire` is checked and a supplier is selected:
- Show a "Subhire Order #" text field
- Optional: "Link to Order" button to select an existing order

### Settings > Assets Page

Replace the inline Supplier manager with a link to `/suppliers` (same pattern as how Categories was moved out to its own page).

## Sidebar

Add suppliers to the main sidebar:
```typescript
{
  title: "Suppliers",
  url: "/suppliers",
  icon: Truck, // or Building2 or Factory
  resource: "asset", // or consider a new "supplier" resource in permissions
}
```

## Search Integration

### Global Search (`src/server/search.ts`)

Add supplier search:
- Search by: name, contactName, accountNumber
- Result links to `/suppliers/[id]`

### Page Commands (`src/lib/page-commands.ts`)

```typescript
{
  label: "Suppliers",
  href: "/suppliers",
  aliases: ["vendor", "supplier", "purchase"],
  icon: "Truck",
  description: "Manage suppliers and orders",
  searchable: true,
  searchType: "supplier",
}
```

## Top Bar

Add segment labels:
```typescript
suppliers: "Suppliers"
```

## Permissions

Consider adding a dedicated `supplier` resource to `src/lib/permissions.ts`:
```typescript
supplier: ["create", "read", "update", "delete"]
```

If adding a new resource is too disruptive, continue gating supplier operations behind the `asset` resource.

## Organization Export/Import

Add `SupplierOrder` and `SupplierOrderItem` to:
- `src/lib/org-export.ts` — export tables
- `src/lib/org-import.ts` — import with ID remapping
- `src/lib/org-transfer-types.ts` — manifest type

## Activity Log Integration

If the Activity Log feature (separate spec) is implemented, add logging to all supplier and order CRUD operations.

## Notes

- The `purchaseOrderNumber` on Asset and `subhireOrderNumber` on LineItem are simple text fields — they work independently of the `SupplierOrder` system. Users can just type in a PO number without creating a full order record. The `supplierOrderId` link is optional for users who want full order tracking.
- This design means orders can be tracked at two levels: simple (just a PO number text field) or detailed (linked SupplierOrder with items, status, financials).
- The supplier notes field already exists as a single text field. Keep it as-is — it's sufficient for general notes. The order system handles the structured tracking.

### Crew Management Integration

When the Crew Management feature is implemented, suppliers can also represent labour hire companies or freelancer agencies. The `LABOUR` order type on `SupplierOrder` supports this:
- A labour PO can be generated from a crew assignment (e.g. "3x Stage Hands from [Labour Company] for [Project]")
- The `SupplierOrder.projectId` links the PO to the relevant project
- `SupplierOrderItem` could optionally link to a `CrewAssignment` via an added `crewAssignmentId` field (add this field to `SupplierOrderItem` when implementing the crew feature)
- The Supplier detail page's "Subhires" tab should also show labour POs alongside equipment subhire orders
- Crew members of type `CONTRACTOR` may be linked to a Supplier record to represent the company they work for — consider adding an optional `supplierId` field on `CrewMember` for this relationship
