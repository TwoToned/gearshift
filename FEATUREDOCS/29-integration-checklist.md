# Integration Checklist for New Features

When implementing a new feature, ensure it integrates with ALL existing systems.

| System | What to Do |
|--------|-----------|
| **Permissions** | Add resource to `src/lib/permissions.ts`. Use `requirePermission()` in server actions. |
| **Sidebar** | Add nav item to `src/components/layout/app-sidebar.tsx` with `resource` for gating. |
| **Top bar** | Add segment label to `segmentLabels` in `src/components/layout/top-bar.tsx`. |
| **Search** | Add entity search to `globalSearch()` in `src/server/search.ts`. Add to both `typeMap` objects and `typeIcons`/`typeLabels`/`pageIcons` in `command-search.tsx`. |
| **Page commands** | Add to `PAGE_COMMANDS` in `src/lib/page-commands.ts` for @ navigation. |
| **Notifications** | Add time-based alerts to `src/server/notifications.ts` if applicable. |
| **Dashboard** | Add stats/activity to `src/server/dashboard.ts` if relevant. |
| **Templates** | If querying projects, add `isTemplate: false` filter. |
| **Mobile** | Responsive tables, touch targets, text wrapping (`break-words min-w-0`). |
| **Safe areas** | Full-screen mobile dialogs need safe area padding via `style` prop. |
| **Org scoping** | Every query MUST include `organizationId`. Use `getOrgContext()`. |
| **Serialization** | Always `serialize()` return values from server actions. |
| **Validation** | Zod schema in `src/lib/validations/`. Use `z.input<>` for form types. |
| **Tags** | If entity has `tags String[]`, add `TagInput` to form and tags column to table. |
| **Activity Log** | Add `logActivity()` calls to all write operations in server actions. |
| **Media** | If entity has photos, create `{Entity}Media` join table + `MediaUploader`. |
| **CSV** | Consider import/export if bulk data operations are useful. |
| **Org export** | Add new table to `src/lib/org-export.ts` and `src/lib/org-import.ts`. |
| **Documentation** | Update ARCHITECTURE.md overview and add/update relevant FEATUREDOCS file. |
