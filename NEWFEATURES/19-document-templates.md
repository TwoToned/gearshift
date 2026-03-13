# Feature: Configurable Document Templates — Full Replacement of PDF System

## Summary

Replace the entire existing PDF document generation system (`@react-pdf/renderer` with code-defined templates) with a user-configurable template system powered by `pdfme`. Every document type in GearFlow — quotes, invoices, packing lists, return sheets, delivery dockets, call sheets, and T&T reports — becomes a visually editable template that org admins design through a WYSIWYG drag-and-drop editor. Templates are stored as JSON, rendered via pdfme's generation engine, and the old `@react-pdf/renderer` code is fully retired.

This is a **complete replacement**, not a parallel system. Every PDF that GearFlow generates will flow through pdfme.

---

## Table of Contents

1. Why Full Replacement
2. pdfme Architecture Overview
3. Data Model
4. Document Types & Data Contracts
5. Custom pdfme Plugins (GearFlow Schemas)
6. The Template Designer
7. Default Templates (Ship-Ready)
8. PDF Generation Pipeline
9. Template Selection & Per-Project Override
10. Font System
11. Branding Integration
12. T&T Report Templates
13. Migration: Removing @react-pdf/renderer
14. Server Actions
15. API Route Changes
16. Settings UI
17. Shared Project Document Access
18. Permissions
19. Organization Export/Import
20. Activity Log Integration
21. Implementation Phases

---

## 1. Why Full Replacement

The current system has code-defined React components (`quote-pdf.tsx`, `invoice-pdf.tsx`, etc.) using `@react-pdf/renderer`. Problems:

- **Users can't change anything.** Layout, columns, colours, logos, text — all hardcoded.
- **Helvetica only.** The `@react-pdf/renderer` Unicode limitation means no special characters, no custom fonts. pdfme uses `pdf-lib` with full font embedding.
- **Maintenance burden.** Six project document templates + ten T&T report templates = 16 React components to maintain.
- **No per-org customisation.** Every org gets identical documents.

The replacement must be total. A parallel system creates confusion. By converting all existing templates to pdfme JSON and shipping them as defaults, every org gets identical output on day one with the ability to customise going forward.

---

## 2. pdfme Architecture Overview

pdfme (3,400+ GitHub stars, MIT, TypeScript) has two core concepts:

**`basePdf`**: Background PDF for the fixed part. Can be a blank page (with size/margins), an uploaded letterhead PDF, or a multi-page PDF with different first-page layout.

**`schemas`**: Array of field definitions per page. Each entry has: `type` (plugin), `position` (x, y in mm), `width`, `height`, `content` (static text or `{variable}` tokens), and plugin-specific properties.

### Three Components

- **Designer** (`@pdfme/ui`) — WYSIWYG drag-and-drop canvas for building templates
- **Viewer** (`@pdfme/ui`) — Read-only preview with data
- **generate** (`@pdfme/generator`) — Renders template + data to PDF buffer (works in both browser and Node.js)

### Packages

```bash
npm install @pdfme/common @pdfme/schemas @pdfme/ui @pdfme/generator
```

---

## 3. Data Model

### `DocumentTemplate`

