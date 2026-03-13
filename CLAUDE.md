# CLAUDE.md

## Documentation Structure

- **`ARCHITECTURE.md`** — High-level overview with links to all feature docs
- **`FEATUREDOCS/`** — Individual markdown files for each feature/system (29 files)
- **`PROMPT.md`** — Full product spec

**When making changes**: Read the relevant `FEATUREDOCS/` file(s) for the feature you're touching. Update them after. Don't read everything — just what's relevant. The [Integration Checklist](./FEATUREDOCS/29-integration-checklist.md) tells you what to wire up for new features.

## Branching

All new features and non-trivial changes must go on a dedicated branch. Never commit feature work directly to `main`.

## Feature Documentation

Every feature change **must** update the relevant `FEATUREDOCS/` file. If the feature doesn't have one yet, create a new numbered markdown file (e.g. `FEATUREDOCS/30-my-feature.md`) and add it to the table in `ARCHITECTURE.md`.

## Commands

```bash
npm run dev          # Dev server (Turbopack)
npm run build        # Production build + type check
npm run lint         # ESLint
npx prisma generate  # Regenerate Prisma client (after schema changes)
npx prisma migrate dev --name <name>  # Create + apply migration
```

No test framework is configured.

## Critical Conventions

### shadcn/ui v4 — `render` prop, NOT `asChild`
```tsx
<DialogTrigger render={<Button />}>Open</DialogTrigger>
<DropdownMenuTrigger render={<Button />}>Menu</DropdownMenuTrigger>
<SidebarMenuButton render={<Link href="/foo" />}>Link</SidebarMenuButton>
```

### Prisma v6
- Import from `@/generated/prisma/client` (NOT `@/generated/prisma`)
- After schema changes: `npx prisma migrate dev` → `npx prisma generate` → restart dev

### Server Actions
- All in `src/server/` with `"use server"` directive
- Must call `serialize()` on all return values
- Write ops use `requirePermission(resource, action)`
- Read ops use `getOrgContext()` for org scoping
- All writes must call `logActivity()` for audit trail

### Forms & Validation
- Zod schemas in `src/lib/validations/` (CANNOT be in `"use server"` files)
- Use `z.input<typeof schema>` for form types (NOT `z.infer`)
- React Hook Form + `zodResolver()` + `useMutation()`

### Key Gotchas
- No `AlertDialog` — use `Dialog` with confirm/cancel buttons
- `SelectValue` can't resolve portal-rendered items — pass explicit label children
- `DropdownMenuLabel` must be inside `DropdownMenuGroup`
- `@react-pdf/renderer` — Helvetica only, no Unicode symbols
- Server action dates arrive as strings — wrap with `new Date()`
- Kit join tables use `addedAt` (not `createdAt`)
- Safe areas: use inline `style` with `env()`, not Tailwind arbitrary values
- Project queries must add `isTemplate: false` to exclude templates
