# Notification System

## Types
| Type | Trigger | Link |
|------|---------|------|
| `overdue_maintenance` | scheduledDate passed, status != COMPLETED | `/maintenance/{id}` |
| `overdue_return` | rentalEndDate passed, status in active statuses | `/projects/{id}` |
| `upcoming_project` | rentalStartDate within 3 days | `/projects/{id}` |
| `low_stock` | bulkAsset.availableQuantity <= reorderThreshold | `/assets/registry/{id}` |
| `pending_invitation` | Pending invitations for current user | `/settings/team` |

## Implementation
- Server: `getNotifications()` in `src/server/notifications.ts` queries all types
- Client: `src/components/layout/notifications.tsx` — bell icon with dropdown
- Dismiss: localStorage-based via `getDismissedIds()`/`saveDismissedIds()`. Click dismisses + navigates to `href`
