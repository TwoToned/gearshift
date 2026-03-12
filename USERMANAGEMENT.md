# Extension Prompt — User Management, Roles & Access Control

## Context

This is an extension to the existing GearFlow asset/rental management platform. The app already uses Better Auth with the Organization plugin for multi-tenancy. Users can sign up, create organizations, and switch between them. There are existing roles (owner, admin, manager, staff, warehouse) but they are not properly enforced beyond basic checks. This prompt implements a complete, two-tier access control system: **site-level administration** (global, cross-org) and **organization-level roles** (granular, per-org), plus user profile management, 2FA, and invitation workflows.

---

## Two-Tier Authority Model

### Tier 1: Site Administration (Global)

Site admins manage the GearFlow installation itself. They operate above organizations.

- The **first user to register globally** (ever, across the entire database) is automatically promoted to site admin.
- Site admins can manage all organizations, all users, and global platform settings.
- Site admins are NOT automatically members of every organization — they access org data through a dedicated admin panel, not by impersonating org members.
- Additional site admins can be added via a **secret registration link** (see below).

### Tier 2: Organization Roles (Per-Org)

Each organization has its own role hierarchy. Users can belong to multiple organizations with different roles in each.

- The **first user in an organization** (the person who creates it) is automatically the organization **owner**.
- Org owners manage their org's settings, members, and policies. They cannot access site-level admin panels.
- Below the owner, there are granular roles with configurable permissions.

---

## Site Administration

### Data Model

Add a `role` field to the Better Auth `user` table:

```
User (extends Better Auth user table)
- role                    Enum: USER, SITE_ADMIN (default: USER)
```

This is a **site-level** role, separate from organization membership roles. A user with `role: SITE_ADMIN` has global admin capabilities. All other users have `role: USER`.

### First-User Auto-Promotion

On registration, check if any users exist in the database. If the user table is empty (this is the first registration ever), set `role: SITE_ADMIN` on the newly created user.

Implementation: use a Better Auth `after` hook on the `signUpEmail` endpoint (or equivalent). Query `SELECT COUNT(*) FROM user`. If count was 0 before this registration, update the user's role to `SITE_ADMIN`.

### Secret Site Admin Registration Link

A special URL that allows creating additional site admin accounts. This is for cases where the primary site admin needs to grant site-level access to another person (e.g., a co-owner or IT administrator).

**Route:** `GET /register/admin?token={SECRET_TOKEN}`

**How it works:**

1. A secret token is defined in the `.env` file:
   ```env
   SITE_ADMIN_SECRET_TOKEN=a-long-random-string-here
   SITE_ADMIN_REGISTRATION_ENABLED=true
   ```
