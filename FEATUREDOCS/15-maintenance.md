# Maintenance System

## Multi-Asset Records
One `MaintenanceRecord` links to multiple assets via `MaintenanceRecordAsset` join table. The form uses barcode scanning (continuous mode) to add assets.

## Types & Statuses
- Types: `REPAIR, PREVENTATIVE, TEST_AND_TAG, INSPECTION, CLEANING, FIRMWARE_UPDATE`
- Statuses: `SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED`
- Results: `PASS, FAIL, CONDITIONAL`

## Notifications
Overdue maintenance generates notifications. Shows first asset name + count for multi-asset records.
