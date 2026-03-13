# Feature: Warehouse Dashboard / TV Screen Display

## Summary

Add a dedicated warehouse dashboard that shows the day's dispatch and return schedule, prep status, and project timeline — designed to be displayed on a wall-mounted TV or monitor in the warehouse. The dashboard is accessed via a shareable, auto-refreshing URL that doesn't require login (token-authenticated), so it can run on a Smart TV, Chromecast, or any browser without managing sessions.

---

## Data Model

### `WarehouseDashboardToken`

```prisma
model WarehouseDashboardToken {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  name            String               // "Main Warehouse TV", "Loading Dock Screen"
  tokenHash       String   @unique     // SHA-256 of the access token
  locationId      String?              // Scope to a specific warehouse location
  location        Location? @relation(fields: [locationId], references: [id], onDelete: SetNull)
  isActive        Boolean  @default(true)
  layout          String   @default("standard")  // "standard", "compact", "dispatch-only"

  createdById     String
  createdBy       User     @relation(fields: [createdById], references: [id], onDelete: Cascade)
  lastAccessedAt  DateTime?
  createdAt       DateTime @default(now())

  @@index([organizationId])
}
```

---

## Access

### Shareable URL

```
https://app.gearflow.com/warehouse/display/{token}
```

The token is a cryptographically random string (32 bytes). The URL is generated in settings, copied, and opened on the warehouse TV's browser. No login required — the token IS the auth (same pattern as iCal feeds). Rate-limited to prevent enumeration.

### Auto-Refresh

The dashboard page auto-refreshes data every 60 seconds (configurable). Uses React Query with a short stale time, or a simple `setInterval` fetch. The page never requires interaction — it's purely a display.

### Settings UI

In `/settings/warehouse` (or a new section in warehouse settings):
- "Display Screens" section
- List of active tokens with name, location scope, last accessed
- "Create Display" button → name, location scope, layout → generates URL with copy button
- Revoke / regenerate token
- QR code for the URL (scan with phone to open, then Cast to TV)

---

## Dashboard Layout — Standard

```
┌──────────────────────────────────────────────────────────────────┐
│  🏭 Main Warehouse                    Tue 15 Mar 2026  14:32:08 │
│──────────────────────────────────────────────────────────────────│
│                                                                   │
│  TODAY'S DISPATCH                        RETURNS DUE TODAY        │
│  ┌────────────────────────────────┐     ┌──────────────────────┐ │
│  │ 🟢 PRJ-0042 Summer Festival   │     │ 🔵 PRJ-0038 Corp Gala│ │
│  │    Delivery 06:00 → Olympic Pk │     │    Due back by 18:00 │ │
│  │    Truck: 3T | Driver: Dave M  │     │    12 items expected │ │
│  │    Prep: ✅ 3/3 cases packed   │     │                      │ │
│  ├────────────────────────────────┤     ├──────────────────────┤ │
│  │ 🟡 PRJ-0045 Theatre Show      │     │ 🔵 PRJ-0040 Wedding │ │
│  │    Delivery 14:00 → Enmore Th │     │    Due back by 12:00 │ │
│  │    Truck: Van | Driver: TBD ⚠️│     │    8 items expected  │ │
│  │    Prep: ⏳ 1/2 cases packed  │     │                      │ │
│  └────────────────────────────────┘     └──────────────────────┘ │
│                                                                   │
│  PREP STATUS                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │FOH Rack  │ │Mic Case A│ │Cable Box │ │Stage Box │           │
│  │PRJ-0042  │ │PRJ-0042  │ │PRJ-0042  │ │PRJ-0045  │           │
│  │✅ Packed │ │✅ Packed │ │✅ Packed │ │⏳ 4/8   │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                   │
│  UPCOMING (Next 7 Days)                                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Wed 16  │ Thu 17  │ Fri 18  │ Sat 19  │ Sun 20  │ Mon 21 │  │
│  │ 1 out   │ 2 out   │ —       │ 1 out   │ —       │ 3 back │  │
│  │ 2 back  │ —       │ 1 back  │ —       │ —       │ —      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ⚠️ ALERTS: PRJ-0045 missing driver assignment                   │
│──────────────────────────────────────────────────────────────────│
│  GearFlow · Auto-refreshes every 60s                   Powered by│
└──────────────────────────────────────────────────────────────────┘
```