```prisma
model DocumentTemplate {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  name            String
  description     String?
  type            DocumentType

  // pdfme template data
  basePdf         Json                 // pdfme basePdf config or base64 PDF
  schemas         Json                 // pdfme schemas array
  sampleInputs    Json?                // Sample data for preview

  // Page config
  pageSize        String   @default("A4")
  orientation     String   @default("portrait")

  // Status
  isDefault       Boolean  @default(false)
  isSystemDefault Boolean  @default(false)       // Shipped with GearFlow, read-only
  isActive        Boolean  @default(true)
  isDraft         Boolean  @default(true)
  version         Int      @default(1)
  publishedAt     DateTime?

  // Branding overrides
  logoUrl         String?
  primaryColor    String?
  accentColor     String?
  fontFamily      String?

  // Preview
  thumbnailUrl    String?

  createdById     String?
  createdBy       User?    @relation(fields: [createdById], references: [id], onDelete: SetNull)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([organizationId, name, type])
  @@index([organizationId, type])
  @@index([organizationId, type, isDefault])
}

enum DocumentType {
  QUOTE
  INVOICE
  PACKING_LIST
  RETURN_SHEET
  DELIVERY_DOCKET
  CALL_SHEET
  TT_FULL_REGISTER
  TT_OVERDUE
  TT_TEST_SESSION
  TT_ITEM_HISTORY
  TT_DUE_SCHEDULE
  TT_CLASS_SUMMARY
  TT_TESTER_ACTIVITY
  TT_FAILED_ITEMS
  TT_BULK_SUMMARY
  TT_COMPLIANCE_CERT
  PURCHASE_ORDER
  CUSTOM
}
```

---

## 4. Document Types & Data Contracts

Each document type defines a data contract — the variables available in templates. At generation time, `{variable}` tokens are resolved against this data.

### Project Document Data Contract (shared by all 6 project doc types)

**Organisation fields:** `org_name`, `org_logo` (base64), `org_address`, `org_phone`, `org_email`, `org_website`, `org_abn`

**Project fields:** `project_number`, `project_name`, `project_type`, `project_status`, `project_description`

**Date fields:** `rental_start`, `rental_end`, `event_start`, `event_end`, `load_in_date`, `load_in_time`, `load_out_date`, `load_out_time`

**Client fields:** `client_name`, `client_contact`, `client_email`, `client_phone`, `client_billing_address`, `client_shipping_address`, `client_tax_id`

**Location fields:** `venue_name`, `venue_address`, `site_contact_name`, `site_contact_phone`, `site_contact_email`

**Financial fields:** `subtotal`, `discount_percent`, `discount_amount`, `tax_label`, `tax_amount`, `total`, `deposit_percent`, `deposit_amount`, `invoiced_total`, `amount_due`

**Notes fields:** `client_notes`, `crew_notes`, `internal_notes`

**Metadata fields:** `document_date`, `document_number`, `page_number`, `total_pages`, `project_manager`

**Complex data (for custom plugins):** `line_items` (array of row objects), `line_items_by_group` (grouped), `services` (array), `crew_assignments` (array), `overbooked_items` (array)

### Type-Specific Additions

| Type | Extra Fields |
|------|-------------|
| QUOTE | `quote_valid_until`, `terms_and_conditions`, `payment_terms` |
| INVOICE | `invoice_number`, `invoice_date`, `due_date`, `payment_instructions`, `bank_details` |
| PACKING_LIST | `packed_by`, `checked_by`, per-item checkbox rendering |
| RETURN_SHEET | `returned_by`, `received_by`, condition columns |
| DELIVERY_DOCKET | `delivery_address`, `delivery_date`, `delivery_time`, `driver_name`, `vehicle`, signature block |
| CALL_SHEET | `call_date`, crew table, `parking_notes`, `catering_notes` |

### Line Item Row Data

Each item in `line_items` has: `description`, `model_name`, `category`, `quantity`, `unit_price`, `pricing_type`, `duration`, `discount`, `line_total`, `notes`, `asset_tag`, `serial_number`, `is_kit`, `is_kit_child`, `is_accessory`, `is_optional`, `is_subhire`, `supplier_name`, `group_name`, `overbooked`, `reduced_stock`, `checked_out`, `checked_out_quantity`, `returned_quantity`, `return_condition`

---

## 5. Custom pdfme Plugins (GearFlow Schemas)

GearFlow builds custom pdfme plugins for complex data rendering. Each plugin implements `pdf` (for generation), `ui` (for designer preview), and `propPanel` (for the properties sidebar).

### `gearflowTable` — Equipment Table

The most complex plugin. Renders the line item table with configurable columns:

