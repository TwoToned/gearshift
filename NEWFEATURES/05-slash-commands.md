# Feature: Slash Commands — Context-Aware Page Actions

## Summary

Add slash command support (`/command`) to the command palette/search that provides quick actions scoped to the current page. For example, typing `/picklist` on a project page generates the pick list PDF, `/equipment` navigates to the equipment section, etc. Commands are page-contextual — only commands relevant to the current page appear.

## Current State

- Command search (`src/components/layout/command-search.tsx`) supports:
  - **Normal mode**: free text → `globalSearch()` results
  - **@ mode**: page navigation via `PAGE_COMMANDS`
  - **Date shortcuts**: typing a date navigates to availability calendar
- No slash command mode exists yet

## Design

### Triggering

- When the user types `/` as the first character in the command palette, switch to **slash command mode**
- Show a filtered list of commands available for the current page
- As the user types after `/`, filter commands by label/alias match
- Pressing Enter or clicking a command executes it immediately
- Pressing Escape or clearing the `/` returns to normal search mode

### Command Definition Structure

```typescript
// src/lib/slash-commands.ts

export interface SlashCommand {
  id: string;                    // Unique identifier
  label: string;                 // Display name: "Generate Pick List"
  command: string;               // What the user types: "picklist"
  aliases: string[];             // Alternative triggers: ["pullsheet", "pull-sheet"]
  description: string;           // Shown in command list
  icon: string;                  // Lucide icon name
  // Where this command is available:
  pages: string[];               // Route patterns: ["/projects/[id]"]
  // What it does:
  action: SlashCommandAction;
}

type SlashCommandAction =
  | { type: "navigate"; path: string }           // Go to a URL (can use :id placeholder)
  | { type: "navigate_section"; hash: string }    // Scroll to section on current page
  | { type: "open_dialog"; dialog: string }       // Open a named dialog
  | { type: "generate_document"; docType: string } // Generate and open a PDF
  | { type: "external_url"; url: string }         // Open external link
  | { type: "trigger"; event: string }            // Dispatch a custom event that page components listen for
```

### Page Matching

Commands specify which pages they're available on via route patterns. The current route is matched against these patterns:

```typescript
// Pattern matching examples:
"/projects/[id]"          // Matches /projects/abc123
"/projects"               // Matches /projects (list page only)
"/assets/registry/[id]"   // Matches /assets/registry/abc123
"/assets/registry"        // Matches /assets/registry (list page)
"*"                       // Available everywhere (global commands)
```

Use `usePathname()` from Next.js to get the current route, then match against command page patterns.

### Resolving Dynamic Segments

For commands that reference the current entity (e.g., "generate pick list for this project"), the command system needs access to the current page's entity ID. Extract `:id` from the URL path and substitute it into action paths.

```typescript
// If current URL is /projects/abc123 and command action is:
{ type: "navigate", path: "/warehouse/:id" }
// Resolves to: /warehouse/abc123

// For document generation:
{ type: "generate_document", docType: "packing-list" }
// Opens: /api/documents/abc123?type=packing-list
```

## Command Registry

### Global Commands (available on all pages)

| Command | Aliases | Action | Description |
|---------|---------|--------|-------------|
| `/new-project` | `newproject`, `create-project` | Navigate to `/projects/new` | Create a new project |
| `/new-asset` | `newasset`, `create-asset` | Navigate to `/assets/registry/new` | Create a new asset |
| `/new-kit` | `newkit`, `create-kit` | Navigate to `/kits/new` | Create a new kit |
| `/new-model` | `newmodel` | Navigate to `/assets/models/new` | Create a new model |
| `/new-client` | `newclient` | Navigate to `/clients/new` | Create a new client |
| `/new-crew` | `newcrew`, `add-crew` | Navigate to `/crew/new` | Create a new crew member |
| `/settings` | `preferences`, `config` | Navigate to `/settings` | Open settings |
| `/dashboard` | `home`, `overview` | Navigate to `/dashboard` | Go to dashboard |

### Project Detail Page (`/projects/[id]`)