### Sections

**Today's Dispatch**: Projects with equipment going out today. Shows delivery time, destination, vehicle, driver, and prep completion status. Colour coded: 🟢 ready, 🟡 partially prepped, 🔴 not started.

**Returns Due Today**: Projects with equipment due back. Shows expected return time and item count.

**Prep Status**: Compact cards for each active prep container. Shows pack progress (items packed / total).

**Upcoming (7-day horizon)**: Simple day grid showing dispatch and return counts per day.

**Alerts**: Critical issues — unassigned drivers, unprepped items for today's dispatch, overdue returns.

---

## Layout Variants

| Layout | Description | Best For |
|--------|-------------|----------|
| **standard** | Full dashboard with all sections | Large TV in main warehouse |
| **compact** | Dispatch + returns only, larger text | Small monitor at loading dock |
| **dispatch-only** | Only today's dispatch with large prep status | Screen near packing area |
| **timeline** | Gantt-style week view of all projects | Office/planning area |

---

## Data Source

### API Route: `GET /api/warehouse/display/[token]`

Returns JSON with all dashboard data. The display page fetches this on load and every refresh interval.

The endpoint:
1. Validates token hash against `WarehouseDashboardToken`
2. Loads the org context from the token
3. If location-scoped: filters to projects dispatching from / returning to that location
4. Returns: today's dispatch, today's returns, active preps, upcoming 7 days, alerts

### Server Action: `src/server/warehouse-display.ts`

```typescript
"use server";
export async function getWarehouseDisplayData(organizationId: string, locationId?: string): Promise<WarehouseDisplayData>;
export async function createDisplayToken(data: CreateDisplayTokenInput): Promise<{ token: string; url: string }>;
export async function revokeDisplayToken(id: string): Promise<void>;
export async function getDisplayTokens(): Promise<WarehouseDashboardToken[]>;
```

---

## Display Page

### Route: `/warehouse/display/[token]`

This page is exempt from auth middleware (added to public routes). It validates the token and renders the dashboard.

**Technical requirements:**
- Full-viewport, no scrolling (everything fits on screen)
- Dark background by default (warehouse TVs look better dark)
- Large text — readable from 3+ metres away
- High contrast colours for status indicators
- Current time displayed prominently (updates every second)
- Auto-refresh data every 60 seconds
- Graceful error handling: if the API is unreachable, show "Last updated: X minutes ago" instead of breaking
- No interactive elements (this is a display, not an app)

### Responsive Sizing

The dashboard adapts to the display resolution:
- **1080p (1920×1080)**: Standard layout, all sections visible
- **4K (3840×2160)**: Larger text and spacing, same layout
- **720p**: Compact layout auto-selected
- **Portrait**: Stack sections vertically (some TVs are mounted portrait for digital signage)

---

## Middleware Exemption

Add to public routes:
```typescript
"/warehouse/display",
"/api/warehouse/display",
```

---

## Integration Points

- **Pre-preps**: Prep status cards show data from the Prep feature. If preps aren't implemented, the prep section is hidden.
- **Services**: Delivery/pickup services drive the dispatch and return sections. Falls back to project dates if services aren't implemented.
- **Crew**: Driver names come from service crew assignments. Shows "TBD ⚠️" if no driver assigned.
- **Multi-warehouse**: Location scoping uses the token's `locationId`. Single-warehouse orgs see everything.
- **Activity log**: Token creation/revocation is logged.

---

## Implementation Phases

1. `WarehouseDashboardToken` model + migration
2. Token generation UI in settings
3. API route for dashboard data
4. Display page with standard layout (dark mode, auto-refresh)
5. Dispatch and returns sections with real-time data
6. Prep status integration
7. Upcoming week view
8. Alerts section
9. Layout variants (compact, dispatch-only, timeline)
10. Mobile exemption in middleware
