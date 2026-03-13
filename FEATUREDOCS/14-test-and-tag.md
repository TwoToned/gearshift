# Test & Tag Module (AS/NZS 3760:2022)

## Equipment Classes
- `CLASS_I` — Earth continuity + insulation/leakage
- `CLASS_II` — Insulation/leakage only (no earth)
- `CLASS_II_DOUBLE_INSULATED` — Same as Class II
- `LEAD_CORD_ASSEMBLY` — Earth continuity + always polarity (like Class I but polarity not conditional)

## Status Lifecycle
```
NOT_YET_TESTED → (first test) → CURRENT
CURRENT → (interval expires soon) → DUE_SOON
DUE_SOON → (interval expires) → OVERDUE
Any → (test fails) → FAILED
Any → (manual) → RETIRED
FAILED → (retest passes) → CURRENT
```

## Auto-Incrementing IDs
Same pattern as asset tags. Stored in `Organization.metadata.testTag`:
```json
{ "prefix": "TT", "digits": 5, "counter": 1 }
```

## Settings (`Organization.metadata.testTag`)
- `defaultIntervalMonths`, `defaultEquipmentClass`, `dueSoonThresholdDays`
- `companyName`, `defaultTesterName`, `defaultTestMethod`
- `checkoutPolicy`

## Routes
- `/test-and-tag` — Overview
- `/test-and-tag/registry` — Item list
- `/test-and-tag/new` — Create item
- `/test-and-tag/[id]` — Item detail + test records
- `/test-and-tag/quick-test` — Quick test form
- `/test-and-tag/reports` — 10 report types

## Server Actions
- `src/server/test-tag-assets.ts` — CRUD, batch create, sync
- `src/server/test-tag-records.ts` — Test records, status recalculation
- `src/server/test-tag-reports.ts` — Report data + CSV exports

## Auto-Registration
When creating an asset with a model that has `requiresTestAndTag: true`, a `TestTagAsset` record is automatically created.