| Command | Aliases | Action | Description |
|---------|---------|--------|-------------|
| `/picklist` | `pullsheet`, `pull-sheet`, `pick-list` | Generate packing list PDF | Generate and open pick list |
| `/quote` | `quotation` | Generate quote PDF | Generate and open quote document |
| `/invoice` | `inv` | Generate invoice PDF | Generate and open invoice |
| `/return-sheet` | `returnsheet`, `returns` | Generate return sheet PDF | Generate and open return sheet |
| `/delivery-docket` | `delivery`, `docket` | Generate delivery docket PDF | Generate and open delivery docket |
| `/call-sheet` | `callsheet`, `crew-sheet` | Generate call sheet PDF | Generate and open call sheet for today (or prompt for date) |
| `/equipment` | `line-items`, `items`, `gear` | Scroll to line items section | Jump to equipment/line items |
| `/add-equipment` | `add-item`, `add-gear` | Open add equipment dialog | Open the add equipment dialog |
| `/crew` | `staff`, `team`, `labour` | Scroll to crew tab/section | Jump to crew assignments |
| `/add-crew` | `assign-crew`, `add-staff` | Open add crew dialog | Open the crew assignment dialog |
| `/warehouse` | `checkout`, `checkin` | Navigate to `/warehouse/:id` | Open warehouse view for this project |
| `/share` | `send`, `invite` | Open share dialog | Share this project |
| `/duplicate` | `copy`, `clone` | Trigger duplicate action | Duplicate this project |
| `/edit` | `modify` | Navigate to `/projects/:id/edit` | Edit this project |
| `/client` | `customer` | Navigate to client detail | Go to this project's client page |

### Project List Page (`/projects`)

| Command | Aliases | Action | Description |
|---------|---------|--------|-------------|
| `/new` | `create`, `add` | Navigate to `/projects/new` | Create new project |
| `/templates` | `template` | Navigate to `/projects/templates` | View templates |
| `/filter-active` | `active` | Apply status filter | Show active projects only |
| `/filter-enquiry` | `enquiries` | Apply status filter | Show enquiries |

### Asset Detail Page (`/assets/registry/[id]`)

| Command | Aliases | Action | Description |
|---------|---------|--------|-------------|
| `/edit` | `modify` | Navigate to edit page | Edit this asset |
| `/maintenance` | `repair`, `service` | Open create maintenance dialog or navigate | Create maintenance record for this asset |
| `/qr` | `qrcode`, `barcode`, `label` | Trigger QR code generation | Generate/print QR code |
| `/history` | `log`, `activity` | Scroll to history tab | View asset history |
| `/checkout-history` | `rentals`, `projects` | Scroll to projects section | View checkout history |

### Model Detail Page (`/assets/models/[id]`)

| Command | Aliases | Action | Description |
|---------|---------|--------|-------------|
| `/edit` | `modify` | Navigate to edit page | Edit this model |
| `/new-asset` | `add-asset`, `create-asset` | Navigate with model pre-selected | Create asset of this model |
| `/assets` | `inventory`, `stock` | Scroll to assets tab | View all assets of this model |

### Kit Detail Page (`/kits/[id]`)

| Command | Aliases | Action | Description |
|---------|---------|--------|-------------|
| `/edit` | `modify` | Navigate to edit page | Edit this kit |
| `/contents` | `items`, `assets` | Scroll to contents section | View kit contents |
| `/add-item` | `add-asset` | Open add item dialog | Add asset to kit |

### Warehouse Page (`/warehouse/[projectId]`)

| Command | Aliases | Action | Description |
|---------|---------|--------|-------------|
| `/picklist` | `pullsheet` | Navigate to pull sheet | Open pull sheet view |
| `/scan` | `camera` | Open barcode scanner | Open scanner for checkout |
| `/project` | `details` | Navigate to `/projects/:id` | Go to project detail |

### Client Detail Page (`/clients/[id]`)

| Command | Aliases | Action | Description |
|---------|---------|--------|-------------|
| `/edit` | `modify` | Navigate to edit page | Edit this client |
| `/projects` | `rentals`, `bookings` | Scroll to projects section | View client's projects |
| `/new-project` | `create-project` | Navigate to new project with client pre-selected | Create project for this client |

### Settings Pages (`/settings/*`)

| Command | Aliases | Action | Description |
|---------|---------|--------|-------------|
| `/team` | `members`, `users` | Navigate to `/settings/team` | Team settings |
| `/branding` | `logo`, `colors` | Navigate to `/settings/branding` | Branding settings |
| `/billing` | `tax`, `currency` | Navigate to `/settings/billing` | Billing settings |
| `/assets` | `tags`, `categories` | Navigate to `/settings/assets` | Asset settings |

### Asset List Page (`/assets/registry`)

| Command | Aliases | Action | Description |
|---------|---------|--------|-------------|
| `/new` | `create`, `add` | Navigate to `/assets/registry/new` | Create new asset |
| `/import` | `csv` | Open CSV import dialog | Import assets from CSV |
| `/export` | `download` | Trigger CSV export | Export assets to CSV |

### Crew List Page (`/crew`)

