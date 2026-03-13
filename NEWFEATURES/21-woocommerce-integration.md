# Feature: WooCommerce Integration — Order-to-Project Pipeline

## Summary

Integrate GearFlow with a WooCommerce-powered website so that when a customer places an order (adds products to cart and "checks out"), GearFlow automatically creates a new project in the ENQUIRY stage with the customer's info, requested equipment, and rental dates. This replaces the current manual flow where WooCommerce sends an email and someone re-enters everything into GearFlow by hand. The integration uses WooCommerce's built-in webhook system — no WordPress plugin development required on the GearFlow side.

---

## How It Works — End to End

```
Customer browses website (WordPress + WooCommerce)
    ↓
Adds products to cart with rental dates
    ↓
"Checks out" — fills in name, email, phone, dates, notes
    ↓
WooCommerce creates an order (status: "processing" or custom status)
    ↓
WooCommerce webhook fires: POST to GearFlow webhook endpoint
    ↓ (payload: order JSON with customer info + line items + meta)
GearFlow webhook endpoint receives the payload
    ↓
Validates HMAC signature (proves it came from your WooCommerce)
    ↓
Creates or finds a Client record from the customer info
    ↓
Creates a Project in ENQUIRY status
    ↓
Adds line items matching WooCommerce products to GearFlow models
    ↓
Sends notification to org admins: "New enquiry from website"
    ↓
WooCommerce also sends the confirmation email to the customer (unchanged)
```

The key principle: **WooCommerce pushes to GearFlow. GearFlow never calls WooCommerce.** This is a one-way webhook integration — the simplest and most reliable architecture. No WordPress plugin to maintain, no WooCommerce API credentials to manage on the GearFlow side.

---

## WooCommerce Setup (WordPress Side)

### 1. Create a Webhook in WooCommerce

In the WordPress admin: WooCommerce → Settings → Advanced → Webhooks → Add Webhook

| Setting | Value |
|---------|-------|
| Name | "GearFlow Project Creation" |
| Status | Active |
| Topic | Order created |
| Delivery URL | `https://app.gearflow.com/api/integrations/woocommerce/webhook` |
| Secret | A strong random string (shared with GearFlow for HMAC validation) |
| API Version | WP REST API Integration v3 |

### 2. Product-to-Model Mapping

Each WooCommerce product needs a way to link to a GearFlow model. Options (org chooses one):

**Option A: SKU matching (recommended)**
- Set each WooCommerce product's SKU to match the GearFlow model's `modelNumber`
- GearFlow matches `order.line_items[].sku` → `Model.modelNumber`
- Simple, no WordPress changes needed beyond setting SKUs

**Option B: Custom field**
- Add a custom field `gearflow_model_id` to WooCommerce products
- GearFlow reads `order.line_items[].meta_data` for this field
- More explicit but requires a custom field plugin on WordPress

**Option C: Name matching (fallback)**
- Match `order.line_items[].name` against `Model.name`
- Fuzzy matching — works as a fallback but may produce mismatches

The integration settings in GearFlow let the admin choose which matching strategy to use.

### 3. Rental Date Metadata

WooCommerce doesn't natively handle rental dates. The existing website likely uses a plugin or custom fields to capture:
- Rental start date
- Rental end date
- Event date(s)
- Delivery address
- Pickup preference

These are passed in the order's `meta_data` array. GearFlow's integration settings let the admin map which `meta_data` keys correspond to which project fields.

---

## Data Model

### `WooCommerceIntegration`

Per-org configuration for the WooCommerce connection.

```prisma
model WooCommerceIntegration {
  id              String   @id @default(cuid())
  organizationId  String   @unique
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  isEnabled       Boolean  @default(false)
  webhookSecret   String                     // Shared secret for HMAC verification (encrypted)
  storeUrl        String?                    // WooCommerce store URL (for reference/display)

  // Matching strategy
  productMatchField String  @default("sku")  // "sku", "custom_field", "name"
  customFieldKey    String?                   // If productMatchField = "custom_field", which meta key

  // Date field mapping (WooCommerce meta_data keys → project fields)
  rentalStartKey    String?                   // e.g. "rental_start_date"
  rentalEndKey      String?                   // e.g. "rental_end_date"
  eventStartKey     String?                   // e.g. "event_date"
  deliveryAddressKey String?                  // e.g. "delivery_address"
  notesKey          String?                   // e.g. "order_notes" or "customer_note"

  // Defaults for created projects
  defaultProjectType String @default("DRY_HIRE")
  autoConfirmEnquiry Boolean @default(false)  // If true, set status to QUOTING instead of ENQUIRY

  // Notification
  notifyUserIds     String[] @default([])     // User IDs to notify on new website orders

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### `WooCommerceOrderLog`

Log every webhook received for debugging and audit.

```prisma
model WooCommerceOrderLog {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  wooOrderId      Int                        // WooCommerce order ID
  wooOrderNumber  String?                    // WooCommerce order number (may differ from ID)
  status          WooOrderLogStatus          // RECEIVED, PROCESSING, COMPLETED, FAILED, DUPLICATE
  
  // What was created
  projectId       String?
  project         Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
  clientId        String?

  // Debugging
  payload         Json                       // Full webhook payload (for debugging)
  errorMessage    String?                    // If FAILED
  matchResults    Json?                      // Which products matched which models

  createdAt       DateTime @default(now())

  @@index([organizationId])
  @@index([wooOrderId])
}

