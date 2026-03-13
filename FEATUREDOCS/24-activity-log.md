# Activity Log (Audit Trail)

## Overview
Tracks every significant write operation across all entities. Full audit trail with filtering, searching, and CSV export.

## Logging Utility (`src/lib/activity-log.ts`)
- **`logActivity(input)`**: Creates an ActivityLog record. Wrapped in try/catch — never blocks the main operation.
- **`buildChanges(before, after, fields, labels?)`**: Compares two objects and returns a changes array for UPDATE details.

## Actions Logged
All write operations across 16+ server action files: CREATE, UPDATE, DELETE, STATUS_CHANGE, CHECK_OUT, CHECK_IN, ASSIGN, UNASSIGN, INVITE.

## Server Action: `src/server/activity-log.ts`
- **`getActivityLogs(filters)`**: Paginated query with filters for entityType, action, userId, date range, search.
- **`getEntityActivityLog(entityType, entityId)`**: All logs for a specific entity (max 100).
- **`exportActivityLogCSV(filters)`**: CSV export respecting current filters.

## Page: `/activity`
- Full-width table with filter bar: entity type, action, date range, search, CSV export.
- Expandable rows show field changes ("field: old -> new").
- Paginated, sortable by timestamp (newest first).

## Entity Detail Integration
**`ActivityTimeline`** component (`src/components/activity/activity-timeline.tsx`): Compact timeline for entity detail pages.

## Sidebar & Navigation
- Sidebar: "Activity Log" with `ScrollText` icon, gated by `reports` read permission.
- Page commands: aliases `activity`, `audit`, `log`, `history`, `trail`.

## `getOrgContext()` Enhancement
Returns `userName` (from `session.user.name`) alongside `organizationId` and `userId`, enabling all server actions to log the acting user's name.