**Configurable columns:** Item/Description, Qty, Unit Price, Rate Type, Duration, Discount, Total, Notes, Asset Tag, Serial Number, Checkbox (for packing lists), Condition (for return sheets)

**Properties panel:** Column visibility toggles, column order (drag), column widths, header background/text colour, alternating row colours, border style, font size, show/hide kit children (indented), show/hide accessories (indented), show/hide optional items (with style: italic/muted/strikethrough), show/hide subhire items, show/hide group headers, show/hide notes as subtitles, show/hide overbooking badges, per-unit checkboxes (for packing list qty>1)

### `gearflowFinancialSummary` — Financial Block

Renders subtotal/discount/tax/total. Properties: which lines to show, custom labels (change "GST" to "VAT"), alignment, total font size/bold, separator line.

### `gearflowServicesTable` — Services Table

For quotes/invoices showing project services. Columns: service name, date, details, total.

### `gearflowCrewTable` — Crew Table

For call sheets. Columns: name, role, call time, end time, phone, notes.

### `gearflowPageHeader` — Header Block

Logo + company info + document title. Properties: logo position (left/centre/right), logo max size, company info fields to show, title text/style, layout (horizontal/stacked).

### `gearflowPageFooter` — Footer Block

Page numbers + tagline + terms link. Properties: content, alignment, font size, "Page X of Y" format.

### `gearflowCheckbox` — Empty Checkbox

Renders an empty square (for printed paper checklists).

### `gearflowSignatureLine` — Signature Block

"Received by: _____ Date: _____ Signature: _____" with configurable labels.

### `gearflowBadge` — Status Badge

Coloured pill/badge for OVERBOOKED, REDUCED STOCK, OPTIONAL, SUBHIRE labels.

### Plugin Registration

All plugins registered in `src/lib/pdfme/plugins/index.ts` and passed to both the Designer and the `generate()` function.

---

## 6. The Template Designer

### Route: `/settings/documents/designer/[id]`

Full-screen page with three panels:

**Left — Field Palette:**
- **Static elements:** Text, Image, Line, Rectangle, Ellipse, QR Code, Barcode
- **Data fields** (grouped): Organisation, Project, Client, Dates, Location, Contact, Financials, Notes, Metadata. Each is a draggable token that creates a text element with `{token_name}`.
- **GearFlow components:** Equipment Table, Services Table, Crew Table, Financial Summary, Page Header, Page Footer, Signature Line, Checkbox

**Centre — Canvas:**
- pdfme Designer renders here (the library provides the drag-and-drop, selection, resize, alignment guides, snap-to-grid, copy/paste, undo/redo)
- Multi-page with page tabs and "Add Page"
- Zoom controls (25%-400%)
- Shows REAL data from a selected project (not lorem ipsum)

**Right — Properties Panel:**
- Context-sensitive: text properties (font, size, weight, colour, alignment), table column configuration, financial summary toggles, header layout, position/size in mm

**Bottom — Data Preview Bar:**
- "Using data from: PRJ-0042 Summer Festival [Change Project]"
- Selecting a different project re-renders the canvas with that project's data instantly

### Save States

- **Draft**: Saved but not usable for generation. Work-in-progress.
- **Published**: Active, used for document generation. Publishing increments version and sets `publishedAt`.
- Editing a published template creates a draft. Published version keeps working until new draft is published.

---

## 7. Default Templates (Ship-Ready)

GearFlow ships system defaults replicating current `@react-pdf/renderer` output exactly:

| Type | Template Name | Layout |
|------|--------------|--------|
| QUOTE | "GearFlow Quote" | Header + client + dates + equipment table (grouped, with pricing) + financial summary + notes + terms |
| INVOICE | "GearFlow Invoice" | Same as quote, titled "TAX INVOICE", + invoice number + due date + payment details |
| PACKING_LIST | "GearFlow Packing List" | Header + equipment table (checkbox column, no pricing) + per-unit checkboxes for qty>1 |
| RETURN_SHEET | "GearFlow Return Sheet" | Header + equipment table with condition columns (GOOD/DAMAGED/MISSING) + signature |
| DELIVERY_DOCKET | "GearFlow Delivery Docket" | Header + delivery address/time + simplified equipment list + driver info + recipient signature |
| CALL_SHEET | "GearFlow Call Sheet" | Header + date/venue + crew table + parking/access notes |
| 10x T&T Reports | "GearFlow [Report Name]" | Replicating current test-tag-*.tsx layouts |

