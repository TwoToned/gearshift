# Feature: Move Availability to Main Sidebar

## Summary

Promote the Availability Calendar from its current location nested under Assets (`/assets/availability`) to a top-level sidebar item with its own route (`/availability`). It should sit alongside Projects, Warehouse, etc. as a first-class navigation destination.

## Current State

- Route: `src/app/(app)/assets/availability/page.tsx`
- Sidebar: nested under the "Assets" group as a child item
- Page commands: listed under assets in `src/lib/page-commands.ts`
- Top bar: `segmentLabels` maps the `availability` segment under the `assets` parent

## Changes Required

### 1. Move the Route

- Create `src/app/(app)/availability/page.tsx` — move the existing page component here
- Delete `src/app/(app)/assets/availability/page.tsx`
- If there is a layout file specific to the old route, move or remove it

### 2. Update Sidebar (`src/components/layout/app-sidebar.tsx`)

- Remove "Availability" from the Assets sub-items
- Add a new top-level nav item:
  ```typescript
  {
    title: "Availability",
    url: "/availability",
    icon: Calendar, // or CalendarRange — use whatever icon suits best
    resource: "asset", // keep using asset read permission
  }
  ```
- Place it logically — after Projects or after Warehouse, wherever makes the most navigational sense (probably between Projects and Warehouse)

### 3. Update Top Bar Breadcrumbs (`src/components/layout/top-bar.tsx`)

- Add `availability: "Availability"` to `segmentLabels` as a top-level segment
- Remove any old mapping that had it nested under `assets`

### 4. Update Page Commands (`src/lib/page-commands.ts`)

- Move the Availability entry out of the Assets children and into the top-level `PAGE_COMMANDS` array
- Update `href` from `/assets/availability` to `/availability`
- Keep existing aliases like `"calendar"`, `"booking"`, `"schedule"` etc.

### 5. Update Any Internal Links

Search the codebase for any `href` or `router.push` pointing to `/assets/availability` and update to `/availability`. Likely places:
- Dashboard upcoming projects links
- Notification links
- Command search date shortcut navigation (command-search.tsx navigates to the availability calendar when a date is typed)
- Any "Check Availability" buttons on project or line item forms

### 6. Update ARCHITECTURE.md and CLAUDE.md

- Move the availability route from the Assets section to its own top-level entry in the page routes table
- Update the sidebar description
- Update any references to the old path

## Permissions

No change — continue gating on `asset: read` permission (or whatever permission is currently used for the availability page).

## Notes

- This is purely a navigation/routing change. No business logic, database, or component changes are needed beyond moving files and updating paths.
- The page component itself should remain identical — just relocated.