enum WooOrderLogStatus {
  RECEIVED      // Webhook received, processing started
  PROCESSING    // Creating project/client
  COMPLETED     // Project created successfully
  FAILED        // Error during processing
  DUPLICATE     // Order already processed (idempotency)
}
```

---

## API Route: Webhook Endpoint

### `POST /api/integrations/woocommerce/webhook`

This is the endpoint WooCommerce sends webhooks to. It must be publicly accessible (no auth middleware — webhook auth is via HMAC).

```typescript
// src/app/api/integrations/woocommerce/webhook/route.ts

export async function POST(request: Request) {
  // 1. Read the raw body (needed for HMAC verification)
  const rawBody = await request.text();
  
  // 2. Get the HMAC signature from headers
  const signature = request.headers.get("X-WC-Webhook-Signature");
  const deliveryId = request.headers.get("X-WC-Webhook-Delivery-ID");
  const topic = request.headers.get("X-WC-Webhook-Topic");
  
  // 3. Determine which org this webhook belongs to
  //    (via the webhook source URL or a custom header/query param)
  //    Simplest: include orgId in the delivery URL:
  //    /api/integrations/woocommerce/webhook?org={orgId}
  const orgId = new URL(request.url).searchParams.get("org");
  if (!orgId) return Response.json({ error: "Missing org" }, { status: 400 });
  
  // 4. Load the org's WooCommerce integration config
  const integration = await prisma.wooCommerceIntegration.findUnique({
    where: { organizationId: orgId },
  });
  if (!integration?.isEnabled) {
    return Response.json({ error: "Integration not enabled" }, { status: 404 });
  }
  
  // 5. Verify HMAC-SHA256 signature
  const expectedSignature = crypto
    .createHmac("sha256", integration.webhookSecret)
    .update(rawBody)
    .digest("base64");
  if (signature !== expectedSignature) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }
  
  // 6. Parse the order payload
  const order = JSON.parse(rawBody);
  
  // 7. Check for WooCommerce ping (sent on webhook creation)
  if (topic === "order.created" && !order.id) {
    return Response.json({ ok: true }); // Ping response
  }
  
  // 8. Idempotency: check if this order was already processed
  const existing = await prisma.wooCommerceOrderLog.findFirst({
    where: { organizationId: orgId, wooOrderId: order.id, status: "COMPLETED" },
  });
  if (existing) {
    return Response.json({ ok: true, duplicate: true });
  }
  
  // 9. Process the order (async — respond quickly, process in background)
  processWooCommerceOrder(orgId, order, integration).catch(console.error);
  
  // 10. Respond 200 immediately (WooCommerce retries on non-200)
  return Response.json({ ok: true, received: order.id });
}
```

### Processing Logic: `processWooCommerceOrder()`

```typescript
async function processWooCommerceOrder(orgId, order, integration) {
  const log = await prisma.wooCommerceOrderLog.create({
    data: { organizationId: orgId, wooOrderId: order.id, wooOrderNumber: order.number, 
            status: "RECEIVED", payload: order },
  });
  
  try {
    // 1. Create or find client
    const client = await findOrCreateClient(orgId, order.billing);
    
    // 2. Extract rental dates from order meta
    const dates = extractDates(order, integration);
    
    // 3. Match order line items to GearFlow models
    const matchResults = await matchProducts(orgId, order.line_items, integration);
    
    // 4. Create the project
    const project = await createProjectFromOrder(orgId, client, order, dates, matchResults, integration);
    
    // 5. Add line items for matched products
    for (const match of matchResults) {
      if (match.modelId) {
        await addLineItemToProject(project.id, orgId, match);
      }
    }
    
    // 6. Recalculate project totals
    await recalculateProjectTotals(project.id);
    
    // 7. Log success
    await prisma.wooCommerceOrderLog.update({
      where: { id: log.id },
      data: { status: "COMPLETED", projectId: project.id, clientId: client.id, matchResults },
    });
    
    // 8. Notify admins
    await notifyNewWebsiteOrder(orgId, project, client, integration.notifyUserIds);
    
  } catch (error) {
    await prisma.wooCommerceOrderLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMessage: error.message },
    });
  }
}
```

### Client Creation

```typescript
async function findOrCreateClient(orgId, billing) {
  // Try to find by email first
  let client = await prisma.client.findFirst({
    where: { organizationId: orgId, contactEmail: billing.email },
  });
  
  if (!client) {
    // Create new client from WooCommerce billing info
    client = await prisma.client.create({
      data: {
        organizationId: orgId,
        name: billing.company || `${billing.first_name} ${billing.last_name}`,
        type: billing.company ? "COMPANY" : "INDIVIDUAL",
        contactName: `${billing.first_name} ${billing.last_name}`,
        contactEmail: billing.email,
        contactPhone: billing.phone,
        billingAddress: formatAddress(billing),
        tags: ["website-order"],  // Auto-tag for filtering
        isActive: true,
      },
    });
  }
  
  return client;
}
```

### Product Matching

```typescript
async function matchProducts(orgId, lineItems, integration) {
  return Promise.all(lineItems.map(async (item) => {
    let model = null;
    
    switch (integration.productMatchField) {
      case "sku":
        model = await prisma.model.findFirst({
          where: { organizationId: orgId, modelNumber: item.sku, isActive: true },
        });
        break;
      case "custom_field":
        const gearflowId = item.meta_data?.find(m => m.key === integration.customFieldKey)?.value;
        if (gearflowId) {
          model = await prisma.model.findFirst({
            where: { organizationId: orgId, id: gearflowId },
          });
        }
        break;
      case "name":
        model = await prisma.model.findFirst({
          where: { organizationId: orgId, name: { contains: item.name, mode: "insensitive" }, isActive: true },
        });
        break;
    }
    
    return {
      wooProductName: item.name,
      wooSku: item.sku,
      wooQuantity: item.quantity,
      wooPrice: parseFloat(item.price),
      modelId: model?.id || null,
      modelName: model?.name || null,
      matched: !!model,
    };
  }));
}
```

---

## Settings UI

### Route: `/settings/integrations/woocommerce`

```
┌─ WooCommerce Integration ──────────────────────────────────────┐
│                                                                  │
│  Status: [🟢 Enabled]                              [Disable]    │
│                                                                  │
│  ── Connection ──────────────────────────────────────────────── │
│  Store URL: https://www.yourcompany.com.au                       │
│  Webhook URL (copy this to WooCommerce):                         │
│  [https://app.gearflow.com/api/.../webhook?org=xxx]  [📋 Copy] │
│  Webhook Secret: ••••••••••••••••            [👁 Show] [🔄 Regen]│
│                                                                  │
│  ── Product Matching ────────────────────────────────────────── │
│  Match WooCommerce products to GearFlow models by:               │
│  (•) SKU → Model Number                                         │
│  ( ) Custom field key: [____________]                            │
│  ( ) Product name (fuzzy)                                        │
│                                                                  │
│  ── Date Field Mapping ──────────────────────────────────────── │
│  Rental Start: meta key [rental_start_date]                      │
│  Rental End:   meta key [rental_end_date  ]                      │
│  Event Date:   meta key [event_date       ]                      │
│  Delivery Addr:meta key [delivery_address ]                      │
│  Notes:        meta key [customer_note    ]                      │
│                                                                  │
│  ── Project Defaults ────────────────────────────────────────── │
│  Project type: [DRY_HIRE ▾]                                      │
│  Initial status: (•) Enquiry  ( ) Quoting                        │
│  Notify: [Select users to notify ▾]                              │
│                                                                  │
│  ── Recent Orders ───────────────────────────────────────────── │
│  | WC Order | Status    | Project      | Client    | Date      | │
│  | #1234    | ✅ Created | PRJ-0055     | Jane D.   | 15 Mar    | │
│  | #1233    | ✅ Created | PRJ-0054     | Acme Co   | 14 Mar    | │
│  | #1232    | ❌ Failed  | —            | —         | 14 Mar    | │
│  |          | "No matching model for SKU: XYZ-999"               | │
│  | #1231    | ⚠️ Partial | PRJ-0053     | Bob S.    | 13 Mar    | │
│  |          | "2 of 5 products matched"                          | │
│                                                                  │
│  [View all order logs]                                           │
└──────────────────────────────────────────────────────────────────┘
```

### Product Mapping Review

A dedicated section or page showing the current mapping state:
- Table: WooCommerce product name → matched GearFlow model (or "No match ⚠️")
- To populate this, GearFlow would need to fetch the WooCommerce product catalog via the REST API (optional, for the mapping review only — not for normal operation)
- Alternatively, show the mapping table based on past order logs (which products have been seen and whether they matched)

---

## Error Handling & Edge Cases

### Unmatched Products

When a WooCommerce product doesn't match any GearFlow model:
- The project is still created (it's an enquiry — someone will review it)
- Unmatched items are added as a `MISC` line item with the WooCommerce product name as description and the WooCommerce price
- The order log shows "Partial: X of Y products matched"
- The notification to admins highlights unmatched items

### Duplicate Orders

WooCommerce may fire the webhook multiple times (retries on timeout). Idempotency check: if an order ID was already processed successfully, skip it and respond 200.

### WooCommerce Down / GearFlow Down

- If GearFlow is down when WooCommerce fires the webhook, WooCommerce retries (built-in retry logic with exponential backoff)
- If processing fails partway through, the order log records the error. An admin can manually retry from the logs.

### Order Updates / Cancellations

For v1, only `order.created` is handled. Future enhancement: listen for `order.updated` and `order.deleted` to update/cancel the corresponding GearFlow project.

### Customer Note

WooCommerce orders have a `customer_note` field (what the customer types at checkout). This maps to `Project.clientNotes`.

---

## Security

1. **HMAC verification is mandatory.** Every webhook request must have a valid `X-WC-Webhook-Signature` header. Requests without a valid signature are rejected with 401.
2. **Webhook secret is stored encrypted** in `WooCommerceIntegration.webhookSecret`.
3. **Org scoping via URL param.** The `?org=` param in the delivery URL determines which org the order belongs to. The HMAC secret is per-org, so a valid signature for Org A's secret can't be replayed against Org B.
4. **Rate limiting.** Max 30 webhook requests per minute per org. WooCommerce shouldn't exceed this under normal operation.
5. **Payload size limit.** Reject payloads over 1MB (normal orders are well under 100KB).
6. **No outbound calls to WooCommerce in the webhook handler.** The handler is receive-only. This eliminates the need for WooCommerce API credentials on the GearFlow side and reduces the attack surface.

---

## Middleware Exemption

Add to public routes:
```typescript
"/api/integrations/woocommerce/webhook",
```

---

## Server Actions

### `src/server/woocommerce.ts`

```typescript
"use server";
export async function getWooCommerceIntegration(): Promise<WooCommerceIntegration | null>;
export async function updateWooCommerceIntegration(data: WooCommerceIntegrationInput): Promise<WooCommerceIntegration>;
export async function regenerateWebhookSecret(): Promise<{ secret: string }>;
export async function getWooCommerceOrderLogs(filters?: OrderLogFilters): Promise<PaginatedResult<WooCommerceOrderLog>>;
export async function retryFailedOrder(logId: string): Promise<void>;
export async function testWebhookEndpoint(): Promise<{ success: boolean }>;  // Send a test payload to self
```

---

## Integration Points

- **Clients**: Auto-creates clients from WooCommerce billing info, tagged `website-order`. Matches existing clients by email.
- **Projects**: Creates ENQUIRY projects with line items. Uses `recalculateProjectTotals()`.
- **Models**: Product-to-model matching by SKU, custom field, or name.
- **Notifications**: New website order notification to configured users.
- **Activity log**: Log project creation via WooCommerce with order reference.
- **Tags**: Auto-tag created projects with `website-order` for easy filtering.
- **Accessories**: When a matched model has MANDATORY accessories, auto-add them to the project (via the accessories feature).

---

## Implementation Phases

1. `WooCommerceIntegration` and `WooCommerceOrderLog` models + migration
2. Webhook endpoint with HMAC verification
3. Client find-or-create from billing info
4. Project creation from order data
5. Product-to-model matching (SKU strategy)
6. Line item creation for matched products
7. Settings UI with connection config and field mapping
8. Order log viewer with error details
9. Admin notification on new orders
10. Retry failed orders
11. (Future) Product mapping review via WooCommerce REST API
12. (Future) `order.updated` and `order.deleted` webhook handlers