System defaults: `isSystemDefault: true`, cannot be edited directly (show "Duplicate to customise" instead of "Edit"), updated by GearFlow releases without affecting org customisations.

**First-time experience:** No `DocumentTemplate` records for the org → system defaults used → generating a document works identically to today → clicking "Customise" in settings duplicates system default into org's templates → user edits their copy.

---

## 8. PDF Generation Pipeline

### Server-Side (API Route)

```
Request: GET /api/documents/{projectId}?type=quote&templateId=optional
  ↓
1. Auth + org context
  ↓
2. Load template: specific templateId → org default for type → system default
  ↓
3. Load project data via buildDocumentData(projectId, orgId, type)
  ↓
4. Resolve {variable} tokens in all schema text fields
  ↓
5. Load fonts (template.fontFamily or org default)
  ↓
6. Call pdfme generate({ template, inputs, plugins, fonts })
  ↓
7. Stream PDF response
```

### `buildDocumentData()` — The Core Data Assembly

Loads project with all relations, org branding, computes overbooking status, formats all values into the data contract. This is the single function that converts database entities into the flat token map that templates consume.

### Client-Side Preview

The designer's "Preview" button calls `generate()` in the browser with the current template and real project data. Renders in ~100ms per page. Opens in a new tab as a blob URL.

---

## 9. Template Selection & Per-Project Override

### Document Generation Dropdown

On the project detail page, if multiple templates exist for a type, show a sub-menu:
```
Quote → Default Quote ✓ | Premium Quote | Compact Quote
```

Single template = generate immediately. Multiple = show picker.

### Per-Project Override

Store in `Project.metadata.documentTemplates`:
```json
{ "QUOTE": "template_abc", "INVOICE": "template_def" }
```

This override takes precedence over the org default for that specific project.

---

## 10. Font System

Curated set bundled as base64: **Inter** (default), **Helvetica** (backward compat), **Lora** (serif), **Roboto**, **JetBrains Mono**, **Noto Sans** (full Unicode). Custom font upload via branding settings is a v2 stretch goal.

---

## 11. Branding Integration

New templates inherit org branding: logo, primary colour, accent colour, font family. All overridable per-template in the designer.

---

## 12. T&T Report Templates

All 10 T&T report types become configurable templates with their own data contracts. System defaults replicate current output. The API route `GET /api/test-tag-reports/[reportType]` switches to pdfme generation.

---

## 13. Migration: Removing @react-pdf/renderer

1. Build pdfme infrastructure (plugins, data contracts, generation)
2. Create system defaults that exactly replicate current output
3. Visual comparison testing (old engine vs new engine, same document)
4. Switch API routes to pdfme with feature flag for rollback
5. One release cycle of parallel availability
6. Remove all `src/lib/pdf/*.tsx` files (16 files)
7. Uninstall `@react-pdf/renderer`
8. Update ARCHITECTURE.md and CLAUDE.md

---

## 14. Server Actions

### `src/server/document-templates.ts`

- Template CRUD: `create`, `update`, `delete`, `duplicate`, `publish`
- Queries: `getTemplates`, `getById`, `getDefault`, `getSystemDefault`
- Operations: `setDefault`, `generateThumbnail`, `getPreviewData`, `getAvailableDataFields`
- Per-project: `setProjectDocumentTemplate`, `clearProjectDocumentTemplate`

---

## 15. API Route Changes

