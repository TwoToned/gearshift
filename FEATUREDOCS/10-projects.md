# Project & Rental Management

## Status Flow
```
ENQUIRY → QUOTING → QUOTED → CONFIRMED → PREPPING → CHECKED_OUT → ON_SITE → RETURNED → COMPLETED → INVOICED
                                                                                        ↗
                                           Any status → CANCELLED ─────────────────────┘
```

## Financial Calculations (`recalculateProjectTotals()`)
- `subtotal` = sum of `lineTotal` for non-optional, non-cancelled items
- `discountAmount` = `subtotal * discountPercent / 100`
- `taxAmount` = `(subtotal - discountAmount) * 0.10` (10% GST hardcoded)
- `total` = `subtotal - discountAmount + taxAmount`
- `invoicedTotal` = manual override (e.g., from Xero)
- Called automatically whenever line items change

## Project Types
`DRY_HIRE, WET_HIRE, INSTALLATION, TOUR, CORPORATE, THEATRE, FESTIVAL, CONFERENCE, OTHER`

## Subhire
Line items with `isSubhire: true` and `supplierId` reference third-party equipment. `showSubhireOnDocs` controls visibility on client-facing PDFs.

## Line Item Types
- **EQUIPMENT**: Links to `modelId`, optionally `assetId`, `bulkAssetId`, or `kitId`
- **SERVICE / LABOUR / TRANSPORT / MISC**: No asset link, just description + pricing

## Pricing Types
- `PER_DAY`: `unitPrice * duration` (duration in days)
- `PER_WEEK`: `unitPrice * duration` (duration in weeks)
- `PER_HOUR`: `unitPrice * duration` (duration in hours)
- `FLAT`: `unitPrice` (no duration multiplier)

## Visual Groups
- `groupName` field on line items for visual grouping
- Groups are drag-and-drop reorderable via `reorderLineItems()`
- `ComboboxPicker` with `creatable` mode lets users type new group names
- New groups tracked in `extraGroups` local state for immediate UI updates

## Duplicate Model Handling
Adding a model that already exists as a line item on the project **merges** into the existing line item (increments quantity) rather than creating a new row.

## Project Templates
- `Project.isTemplate = true`. Templates use the same `Project` table but are completely isolated.
- `generateTemplateCode()` creates `TPL-0001`, `TPL-0002`, etc.
- Templates MUST be excluded from: dashboard stats, notifications, reports, search results, availability calendar, availability checks
- All project list queries: add `isTemplate: false` filter
- `updateProjectStatus()` rejects templates. `getProjectForWarehouse()` throws for templates.
- Template detail page hides: status dropdown, documents button, cancel/archive/delete, financial summary, dates card
- "Use Template" → `duplicateProject(templateId, { isTemplate: false })` → creates real project
- "Save as Template" → `saveAsTemplate(projectId)` → creates template from real project
- Both call `recalculateProjectTotals` AFTER transaction commits (not inside)
