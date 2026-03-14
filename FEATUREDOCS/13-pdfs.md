# PDF Document Generation

## Architecture
- `@react-pdf/renderer` renders React components to PDF
- API route: `GET /api/documents/[projectId]?type=quote` streams PDF
- Templates in `src/lib/pdf/`: `quote-pdf.tsx`, `invoice-pdf.tsx`, `packing-list-pdf.tsx`, `return-sheet-pdf.tsx`, `delivery-docket-pdf.tsx`
- Shared styles in `src/lib/pdf/styles.ts`
- Documents accessible from both the **project detail page** and the **warehouse page** via dropdown menus

## Constraints
- **Helvetica only** — no Unicode symbols (use ASCII: `-` not `—`, `|` not `•`)
- Checkboxes rendered as `View` boxes with borders
- Kit contents rendered as indented children under kit parent row
- Accessories rendered as indented children with "Acc." label
- Line item notes shown as subtitles
- Badges: red "OVERBOOKED", purple "REDUCED STOCK"
- Pull slip: per-unit checkboxes for qty > 1 items

## Unified Child Rendering
All 5 PDFs use a unified `allChildren` array that includes both kit children and accessories. Grandchildren (accessories of kit children) rendered at deeper indent. For KIT_PRICE kits on quote/invoice, kit children without individual prices are hidden but accessories are shown.

## T&T Reports
10 PDF templates in `src/lib/pdf/test-tag-*.tsx`. API route: `GET /api/test-tag-reports/[reportType]?format=pdf|csv`. Date objects must be JSON-serialized before passing to PDF components.

| Report | PDF | CSV |
|--------|-----|-----|
| Full Register | Y | Y |
| Overdue/Non-Compliant | Y | Y |
| Test Session | Y | Y |
| Item History | Y | Y |
| Due Schedule | Y | Y |
| Class Summary | Y | Y |
| Tester Activity | Y | Y |
| Failed Items | Y | Y |
| Bulk Asset Summary | Y | N |
| Compliance Certificate | Y | N |