- **Updated:** `GET /api/documents/[projectId]` — uses pdfme, accepts optional `templateId`
- **Updated:** `GET /api/test-tag-reports/[reportType]` — uses pdfme for PDF (CSV unchanged)
- **New:** `GET /api/document-templates/[id]/preview` — preview PDF with sample data
- **New:** `POST /api/document-templates/[id]/thumbnail` — generate PNG thumbnail

---

## 16. Settings UI

Route: `/settings/documents` — template cards grouped by document type. Each card: thumbnail, name, default/system/draft badges, Edit/Duplicate/Set Default/Delete actions. System defaults show "Customise" (duplicates then opens designer).

Sidebar: `{ title: "Documents", url: "/settings/documents", icon: "FileText" }`

---

## 17. Shared Project Document Access

Share scope's `allowDocumentDownload` and `documentTypes` control access. `buildDocumentData()` accepts optional `ShareScope` to filter data (hide pricing, crew rates, etc.). The pdfme template renders whatever data it receives — scope filtering happens at the data layer, not the template layer.

---

## 18. Permissions

Uses existing `document` resource: `read` (generate/download), `create` (new templates), `update` (edit/set defaults), `delete` (remove custom templates). System defaults cannot be deleted.

---

## 19. Organization Export/Import

Export `DocumentTemplate` records (excluding system defaults). Import with ID remapping. Handle `basePdf` that references uploaded letterhead PDFs via S3.

---

## 20. Activity Log Integration

Log: template created/updated/published/deleted, set as default, duplicated, per-project override changes.

---

## 21. Implementation Phases

### Phase 1: pdfme Infrastructure
1. Install packages
2. Build ALL custom GearFlow plugins (equipment table is the big one)
3. Define data contracts for all 6 project document types
4. Build `buildDocumentData()` function
5. Build token resolution
6. Test: generate a quote via pdfme with hardcoded template JSON

### Phase 2: System Default Templates
1. Recreate Quote, Invoice, Packing List, Return Sheet, Delivery Docket, Call Sheet as pdfme JSON
2. Visual comparison with current output
3. Store as JSON files in codebase

### Phase 3: Template Designer UI
1. `DocumentTemplate` model + migration + CRUD
2. Settings page with template cards
3. Full-screen designer with pdfme Designer component
4. Field palette, properties panel, data preview
5. Save draft / publish workflow
6. Thumbnail generation

### Phase 4: Switch Generation Pipeline
1. Update `/api/documents/[projectId]` to use pdfme
2. Template selection logic (project override → org default → system default)
3. Template picker on project detail page
4. Verify all 6 project doc types

### Phase 5: T&T Report Migration
1. Data contracts for 10 T&T report types
2. System defaults for each
3. Update `/api/test-tag-reports/[reportType]`
4. Verification

### Phase 6: Remove @react-pdf/renderer
1. Feature flag for rollback
2. Parallel testing period
3. Remove `src/lib/pdf/*.tsx` (16 files) + `styles.ts`
4. Uninstall package
5. Update docs

### Phase 7: Polish
1. Custom font upload
2. Letterhead PDF upload as basePdf
3. Multi-page first-page-different layouts
4. Template JSON export/import between orgs

---

## Notes

- **This replaces 16 React components** with a single JSON-driven engine. Massive maintenance reduction.
- **The equipment table plugin is the hardest part.** It handles: grouped items, kit children (indented), accessory children (indented), optional items (styled), subhire, notes subtitles, overbooking badges, checkboxes (packing list), condition columns (return sheet), per-unit checkboxes for qty>1. Budget significant time here.
- **pdfme's Designer is battle-tested.** Canvas drag-and-drop, selection, alignment, undo/redo are all provided. GearFlow wraps it with the field palette and properties — the hard UI is already built.
- **System defaults are the migration safety net.** Zero visual change on day one for users who don't customise.
- **The data contract is the stable API.** Templates consume data contracts. New fields can be added without breaking existing templates. Template designers don't need to touch code.
- **Performance improves.** pdfme generates at ~100ms/page vs @react-pdf/renderer's React rendering overhead.
