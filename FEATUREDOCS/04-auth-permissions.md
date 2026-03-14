# Authentication, Multi-Tenancy & Permissions

## Better Auth Configuration (`src/lib/auth.ts`)
- Plugins: `organization()`, `twoFactor({ issuer: "GearFlow" })`, `admin()`, `passkey()`
- Social providers: Google and Microsoft (conditional on env vars `GOOGLE_CLIENT_ID`, `MICROSOFT_CLIENT_ID`)
- Email verification, password reset via Resend
- Session stored in PostgreSQL `Session` table with `activeOrganizationId`
- Passkey RP ID configurable via `PASSKEY_RP_ID` env var (defaults to `localhost`)

## Middleware (`src/middleware.ts`)
- Checks cookies: `better-auth.session_token` or `__Secure-better-auth.session_token` (HTTPS)
- Public routes exempted: `/login`, `/register`, `/api/auth`, `/invite`, `/two-factor`, `/no-organization`, `/onboarding`, `/api/platform-name`, `/api/registration-policy`
- Unauthenticated requests redirect to `/login?callbackUrl=...`

## Session Helpers (`src/lib/auth-server.ts`)
- `getSession()` — Returns session + user or null
- `requireSession()` — Throws if not authenticated
- `requireOrganization()` — Throws if no `activeOrganizationId`

## Organization Context (`src/lib/org-context.ts`)
- `getOrgContext()` — Returns `{ organizationId, userId, userName }` for the current request
- `orgWhere()` — Returns `{ where: { organizationId } }` for Prisma queries
- `requireRole(roles)` — Validates member has one of the specified roles
- `requirePermission(resource, action)` — Checks permission map, throws 403 if denied

## Multi-Tenancy Rules
- Every database query MUST include `organizationId` in its WHERE clause
- Asset tags, project numbers, test tag IDs are unique per org (composite unique indexes)
- File storage is org-prefixed: `{orgId}/{folder}/{entityId}/{filename}`
- Users can belong to multiple orgs; `activeOrganizationId` on the session determines the current context

## Two-Tier Permission Model
1. **Site-level**: `User.role` = `"user"` or `"admin"`. Admin gets access to `/admin` panel
2. **Org-level**: `Member.role` = `owner | admin | manager | member | viewer` (legacy: `staff`, `warehouse`)

## Resource-Action Matrix (`src/lib/permissions.ts`)
16 resources: `asset, bulkAsset, model, kit, project, client, supplier, warehouse, testTag, maintenance, location, document, orgSettings, orgMembers, crew, reports`

Actions per resource: `create, read, update, delete` (varies by resource)

## Role Hierarchy (default permissions)
- **owner/admin**: All permissions on all resources
- **manager**: All CRUD except orgSettings.delete, orgMembers.delete
- **member**: Read + create + update on operational resources, no org settings
- **viewer**: Read-only on all resources
- **Custom roles**: JSON-stored permissions override defaults, managed via `src/server/custom-roles.ts`

## Client-Side Permission Checking
- `useCurrentRole()` hook from `src/lib/use-permissions.ts` — returns `{ permissions, isLoading }`
- `hasAccess(resource)` in sidebar checks if user has ANY permission for a resource
- `PermissionGate` component conditionally renders children

## Server-Side Enforcement
```typescript
const { organizationId, userId } = await getOrgContext();
await requirePermission("asset", "create"); // throws if denied
```

## User Customisation & Auth Methods

### Profile Pictures
- **UserAvatar component** (`src/components/ui/user-avatar.tsx`): Reusable avatar with image + initials fallback. Sizes: `xs` (24px), `sm` (32px), `md` (40px), `lg` (48px), `xl` (64px).
- **Upload**: `POST /api/avatar` — resizes to 256x256 via `sharp`, stores under global `avatars/users/{userId}/` S3 prefix.
- **Remove**: `DELETE /api/avatar` — deletes S3 file, sets `User.image` to null.
- **File proxy**: `GET /api/files/avatars/...` allowed without org prefix validation (avatars are global).

### Passkeys (WebAuthn)
- **Plugin**: `@better-auth/passkey` — server config in `src/lib/auth.ts`, client in `src/lib/auth-client.ts`.
- **Login page**: "Sign in with Passkey" button using `authClient.signIn.passkey()`. Email input has `autocomplete="username webauthn"`.
- **Account page**: Passkey management — list, add (`authClient.passkey.addPasskey()`), rename, delete.
- **Env vars**: `PASSKEY_RP_ID` (e.g. `gearflow.com` in production, `localhost` for dev).

### Social Login (Google & Microsoft)
- Conditional on env vars — providers only enabled when `GOOGLE_CLIENT_ID` / `MICROSOFT_CLIENT_ID` are set.
- Login page shows social buttons dynamically via `/api/auth/social-providers`.
- Account page "Connected Accounts" section with Connect buttons via `authClient.linkSocial()`.
- Better Auth auto-links social accounts to existing users with matching email.

### Invitations & No-Org Flow
- **Invite-only registration**: Site admin can set registration policy to INVITE_ONLY.
- **No-org page**: `src/app/(auth)/no-organization/page.tsx` — shown when user has no org memberships.
- **Invite signup**: Registration page prefills and locks email when `invite` query param is present.
- **Server actions**: `src/server/invitations.ts` — `getMyPendingInvitations()`, `getInvitationEmail()`, `checkIsSiteAdmin()`.

### Account Page Sections
The `/account` page is organized into: Profile (avatar + name), Security (password, 2FA, passkeys, connected accounts), Organizations, Active Sessions.
