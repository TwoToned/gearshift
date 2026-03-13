# Search & Command Palette

## Global Search (`src/server/search.ts`)
`globalSearch(query)` searches across:
- Models (name, manufacturer, modelNumber, description) — children: assets
- Assets (assetTag, serialNumber, customName)
- Bulk assets (assetTag)
- Kits (assetTag, name)
- Projects (projectNumber, name) — non-templates only
- Clients (name, contactName) — children: projects
- Suppliers (name, contactName, accountNumber, email, tags)
- Locations (name, address) — children: child locations
- Categories (name) — children: models
- Maintenance (title)

Uses PostgreSQL ILIKE and trigram similarity for fuzzy matching. Tags matched via raw SQL `EXISTS(SELECT 1 FROM unnest(tags) t WHERE t ILIKE ...)`.

## Command Palette (`src/components/layout/command-search.tsx`)
- **Normal mode**: Free text → `globalSearch()` results
- **@ mode**: Page navigation via `PAGE_COMMANDS` (`src/lib/page-commands.ts`)
  - Each page has: `label, href, aliases[], icon, description, searchable?, searchType?, children?`
  - Tab drills into children, space after page name searches entities
  - Example: `@warehouse drum` → searches projects containing "drum" and links to warehouse view
- **Date shortcuts**: Typing DD/MM/YYYY navigates to availability calendar
- **Keyboard**: `Shift+↑/↓` skip children, `Tab` drill, `Esc` back, `Cmd+L` toggle children
- **Mobile**: Full-screen dialog with safe area padding

## Adding New Entities to Search
1. Add search case to `globalSearch()` in `src/server/search.ts`
2. Add page to `PAGE_COMMANDS` in `src/lib/page-commands.ts` with `searchable: true` and `searchType`
3. Add `searchType: ["type"]` to BOTH `typeMap` objects in command-search.tsx
4. Add icon to `pageIcons` map in command-search.tsx
5. Add to `typeIcons` and `typeLabels` records