2. When `SITE_ADMIN_REGISTRATION_ENABLED` is `true` and someone visits `/register/admin?token=<correct token>`, they see the standard registration form but with a note indicating they will be registered as a site admin.
3. On successful registration via this route, the new user's `role` is set to `SITE_ADMIN`.
4. If `SITE_ADMIN_REGISTRATION_ENABLED` is `false` or the token is wrong, the route returns a 404 (not a 403 — don't reveal the route exists).
5. The existing site admin can also promote/demote users from the admin panel (see below), so the secret link is primarily for initial setup or recovery scenarios.

**Security considerations:**
- The token should be long and random (at least 32 characters).
- Rate limit the registration endpoint to prevent brute-force token guessing.
- Log all site admin registrations for audit purposes.
- The secret link should be shared out-of-band (e.g., in person, via encrypted message) — never displayed in the UI.

### Site Admin Panel

**Route:** `src/app/(admin)/` — a separate route group with its own layout (no org sidebar, uses a distinct admin layout).

**Middleware:** `src/middleware.ts` must check `user.role === 'SITE_ADMIN'` for all routes under `/(admin)/`. Redirect non-admins to the main app.

#### Dashboard: `/admin`
- Total users count, total organizations count
- Recent registrations
- Recent org creations
- System health / quick stats

#### Organization Management: `/admin/organizations`
- List all organizations with: name, slug, member count, created date, owner name
- Search and filter
- Actions per org:
  - View details (members, settings, basic stats)
  - Edit org name, slug
  - Disable/enable an organization (soft lock — members can't access data but nothing is deleted)
  - Transfer ownership (reassign the owner role to a different member)
  - Delete organization (hard delete — with confirmation and "type the org name to confirm" safeguard)

#### User Management: `/admin/users`
- List all users across all orgs with: name, email, site role, org memberships, 2FA status, created date, last login
- Search by name or email
- Filter by: site role, 2FA status, organization
- Actions per user:
  - View profile and org memberships
  - Promote to site admin / demote to regular user
  - Disable account (prevent login without deleting)
  - Delete account (with confirmation)
  - Force password reset
  - Force 2FA disable (for lockout recovery)
  - View which organizations they belong to and their role in each

#### Global Settings: `/admin/settings`
- **Platform name**: The name displayed in the header, login page, and emails. Defaults to "GearFlow" but the site admin can change it to anything (e.g., the company's own branding if they're self-hosting for one company). Store in a `SiteSettings` table or a JSON config table.
- **Platform logo**: Upload a custom logo (uses the media/file system from MEDIA.md if implemented, otherwise a simple file upload).
- **Registration policy**: Open (anyone can register), Invite-only (users can only be created by org owners/admins or site admins), or Disabled (no new registrations).
- **Default org settings**: Default values that new organizations inherit (default currency, tax rate, test & tag interval, etc.).
- **2FA global policy**: Off (orgs decide), Recommended (show a banner encouraging 2FA), Required for site admins only, or Required for everyone.
- **Secret admin link status**: Show whether `SITE_ADMIN_REGISTRATION_ENABLED` is active (read from env — not editable from UI, display-only for awareness).

### Site Settings Data Model

```
SiteSettings (single row table — only one record ever exists)
- id                      String (cuid)
- platformName            String (default: "GearFlow")
- platformLogo            String? (URL to logo file)
- registrationPolicy      Enum: OPEN, INVITE_ONLY, DISABLED (default: OPEN)
- twoFactorGlobalPolicy   Enum: OFF, RECOMMENDED, REQUIRED_SITE_ADMINS, REQUIRED_ALL (default: OFF)
- defaultCurrency         String (default: "AUD")
- defaultTaxRate          Float (default: 10)
- createdAt               DateTime
- updatedAt               DateTime
```

Create a helper `getSiteSettings()` that returns the single row (or creates it with defaults if it doesn't exist). Cache this aggressively — it rarely changes.

---

## Organization Roles & Permissions

### Role Hierarchy

Redefine the organization roles using Better Auth's `createAccessControl`:

| Role | Description | Level |
|---|---|---|
| **owner** | Created the org. Full control. Can delete org, transfer ownership, manage billing. Only one owner per org (can be transferred). | Highest |
| **admin** | Full operational control. Can manage members, settings, all data. Cannot delete org or change owner. | High |
| **manager** | Can manage projects, assets, clients, and operational data. Can view but not change org settings or manage members. | Medium |
| **member** | Standard operational user. Can create and edit projects, assets, clients. Cannot access settings or manage other users. | Standard |
| **viewer** | Read-only access. Can view all data but cannot create, edit, or delete anything. Useful for accountants, clients with portal access, or auditors. | Lowest |

### Permission Matrix

Define granular permissions using Better Auth's access control system. Create a statement with all GearFlow-specific resources and actions:

```typescript
// src/lib/permissions.ts

import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

export const statement = {
  ...defaultStatements,
  // Asset management
  asset:        ["create", "read", "update", "delete", "import", "export"],
  model:        ["create", "read", "update", "delete", "import", "export"],
  kit:          ["create", "read", "update", "delete"],
  // Project management
  project:      ["create", "read", "update", "delete", "manage_line_items", "generate_documents"],
  client:       ["create", "read", "update", "delete"],
  // Warehouse
  warehouse:    ["check_out", "check_in", "scan"],
  // Test & Tag
  testTag:      ["create", "read", "update", "delete", "quick_test", "generate_reports"],
  // Maintenance
  maintenance:  ["create", "read", "update", "delete"],
  // Settings & Admin
  orgSettings:  ["read", "update"],
  orgMembers:   ["read", "invite", "update_role", "remove"],
  // Reports & Exports
  reports:      ["view", "export"],
} as const;

export const ac = createAccessControl(statement);

export const ownerRole = ac.newRole({
  ...defaultStatements, // all default org/member/invitation perms
  asset:        ["create", "read", "update", "delete", "import", "export"],
  model:        ["create", "read", "update", "delete", "import", "export"],
  kit:          ["create", "read", "update", "delete"],
  project:      ["create", "read", "update", "delete", "manage_line_items", "generate_documents"],
  client:       ["create", "read", "update", "delete"],
  warehouse:    ["check_out", "check_in", "scan"],
  testTag:      ["create", "read", "update", "delete", "quick_test", "generate_reports"],
  maintenance:  ["create", "read", "update", "delete"],
  orgSettings:  ["read", "update"],
  orgMembers:   ["read", "invite", "update_role", "remove"],
  reports:      ["view", "export"],
});

export const adminRole = ac.newRole({
  // Same as owner EXCEPT: no org delete, no ownership transfer
  // (These are enforced via defaultStatements — admin lacks organization.delete)
  asset:        ["create", "read", "update", "delete", "import", "export"],
  model:        ["create", "read", "update", "delete", "import", "export"],
  kit:          ["create", "read", "update", "delete"],
  project:      ["create", "read", "update", "delete", "manage_line_items", "generate_documents"],
  client:       ["create", "read", "update", "delete"],
  warehouse:    ["check_out", "check_in", "scan"],
  testTag:      ["create", "read", "update", "delete", "quick_test", "generate_reports"],
  maintenance:  ["create", "read", "update", "delete"],
  orgSettings:  ["read", "update"],
  orgMembers:   ["read", "invite", "update_role", "remove"],
  reports:      ["view", "export"],
});

export const managerRole = ac.newRole({
  asset:        ["create", "read", "update", "import", "export"],
  model:        ["create", "read", "update", "import", "export"],
  kit:          ["create", "read", "update"],
  project:      ["create", "read", "update", "manage_line_items", "generate_documents"],
  client:       ["create", "read", "update"],
  warehouse:    ["check_out", "check_in", "scan"],
  testTag:      ["create", "read", "update", "quick_test", "generate_reports"],
  maintenance:  ["create", "read", "update"],
  orgSettings:  ["read"],
  orgMembers:   ["read"],
  reports:      ["view", "export"],
});

export const memberRole = ac.newRole({
  asset:        ["create", "read", "update"],
  model:        ["create", "read", "update"],
  kit:          ["read"],
  project:      ["create", "read", "update", "manage_line_items", "generate_documents"],
  client:       ["create", "read", "update"],
  warehouse:    ["check_out", "check_in", "scan"],
  testTag:      ["create", "read", "update", "quick_test"],
  maintenance:  ["create", "read", "update"],
  orgSettings:  [],
  orgMembers:   [],
  reports:      ["view"],
});

export const viewerRole = ac.newRole({
  asset:        ["read"],
  model:        ["read"],
  kit:          ["read"],
  project:      ["read"],
  client:       ["read"],
  warehouse:    [],
  testTag:      ["read"],
  maintenance:  ["read"],
  orgSettings:  [],
  orgMembers:   [],
  reports:      ["view"],
});
```

### Permission Enforcement

Permissions must be enforced at **two levels**:

**1. Server-side (mandatory):** Every server action must check the user's permission for the resource and action before proceeding. Update `src/lib/org-context.ts` to add a `requirePermission()` helper:

```typescript
async function requirePermission(
  resource: string,
  action: string
): Promise<{ organizationId: string; userId: string }> {
  const ctx = await getOrgContext();
  const hasPermission = await auth.api.hasPermission({
    headers: await getHeaders(),
    body: { permission: { [resource]: [action] } }
  });
  if (!hasPermission) {
    throw new Error("You don't have permission to perform this action.");
  }
  return ctx;
}
```

Use this in server actions: `await requirePermission("project", "create")` instead of or in addition to `getOrgContext()`.

**2. Client-side (UX only):** Use Better Auth's `checkRolePermission()` on the client to conditionally show/hide UI elements (buttons, menu items, form fields). This is for UX — never rely on it for security.

```typescript
// Example: only show "Delete" button if user has permission
const canDelete = authClient.organization.checkRolePermission({
  role: currentMember.role,
  permission: { asset: ["delete"] }
});
```

### What Each Role Can See in the UI

| Feature / Page | Owner | Admin | Manager | Member | Viewer |
|---|---|---|---|---|---|
| Dashboard | Full | Full | Full | Full | Full (read-only) |
| Assets — view | Yes | Yes | Yes | Yes | Yes |
| Assets — create/edit | Yes | Yes | Yes | Yes | No |
| Assets — delete | Yes | Yes | No | No | No |
| Assets — import/export | Yes | Yes | Yes | No | No |
| Projects — view | Yes | Yes | Yes | Yes | Yes |
| Projects — create/edit | Yes | Yes | Yes | Yes | No |
| Projects — delete | Yes | Yes | No | No | No |
| Projects — generate docs | Yes | Yes | Yes | Yes | No |
| Warehouse operations | Yes | Yes | Yes | Yes | No |
| Test & Tag — view | Yes | Yes | Yes | Yes | Yes |
| Test & Tag — record tests | Yes | Yes | Yes | Yes | No |
| Test & Tag — quick test | Yes | Yes | Yes | Yes | No |
| Test & Tag — reports | Yes | Yes | Yes | Yes | Yes (view only) |
| Clients — view | Yes | Yes | Yes | Yes | Yes |
| Clients — create/edit | Yes | Yes | Yes | Yes | No |
| Maintenance — manage | Yes | Yes | Yes | Yes | No |
| Org Settings | Full | Full | View only | Hidden | Hidden |
| Member Management | Full | Full | View only | Hidden | Hidden |
| Invite Members | Yes | Yes | No | No | No |
| Change Member Roles | Yes | Yes | No | No | No |
| Remove Members | Yes | Yes | No | No | No |
| Delete Organization | Yes | No | No | No | No |
| Transfer Ownership | Yes | No | No | No | No |

---

## Organization Settings & Member Management

### Organization Settings Page: `/settings`

Split the settings page into clear sections. Only show sections the user has permission to see.

#### General (owner, admin)
- Organization name
- Organization slug
- Organization logo (upload)
- Business address, phone, email, website
- Currency, tax rate (GST)

#### Asset Tag Configuration (owner, admin)
- Asset tag prefix, digit count
- Test tag prefix, digit count (from T&T module)

#### Security Policies (owner, admin)
- **2FA Policy:** Off, Recommended, Required
  - **Off:** 2FA is available but not enforced
  - **Recommended:** show a persistent banner to users who haven't enabled 2FA
  - **Required:** users must enable 2FA within a grace period (configurable, e.g., 7 days) or they will be locked out of the org until they set it up
- **Grace period for 2FA requirement:** number of days after policy is set to Required before enforcement kicks in (default: 7)
- **Session timeout:** auto-logout after X minutes of inactivity (configurable per org, default: 480 = 8 hours)

#### Member Management (owner, admin — read-only for manager)

**Route:** `/settings/members`

- List all org members with: name, email, role, 2FA status, joined date, last active
- **Invite new member:** enter email address and select role → sends invitation email
  - Invitation expires after 7 days (configurable)
  - If the email belongs to an existing GearFlow user, they get an invitation to join the org
  - If the email doesn't belong to an existing user, they get a registration + invitation link
  - Pending invitations shown in a separate table with: email, role, invited by, sent date, expiry, status (pending/accepted/expired)
  - Resend and revoke actions on pending invitations
- **Change member role:** dropdown to change a member's role. Restrictions:
  - Owners can change any role (except they can't demote themselves — must transfer ownership first)
  - Admins can change manager/member/viewer roles but cannot promote to admin or change other admins
  - Owners can promote members to admin
- **Remove member:** remove a user from the org. The user's account still exists — they just lose access to this org's data. Restrictions:
  - Cannot remove the owner (must transfer ownership first)
  - Admins cannot remove other admins (only owner can)
- **Transfer ownership:** owner-only action. Select a member to become the new owner. The current owner is demoted to admin. Requires password confirmation.

---

## User Profile & Account Settings

### Route: `/account` or accessible via the user button in the sidebar footer

The user avatar/name button at the bottom of the sidebar should open a menu with:
- "Account Settings" → navigates to the profile page
- "Switch Organization" → org switcher (existing)
- "Sign Out"

### Profile Page: `/account`

#### Personal Information
- **Profile picture:** upload/change avatar image (uses the media system or a simple dedicated upload)
- **Display name:** editable
- **Email address:** editable with email verification flow (send confirmation to new email before switching)
  - If the user is currently signed in via email/password, changing email requires current password confirmation
  - If signed in via social provider, email may not be editable (depends on provider)

#### Security
- **Change password:** current password + new password + confirm new password
- **Two-Factor Authentication:**
  - If not enabled: "Enable 2FA" button → opens setup flow:
    1. Enter current password to confirm identity
    2. Generate TOTP secret and display QR code
    3. User scans with authenticator app (Google Authenticator, Authy, etc.)
    4. User enters the TOTP code to verify setup
    5. Display backup codes and require user to acknowledge they've saved them
    6. 2FA is now active
  - If enabled: show status "2FA is enabled" with options:
    - "View Backup Codes" (requires password confirmation)
    - "Regenerate Backup Codes" (requires password confirmation)
    - "Disable 2FA" (requires password confirmation + current TOTP code)
  - If the user's organization requires 2FA and they haven't enabled it:
    - Show a prominent banner: "Your organization requires two-factor authentication. Please enable it within X days."
    - After the grace period, redirect to the 2FA setup page on every login until it's enabled
- **Active sessions:** list of active sessions with device info, IP address, last active time. "Sign out other sessions" button.

#### Organizations
- List all organizations the user belongs to with: org name, role, joined date
- **Leave organization:** button per org (not available if the user is the owner — must transfer ownership first). Confirmation dialog.
- "Create New Organization" button

---

## Two-Factor Authentication

### Better Auth 2FA Plugin Setup

Add the `twoFactor` plugin to the Better Auth server config (`src/lib/auth.ts`):

```typescript
import { twoFactor } from "better-auth/plugins";

export const auth = betterAuth({
  appName: "GearFlow", // or read from SiteSettings.platformName
  plugins: [
    organization({ /* existing config */ }),
    twoFactor({
      issuer: "GearFlow", // shown in authenticator apps
      // OTP via email as fallback (optional for v1)
      // otpOptions: {
      //   async sendOTP({ user, otp }) {
      //     // send via email service
      //   },
      // },
    }),
  ],
});
```

Add the `twoFactorClient` plugin to the client (`src/lib/auth-client.ts`):

```typescript
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
    twoFactorClient({
      twoFactorPage: "/two-factor", // redirect here when 2FA verification needed
    }),
  ],
});
```

### 2FA Verification Page

**Route:** `src/app/(auth)/two-factor/page.tsx`

Shown after email/password sign-in when the user has 2FA enabled:

- Input field for 6-digit TOTP code
- "Use a backup code instead" link → switches to backup code input
- "Verify" button
- On success: redirect to the main app
- On failure: show error, allow retry
- "Trust this device for 30 days" checkbox (optional — uses Better Auth's trusted devices feature)

### Organization 2FA Policy Enforcement

Store the 2FA policy in the organization's metadata (or a new field on the org table):

```json
{
  "twoFactorPolicy": "OFF",           // OFF | RECOMMENDED | REQUIRED
  "twoFactorGracePeriodDays": 7,
  "twoFactorEnforcementDate": null     // set when policy changes to REQUIRED
}
```

**Enforcement logic (in middleware or layout):**

1. When a user accesses an org with `twoFactorPolicy: REQUIRED`:
   a. Check if `user.twoFactorEnabled === true` → proceed normally
   b. If `twoFactorEnabled === false`:
      - Check if we're still within the grace period (`twoFactorEnforcementDate + gracePeriodDays > today`)
      - If within grace period: show a dismissible banner ("You must enable 2FA within X days")
      - If grace period expired: redirect to `/account#security` with a non-dismissible message. Block access to all org pages until 2FA is set up.

2. When the policy is changed to REQUIRED, set `twoFactorEnforcementDate` to today. This starts the grace period.

3. When the policy is changed from REQUIRED to anything else, clear the enforcement date.

---

## Invitation Flow

### Inviting Users

When an owner or admin invites a user by email:

1. **Check if email belongs to an existing GearFlow user:**
   - **Yes:** Create an organization invitation via Better Auth's `createInvitation` API. The user sees the invitation in their account (and optionally via email).
   - **No:** Create the invitation AND send a registration link. The link goes to `/register?invitation={token}`. After registration, the invitation is auto-accepted and the user is added to the org with the specified role.

2. **Invitation email** should include: org name, inviter's name, role being offered, and a direct link to accept.

3. **Invitation states:** Pending → Accepted / Expired / Revoked.

### Accepting Invitations

- **Existing users:** see invitations on their account page or via a direct link. Click "Accept" to join the org.
- **New users:** register via the invitation link. After registration, they're automatically added to the org.
- **Expired invitations:** show a message "This invitation has expired. Ask the organization admin to send a new one."

---

## Navigation & Layout Updates

### Sidebar Footer (User Section)

The bottom of the sidebar currently has a user button. Update it:

```
┌─────────────────────────────────────┐
│  [Avatar]  John Smith               │
│           john@example.com          │
│           Owner · Two Toned Prod.   │
│                          [⚙] [↗]   │
└─────────────────────────────────────┘
```

- Clicking the user area or ⚙ opens a dropdown:
  - Account Settings → `/account`
  - Switch Organization → org switcher
  - Org Settings → `/settings` (if permitted)
  - Admin Panel → `/admin` (only if site admin)
  - Sign Out

### Sidebar Items — Permission-Based Visibility

Sidebar navigation items should be conditionally shown based on the user's role:

- **Settings** menu item: only shown to owner, admin, and manager (manager sees read-only)
- **Admin Panel** link: only shown to site admins (in the user dropdown, not the main sidebar)
- All other items visible to all roles, but individual actions within pages are permission-gated

### Top Bar

- Show the user's role badge next to their name or in the org switcher area (subtle, not prominent)
- If 2FA recommended/required banner is active, show it as a top bar notification

---

## Server Actions

### Site Admin Actions (`src/server/site-admin.ts`)

```
getSiteSettings(): SiteSettings
updateSiteSettings(data): SiteSettings
getAllOrganizations(filters, pagination): paginated list
getAllUsers(filters, pagination): paginated list
promoteToSiteAdmin(userId): void
demoteFromSiteAdmin(userId): void
disableUser(userId): void
enableUser(userId): void
deleteUser(userId): void
forcePasswordReset(userId): void
force2FADisable(userId): void
disableOrganization(orgId): void
enableOrganization(orgId): void
deleteOrganization(orgId): void
transferOrganizationOwnership(orgId, newOwnerId): void
```

All site admin actions must verify `user.role === 'SITE_ADMIN'` before proceeding.

### Organization Member Actions (`src/server/org-members.ts`)

```
getOrgMembers(pagination): paginated list of members with user details
inviteMember(data: { email, role }): Invitation
resendInvitation(invitationId): void
revokeInvitation(invitationId): void
getPendingInvitations(): Invitation[]
changeMemberRole(memberId, newRole): void
removeMember(memberId): void
transferOwnership(newOwnerId): void
getOrgSecuritySettings(): { twoFactorPolicy, gracePeriodDays, enforcementDate }
updateOrgSecuritySettings(data): void
```

These actions use `requirePermission("orgMembers", "invite")` etc. for authorization.

### User Profile Actions (`src/server/user-profile.ts`)

```
getProfile(): user profile data
updateProfile(data: { name, image }): void
updateEmail(data: { newEmail, password }): void  // triggers verification
changePassword(data: { currentPassword, newPassword }): void
getActiveSessions(): Session[]
revokeSession(sessionId): void
revokeAllOtherSessions(): void
leaveOrganization(orgId): void
getUserOrganizations(): list of orgs with roles
```

---

## Middleware Updates

### `src/middleware.ts`

The middleware needs to handle several concerns:

1. **Authentication check:** unauthenticated users → `/login` (existing)
2. **Site admin route protection:** `/admin/*` routes → verify `user.role === 'SITE_ADMIN'`, redirect to `/` if not
3. **Disabled account check:** if `user.banned === true` (Better Auth's built-in field), redirect to a "Your account has been disabled" page
4. **Disabled org check:** if the active organization is disabled, show a "This organization has been disabled" message
5. **2FA enforcement:** if the active org requires 2FA and the user hasn't set it up, and the grace period has expired, redirect to `/account` with a query param `?setup2fa=required`
6. **Registration policy:** if site settings have registration set to `INVITE_ONLY` or `DISABLED`, the `/register` page should show appropriate messaging (or redirect to `/login` with a message)

**Important:** middleware in Next.js runs on the edge and can't do heavy DB queries. For checks that need DB data (like org disabled status, 2FA policy), use the session data or a lightweight API call. Alternatively, cache these values in the session/cookie.

---

## Migration Plan

### Phase 1: Data Model & Site Admin Foundation

1. Add `role` field to the user table (default: `USER`, enum: `USER` | `SITE_ADMIN`)
2. Create the `SiteSettings` table with defaults
3. Implement first-user auto-promotion logic
4. Implement the secret admin registration route
5. Run migrations

### Phase 2: Site Admin Panel

1. Create the `(admin)` route group with admin layout
2. Implement admin middleware check
3. Build the admin dashboard page
4. Build the organizations management page
5. Build the users management page
6. Build the global settings page
7. Implement all site admin server actions

### Phase 3: Organization Roles & Permissions

1. Define the permission statement and roles in `src/lib/permissions.ts`
2. Wire the roles into Better Auth's organization plugin configuration
3. Implement `requirePermission()` in `src/lib/org-context.ts`
4. Audit and update ALL existing server actions to use `requirePermission()` instead of bare `getOrgContext()`
5. Add client-side permission checks to conditionally show/hide UI elements (buttons, menu items, pages)
6. Update sidebar visibility based on roles
7. Update the organization creation flow to set the creator as owner

### Phase 4: Member Management

1. Build the members list page at `/settings/members`
2. Implement the invite member flow (email input, role selection, send invitation)
3. Build the pending invitations table
4. Implement role change, member removal, and ownership transfer
5. Build the invitation acceptance flow (for existing users and new registrations)
6. Implement invitation email sending

### Phase 5: User Profile

1. Build the account/profile page at `/account`
2. Implement profile picture upload
3. Implement name and email editing (with email verification)
4. Implement password change
5. Build the "my organizations" section with leave org functionality
6. Build the active sessions section

### Phase 6: Two-Factor Authentication

1. Add the `twoFactor` plugin to Better Auth server and client config
2. Run migrations for the 2FA tables
3. Build the 2FA setup flow (QR code, verify, backup codes)
4. Build the 2FA verification page (`/two-factor`)
5. Build the 2FA management UI (view/regenerate backup codes, disable)
6. Implement the org-level 2FA policy (settings, enforcement, grace period)
7. Implement 2FA enforcement in middleware/layout

### Phase 7: Polish

1. Role badges throughout the UI
2. Permission-denied error pages/toasts (friendly messaging)
3. Audit log for sensitive actions (role changes, member removals, setting changes)
4. Email notifications for: invitation received, role changed, removed from org, 2FA policy changed
5. Mobile-responsive admin panel
6. Ensure all existing features respect the new permission model (go through every page/action)

---

## Edge Cases

1. **Owner tries to leave their org:** Block this. Show a message: "You are the owner. Transfer ownership to another member before leaving."

2. **Last admin is removed/demoted:** Allow it — the owner still has full access. But show a warning: "This will leave no admins in the organization."

3. **Owner's account is disabled by site admin:** The org still exists but no one can manage it at the owner level. Other admins can still operate. Site admin can transfer ownership if needed.

4. **User belongs to zero organizations:** After leaving their last org (or if their only org is deleted), show a landing page with options: "Create a new organization" or "You don't belong to any organizations. Ask an admin to invite you."

5. **Role downgrade while user is active:** If a user's role is changed from admin to viewer while they have the app open, their next server action should fail with a permission error. The client should handle this gracefully (show a toast, refresh the page to update the UI).

6. **2FA required but user loses their device:** Site admin can use "Force 2FA disable" to reset the user's 2FA. The user can then log in and set up 2FA again. Alternatively, the user can use backup codes.

7. **Secret admin link token rotation:** If the site admin suspects the token is compromised, they update the `.env` with a new token and restart the server. Old tokens immediately stop working.

8. **Multiple owners (prevent this):** Better Auth's org plugin allows only one owner. The system should enforce this — ownership transfer is the only way to change who the owner is.

9. **Social login users and password-gated actions:** Users who signed up via Google/GitHub may not have a password. Password-gated actions (change email, enable 2FA) should detect this and either skip the password check or prompt the user to set a password first.

10. **Org-level 2FA policy vs user preference:** If a user enables 2FA voluntarily and then the org policy is set to "Off", the user's 2FA stays active (it's their personal security choice). The policy only enforces a minimum — it never forces 2FA to be disabled.

11. **Viewer role and data export:** Viewers can view reports but cannot export/download data (CSV exports are gated behind the `export` permission). This prevents read-only users from bulk-extracting data. PDFs for viewing are allowed; CSV downloads are not.

---

## Renaming & Branding Notes

The site admin's ability to change the platform name means:

- The app header, login page title, browser tab title, and email subjects should all read from `SiteSettings.platformName` rather than hardcoding "GearFlow".
- Create a helper `getPlatformName()` that returns the configured name (with "GearFlow" as the fallback).
- The sidebar header, login card, and any branded elements should use this dynamically.
- The logo similarly should fall back to a default GearFlow logo if no custom logo is uploaded.

---

## Summary

This extension implements a complete two-tier access control system:

- **Site administration** with a global admin panel for managing all organizations, users, and platform settings — including a customisable platform name and registration policies
- **Organization roles** (owner, admin, manager, member, viewer) with granular, per-resource permissions enforced at both server and client level using Better Auth's access control system
- **User profile management** with avatar upload, email change with verification, password change, and the ability to leave organizations
- **Two-factor authentication** via TOTP with backup codes, enforceable per-organization with configurable grace periods
- **Invitation workflow** for adding new users with role pre-assignment
- **Secret admin registration link** controlled via `.env` for adding additional site admins without UI access
- **Dynamic branding** allowing the site admin to rename and re-logo the platform