| Command | Aliases | Action | Description |
|---------|---------|--------|-------------|
| `/new` | `create`, `add` | Navigate to `/crew/new` | Create new crew member |
| `/planner` | `schedule`, `gantt`, `timeline` | Navigate to `/crew/planner` | Open crew planner |
| `/roles` | `positions` | Navigate to `/crew/roles` | Manage crew roles |
| `/skills` | `qualifications` | Navigate to `/crew/skills` | Manage crew skills |
| `/import` | `csv` | Open CSV import dialog | Import crew from CSV |
| `/export` | `download` | Trigger CSV export | Export crew to CSV |

### Crew Detail Page (`/crew/[id]`)

| Command | Aliases | Action | Description |
|---------|---------|--------|-------------|
| `/edit` | `modify` | Navigate to edit page | Edit this crew member |
| `/schedule` | `assignments`, `projects` | Scroll to assignments section | View crew member's schedule |
| `/availability` | `unavailable`, `blocked` | Scroll to/open availability section | Manage availability |
| `/calendar` | `ical`, `subscribe` | Show/copy iCal feed URL | Get calendar subscription link |
| `/certifications` | `certs`, `qualifications` | Scroll to certifications section | View certifications |
| `/invite` | `register`, `account` | Trigger invite to register | Invite crew member to create an account |

### Crew Planner Page (`/crew/planner`)

| Command | Aliases | Action | Description |
|---------|---------|--------|-------------|
| `/today` | `now` | Scroll planner to today | Jump to today's date |
| `/week` | `this-week` | Set planner view to current week | Week view |
| `/month` | `this-month` | Set planner view to current month | Month view |

*Extend this pattern for every page that has useful actions. The above is a starting set — more commands should be added for each page during implementation.*

## UI Implementation

### Command Palette Changes (`src/components/layout/command-search.tsx`)

1. **Detect `/` prefix**: When input starts with `/`, enter slash command mode
2. **Get current page context**: Use `usePathname()` to determine current route
3. **Filter commands**: Show only commands where the current route matches one of the command's `pages` patterns
4. **Render command list**: Show icon, label, and description for each matching command. Highlight the matched portion of the command name.
5. **Execute on select**: Run the command's action (navigate, open dialog, generate doc, etc.)
6. **Show a hint**: When the palette first opens, show a subtle hint: "Type / for page actions, @ for navigation"

### Visual Differentiation

- Slash commands should look visually distinct from search results and @ navigation
- Use a different section header: "Page Actions" or "Commands"
- Command items should show a keyboard-shortcut style badge with the `/command` text
- Group global commands separately from page-specific commands if both are shown

### Action Execution

```typescript
function executeSlashCommand(command: SlashCommand, currentPath: string) {
  const entityId = extractEntityId(currentPath); // Extract [id] from URL

  switch (command.action.type) {
    case "navigate":
      const path = command.action.path.replace(":id", entityId || "");
      router.push(path);
      break;
    case "navigate_section":
      document.getElementById(command.action.hash)?.scrollIntoView({ behavior: "smooth" });
      break;
    case "open_dialog":
      // Dispatch a custom event that the page component listens for
      window.dispatchEvent(new CustomEvent("slash-command", { detail: { dialog: command.action.dialog } }));
      break;
    case "generate_document":
      window.open(`/api/documents/${entityId}?type=${command.action.docType}`, "_blank");
      break;
    case "trigger":
      window.dispatchEvent(new CustomEvent("slash-command", { detail: { event: command.action.event } }));
      break;
  }
}
```

### Page Components Listening for Commands

For `open_dialog` and `trigger` action types, page components need to listen:

```typescript
// In a project detail page component:
useEffect(() => {
  const handler = (e: CustomEvent) => {
    if (e.detail.dialog === "add-equipment") {
      setAddEquipmentOpen(true);
    }
    if (e.detail.event === "duplicate") {
      handleDuplicate();
    }
  };
  window.addEventListener("slash-command", handler);
  return () => window.removeEventListener("slash-command", handler);
}, []);
```

## File Structure

```
src/
├── lib/
│   └── slash-commands.ts        # Command registry + page matching + types
└── components/
    └── layout/
        └── command-search.tsx   # Updated to support / prefix mode
```

## Notes

- Slash commands are purely a UI/navigation feature — no database changes, no new permissions, no server actions (except that some commands trigger existing server actions like PDF generation).
- The command registry should be easy to extend. Adding a new command for a new page should be as simple as adding an entry to the array.
- Consider showing a small floating hint on pages (like a "?" tooltip) that lists available slash commands for the current page. This helps discoverability.
- On mobile, slash commands should work the same way in the full-screen command palette.
- Slash commands and @ commands are mutually exclusive modes — `/` activates slash mode, `@` activates page navigation mode, and plain text activates search mode.
