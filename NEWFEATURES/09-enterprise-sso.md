# Feature: Enterprise SSO — Per-Organisation SAML/OIDC with Group Mapping

## Summary

Enable organisations to configure their own SSO identity providers (Okta, Azure AD/Entra ID, Google Workspace, OneLogin, etc.) using Better Auth's `@better-auth/sso` plugin. Each organisation independently configures SAML 2.0 or OIDC providers, with support for automatic user provisioning, admin approval workflows, and IdP group-to-GearFlow role mapping (including custom roles). The login flow is redesigned to support org-specific SSO login pages alongside the existing global login.

---

## Table of Contents

1. [Better Auth SSO Plugin Integration](#1-better-auth-sso-plugin-integration)
2. [Login Flow Redesign](#2-login-flow-redesign)
3. [SSO Provider Configuration](#3-sso-provider-configuration)
4. [User Provisioning](#4-user-provisioning)
5. [Group-to-Role Mapping](#5-group-to-role-mapping)
6. [Data Model](#6-data-model)
7. [Settings UI](#7-settings-ui)
8. [Server Actions](#8-server-actions)
9. [API Routes](#9-api-routes)
10. [Middleware Changes](#10-middleware-changes)
11. [Security Requirements](#11-security-requirements)
12. [Site Admin Controls](#12-site-admin-controls)
13. [Permissions](#13-permissions)
14. [Activity Log Integration](#14-activity-log-integration)
15. [Edge Cases & Error Handling](#15-edge-cases--error-handling)
16. [Implementation Phases](#16-implementation-phases)

---

## 1. Better Auth SSO Plugin Integration

### Plugin Setup

Better Auth's `@better-auth/sso` plugin (v1.3+) supports per-organisation SAML 2.0 and OIDC providers stored in a `ssoProvider` database table with an `organizationId` field. This is exactly what GearFlow needs.

**Install:**
```bash
npm install @better-auth/sso
```

**Server config (`src/lib/auth.ts`):**
```typescript
import { sso } from "@better-auth/sso";

export const auth = betterAuth({
  plugins: [
    organization(),
    twoFactor({ issuer: "GearFlow" }),
    admin(),
    sso({
      // Global defaults — individual providers override these
      provisionUser: async ({ user, token, provider }) => {
        // Custom user provisioning logic (see Section 4)
      },
      organizationProvisioning: {
        disabled: false,
        // When a user authenticates via SSO linked to an org,
        // auto-add them as a member if not already
        defaultRole: "member",
      },
    }),
  ],
});
```

**Client config (`src/lib/auth-client.ts`):**
```typescript
import { ssoClient } from "@better-auth/sso/client";

export const authClient = createAuthClient({
  plugins: [ssoClient()],
});
```

### What the Plugin Provides

- `ssoProvider` table in the database (auto-migrated)
- `registerSSOProvider` / `updateSSOProvider` / `deleteSSOProvider` API endpoints
- `signInSSO` client method that redirects to the IdP
- SAML ACS endpoint (`/api/auth/sso/saml2/sp/acs`)
- OIDC callback endpoint (`/api/auth/sso/callback/:providerId`)
- Per-provider `organizationId` linking
- Domain-based provider resolution (user's email domain → provider)
- User provisioning hook (`provisionUser`)

---

## 2. Login Flow Redesign

### The Problem

Currently GearFlow has a single login page at `/login`. With per-org SSO, we need:
1. A way for SSO users to be routed to their org's IdP
2. A way for non-SSO users to continue using email/password
3. A way for users in multiple orgs (some SSO, some not) to choose

### Solution: Org-Scoped Login + Smart Global Login

#### Route: `/login` — Global Login (existing, enhanced)

The existing `/login` page becomes a smart entry point:

1. User enters their email address
2. System checks the email domain against registered SSO providers
3. **If SSO match found (single org):** Redirect to `/login/{org-slug}` with email pre-filled
4. **If SSO match found (multiple orgs):** Show an org picker: "Which organisation do you want to sign into?" with each org listed. Clicking one redirects to `/login/{org-slug}`
5. **If no SSO match:** Show the standard email/password form (current behaviour)

This means users always start at `/login` and are routed to the right place. They never need to know their org slug.

#### Route: `/login/[orgSlug]` — Org-Specific Login (new)

A dedicated login page for an organisation. The URL is shareable and bookmarkable.

**Page behaviour:**
1. Load the org by slug. If not found → 404
2. Check if the org has an active SSO provider
3. **If SSO configured:**
   - Show org name and logo prominently
   - Show a large, full-width "Sign in with [Provider Name]" button at the top (e.g. "Sign in with Okta SSO") — this is the primary action, styled as a prominent primary button (56px+ height, lock/shield icon, subtitle "Recommended for [Org Name] employees")
   - Below the SSO button, a visual gap with a muted "Other sign-in options" divider
   - Below the divider: social login buttons (Google, Microsoft, etc.) at standard/secondary size — visually subordinate to SSO
   - Below social: email/password form (if `allowPasswordLogin` is true)
   - If `enforceSSO` is true: hide everything except the SSO button — no social login, no email/password
   - SSO button calls `authClient.signIn.sso({ providerId, email })` which redirects to the IdP
   - **The visual hierarchy makes SSO the obvious default** — users see one big button first and have to actively scroll past a divider to find alternative options. This pushes org members toward their IT-approved auth path without blocking edge cases (external collaborators, service accounts)
4. **If no SSO configured:**
   - Show the standard login layout: social login buttons and email/password form at equal weight, scoped to this org (sets `activeOrganizationId` after login)
   - This is useful even without SSO for org-branded login pages

See the User Customisation spec (10-user-customisation.md, Section 3: Login Page Integration) for the full visual layout specification and ASCII wireframes.

**Org branding on login page:**
- Org logo (from `Organization.logo`)
- Org name
- Custom brand colors (from org branding settings, if implemented)
- "Powered by GearFlow" footer

#### Direct SSO Links

For IT admins configuring their IdP, provide a direct SSO initiation URL:
```
https://app.gearflow.com/api/auth/sso/sign-in?providerId={providerId}
```
This can be set as the "app URL" in Okta/Azure AD app tiles.

#### Backwards Compatibility

- `/login` continues to work exactly as before for non-SSO users
- Users with bookmarked `/login` are not broken
- The org slug login pages are additive, not replacing anything

---

## 3. SSO Provider Configuration

### What Org Admins Configure

Each org can set up one or more SSO providers. The configuration is done in org settings by users with `orgSettings: update` permission.

#### OIDC Provider Config

| Field | Description | Example |
|-------|-------------|---------|
| Provider Name | Display name | "Google Workspace" |
| Client ID | From the IdP | `abc123.apps.googleusercontent.com` |
| Client Secret | From the IdP | `GOCSPX-...` |
| Issuer URL | IdP's issuer | `https://accounts.google.com` |
| Discovery URL | OIDC discovery endpoint (auto-fills other URLs) | `https://accounts.google.com/.well-known/openid-configuration` |
| Domain | Email domain to match | `acmecorp.com` |
| Scopes | OIDC scopes to request | `openid email profile groups` |

#### SAML Provider Config

| Field | Description | Example |
|-------|-------------|---------|
| Provider Name | Display name | "Okta SAML" |
| IdP Entity ID / Issuer | IdP's entity ID | `http://www.okta.com/exk...` |
| SSO URL | IdP's login endpoint | `https://acme.okta.com/app/.../sso/saml` |
| Certificate | IdP's signing certificate (X.509 PEM) | `-----BEGIN CERTIFICATE-----\n...` |
| Domain | Email domain to match | `acmecorp.com` |

#### Service Provider (SP) Metadata

GearFlow auto-generates SP metadata that the org admin copies into their IdP:
- **SP Entity ID:** `https://app.gearflow.com/api/auth/sso/saml2/metadata/{providerId}`
- **ACS URL:** `https://app.gearflow.com/api/auth/sso/saml2/sp/acs`
- **OIDC Redirect URI:** `https://app.gearflow.com/api/auth/sso/callback/{providerId}`

The settings UI should show these values clearly with copy-to-clipboard buttons.

---

## 4. User Provisioning

### Provisioning Modes

Each SSO provider has a configurable provisioning mode:

| Mode | Description |
|------|-------------|
| **AUTO_CREATE** | User is created and added to the org immediately on first SSO login. No admin approval needed. |
| **REQUIRE_APPROVAL** | User account is created but placed in a `pending` state. An org admin must approve before they can access the org. |
| **EXISTING_ONLY** | Only users who already have a GearFlow account and are already members of the org can log in via SSO. No new accounts are created. |

### `provisionUser` Hook Implementation

```typescript
provisionUser: async ({ user, token, provider }) => {
  // 1. Look up the org's SSO settings from Organization.metadata
  const org = await prisma.organization.findUnique({
    where: { id: provider.organizationId },
  });
  const ssoSettings = org.metadata?.sso;

  // 2. Check provisioning mode
  if (ssoSettings.provisioningMode === "EXISTING_ONLY") {
    // Check if user exists and is a member
    const member = await prisma.member.findFirst({
      where: { organizationId: org.id, userId: user.id },
    });
    if (!member) throw new Error("Account not authorised for this organisation");
    return { user };
  }

  if (ssoSettings.provisioningMode === "REQUIRE_APPROVAL") {
    // Create user but flag as pending
    // Store a PendingSSOUser record for admin review
    return { user, requiresApproval: true };
  }

  // AUTO_CREATE: user is created by Better Auth automatically
  // We just need to handle role mapping (Section 5)
  return { user };
},
```

### Pending Approval Flow

When provisioning mode is `REQUIRE_APPROVAL`:
1. User authenticates via SSO successfully
2. GearFlow creates the User account (or finds existing)
3. Instead of creating a full `Member` record, create a `PendingSSOApproval` record
4. User is redirected to a "Pending approval" page explaining they need admin approval
5. Org admins see pending approvals in the team settings page
6. Admin can approve (creates Member with appropriate role) or reject (deletes pending record)
7. Approval/rejection sends an email notification to the user

---

## 5. Group-to-Role Mapping

### How It Works

Enterprise IdPs (Okta, Azure AD, Google Workspace) can return group memberships as part of the SSO assertion/token. GearFlow maps these IdP groups to org roles.

### Mapping Configuration

Stored in `Organization.metadata.sso.groupMappings`:

```typescript
interface SSOGroupMapping {
  idpGroupName: string;      // The group name/ID returned by the IdP
  idpGroupId?: string;        // Alternative: group ID (some IdPs return IDs, not names)
  gearflowRole: string;       // GearFlow role: "owner" | "admin" | "manager" | "member" | "viewer"
  customRoleId?: string;       // OR: a custom role ID (takes precedence over gearflowRole)
}

// Example mappings
[
  { idpGroupName: "GearFlow Admins", gearflowRole: "admin" },
  { idpGroupName: "Warehouse Team", gearflowRole: "member" },
  { idpGroupName: "AV Supervisors", customRoleId: "role_abc123" },
  { idpGroupName: "Read Only", gearflowRole: "viewer" },
]
```

### Mapping Resolution

When a user authenticates via SSO:

1. Extract groups from the SSO token/assertion:
   - OIDC: from the `groups` claim (configurable claim name)
   - SAML: from the group attribute in the assertion (configurable attribute name)
2. Match against the org's group mappings
3. **If exactly one mapping matches:** Assign that role
4. **If multiple mappings match:** Use the highest-privilege role (owner > admin > manager > member > viewer). For custom roles, use the first matched custom role.
5. **If no mapping matches:** Use the org's default SSO role (configurable, defaults to `member`)
6. **On subsequent logins:** Re-evaluate group mappings. If the user's IdP groups changed, update their GearFlow role accordingly

### Role Sync Behaviour

| Setting | Description |
|---------|-------------|
| **SYNC_ON_LOGIN** (default) | Role is updated to match IdP groups on every login. If the user was manually promoted in GearFlow, the SSO login will override it. |
| **INITIAL_ONLY** | Role is set from IdP groups on first login only. Manual GearFlow role changes are preserved on subsequent logins. |
| **MANUAL_ONLY** | IdP groups are logged/displayed but never automatically applied. Admin must set roles manually. |

### Custom Roles

Custom roles (from `CustomRole` table) work with group mapping:
- The mapping UI shows a dropdown of both built-in roles and custom roles
- `customRoleId` takes precedence over `gearflowRole`
- Custom roles use JSON-stored permissions, so they integrate directly with the existing permission system

### Groups Claim Configuration

Different IdPs return groups in different claim names:
- Okta: `groups` (OIDC) or configurable SAML attribute
- Azure AD: `groups` (returns object IDs by default, need to configure for names)
- Google Workspace: requires custom SAML attribute setup

The SSO settings UI lets admins configure:
- **OIDC groups claim name:** default `groups`, can be changed to `roles`, `memberOf`, etc.
- **SAML groups attribute:** default `groups`, can be any SAML attribute name
- **Group value type:** `name` (human-readable group name) or `id` (IdP group ID)

---

## 6. Data Model

### New Models

Better Auth's SSO plugin creates the `ssoProvider` table automatically. GearFlow adds:

```prisma
model PendingSSOApproval {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  email           String
  name            String?
  idpGroups       String[] @default([])  // Groups returned by IdP
  suggestedRole   String?               // Role suggested by group mapping
  providerId      String                // Which SSO provider they came through

  status          SSOApprovalStatus     // PENDING, APPROVED, REJECTED
  reviewedById    String?
  reviewedBy      User?    @relation("SSOReviewer", fields: [reviewedById], references: [id], onDelete: SetNull)
  reviewedAt      DateTime?
  reviewNote      String?

  createdAt       DateTime @default(now())

  @@unique([organizationId, userId])
  @@index([organizationId, status])
}

enum SSOApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}
```

### Organization Metadata Additions

Add to `Organization.metadata` JSON:

```typescript
interface OrgSSOSettings {
  enabled: boolean;
  provisioningMode: "AUTO_CREATE" | "REQUIRE_APPROVAL" | "EXISTING_ONLY";
  defaultRole: string;           // Default role for SSO users ("member")
  roleSyncBehavior: "SYNC_ON_LOGIN" | "INITIAL_ONLY" | "MANUAL_ONLY";
  allowPasswordLogin: boolean;    // Whether to show email/password on the org login page alongside SSO
  enforceSSO: boolean;            // If true, members MUST use SSO (disable password login for SSO-matched domains)
  groupMappings: SSOGroupMapping[];
  oidcGroupsClaim: string;        // Default: "groups"
  samlGroupsAttribute: string;    // Default: "groups"
  groupValueType: "name" | "id";  // Default: "name"
}
```

---

## 7. Settings UI

### Route: `/settings/sso` (new page)

Only visible to users with `orgSettings: update` permission. Split into sections:

**Section 1: SSO Status**
- Toggle: "Enable SSO for this organisation"
- When enabled, shows the org login URL: `https://app.gearflow.com/login/{org-slug}` with copy button

**Section 2: Identity Provider Configuration**
- List of configured SSO providers (table)
- "Add Provider" button → dialog with two tabs: OIDC and SAML
- Per-provider: edit, test connection, enable/disable, delete
- SP metadata display with copy buttons (Entity ID, ACS URL, Redirect URI)

**Section 3: User Provisioning**
- Radio group: Auto Create / Require Approval / Existing Only
- Default role dropdown (for users without a group mapping match)

**Section 4: Group-to-Role Mapping**
- Table of mappings: IdP Group Name → GearFlow Role
- "Add Mapping" button → row with group name input + role dropdown (includes custom roles)
- Drag to reorder (priority order for multiple matches)
- Role sync behaviour: radio group (Sync on Login / Initial Only / Manual Only)
- Group claim name field (advanced, collapsed by default)

**Section 5: Login Behaviour**
- Checkbox: "Allow email/password login alongside SSO"
- Checkbox: "Enforce SSO for all users with matching email domains" (disables password login for those users)

**Section 6: Pending Approvals**
- Table of pending SSO users (if provisioning mode is REQUIRE_APPROVAL)
- Each row: name, email, IdP groups, suggested role, date, approve/reject buttons

### Sidebar

Add SSO as a sub-item under Settings:
```typescript
{ title: "Single Sign-On", url: "/settings/sso", icon: "Shield" }
```

Or within the settings overview page as a card linking to `/settings/sso`.

---

## 8. Server Actions

### `src/server/sso.ts` — New File

```typescript
"use server";

// SSO provider management (requires orgSettings:update)
export async function getSSOProviders(): Promise<SSOProvider[]>;
export async function registerSSOProvider(data: SSOProviderInput): Promise<SSOProvider>;
export async function updateSSOProvider(providerId: string, data: Partial<SSOProviderInput>): Promise<SSOProvider>;
export async function deleteSSOProvider(providerId: string): Promise<void>;
export async function testSSOConnection(providerId: string): Promise<{ success: boolean; error?: string }>;

// SSO org settings (requires orgSettings:update)
export async function getSSOSettings(): Promise<OrgSSOSettings>;
export async function updateSSOSettings(data: Partial<OrgSSOSettings>): Promise<void>;

// Group mappings
export async function updateGroupMappings(mappings: SSOGroupMapping[]): Promise<void>;

// Pending approvals
export async function getPendingApprovals(): Promise<PendingSSOApproval[]>;
export async function approveSSOUser(approvalId: string, role?: string): Promise<void>;
export async function rejectSSOUser(approvalId: string, note?: string): Promise<void>;

// Email domain → org lookup (used by global login page)
export async function lookupOrgsByEmail(email: string): Promise<{ orgId: string; orgSlug: string; orgName: string; hasSSO: boolean }[]>;

// SSO login page data (public, no auth required)
export async function getOrgLoginInfo(orgSlug: string): Promise<OrgLoginInfo | null>;
```

---

## 9. API Routes

Better Auth handles the core SSO routes automatically:
- `/api/auth/sso/sign-in` — Initiate SSO flow
- `/api/auth/sso/callback/:providerId` — OIDC callback
- `/api/auth/sso/saml2/sp/acs` — SAML ACS
- `/api/auth/sso/saml2/metadata/:providerId` — SAML SP metadata

GearFlow adds:

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/auth/sso/org-lookup` | POST | Look up orgs by email domain (for smart login routing) | None (public, rate-limited) |

---

## 10. Middleware Changes

### New Public Routes

Add to middleware exemptions:
```typescript
"/login/",              // Org-specific login pages (/login/[orgSlug])
"/api/auth/sso",        // SSO callbacks and metadata
"/api/auth/sso/org-lookup",  // Public email domain lookup
"/pending-approval",    // Pending SSO approval page
```

### SSO Enforcement

If an org has `enforceSSO: true`, the middleware should check: when a user with an SSO-matched email domain tries to access the app via a non-SSO session (e.g. they logged in with email/password at the global `/login`), redirect them to the org SSO login page instead. This prevents users from bypassing SSO by using the global login.

Implementation: after session validation, if the user's `activeOrganizationId` has SSO enforced and the user's session was not created via SSO (check the `Account` provider type), redirect to `/login/{org-slug}`.

---

## 11. Security Requirements

1. **SAML assertion validation**: Better Auth's SSO plugin handles XML signature verification via `samlify`. Ensure `maxResponseSize` and `maxMetadataSize` are configured to prevent XML bomb attacks.

2. **OIDC token validation**: Better Auth validates `iss`, `aud`, and `exp` claims. Enable `requireIssuerValidation: true` on OIDC providers.

3. **SSO secrets storage**: Client secrets are stored encrypted in the `ssoProvider` table. Better Auth handles this, but verify encryption is enabled.

4. **Domain spoofing prevention**: When matching email domains to SSO providers, verify the domain is actually configured by the org admin — don't auto-discover. A user with `evil@acmecorp.com` should only be routed to Acme Corp's SSO if Acme Corp's admin explicitly registered `acmecorp.com` as their domain.

5. **No open redirect**: SSO callbacks must validate the redirect URL against the app's origin. Better Auth handles this, but verify with testing.

6. **Rate limiting on org lookup**: The `/api/auth/sso/org-lookup` endpoint reveals which orgs exist for a given email domain. Rate-limit heavily (5 requests per minute per IP) and return minimal data.

7. **SSO-enforced orgs cannot have password logins**: When `enforceSSO` is true, the password reset and password change flows must be disabled for users in that org. The account page should hide the password section.

8. **Prevent SSO bypass via invite**: When an org enforces SSO, invitations should still work but the invited user must authenticate via SSO (not create a password account) to accept the invitation.

9. **Multi-org users**: A user may be in Org A (SSO) and Org B (password). They should be able to switch between orgs and use the appropriate auth method for each. The session's `activeOrganizationId` determines which org's auth policy applies.

10. **Audit all SSO events**: Log SSO provider creation/deletion, SSO logins (success and failure), group mapping changes, approval/rejection of pending users.

---

## 12. Site Admin Controls

### Platform-Level SSO Settings

In the site admin panel (`/admin/settings`), add:

- **Allow SSO**: Global toggle to enable/disable SSO across the platform (default: enabled)
- **Max SSO providers per org**: Limit (default: 5)
- **Allowed SSO protocols**: Checkboxes for SAML and OIDC (default: both enabled)
- **SSO audit log**: View all SSO events across all orgs

### Per-Org SSO Overview

In the admin org detail page (`/admin/organizations/[id]`), show:
- Whether SSO is configured
- Number of SSO providers
- Number of SSO-provisioned users
- Pending approvals count
- "Disable SSO" override button (for emergencies — e.g. if an IdP is misconfigured and locking users out)

---

## 13. Permissions

SSO configuration uses the existing `orgSettings` resource:
- `orgSettings: update` — configure SSO providers, manage group mappings, handle approvals
- `orgSettings: read` — view SSO configuration (but not secrets like client secrets)

No new permission resource needed.

---

## 14. Activity Log Integration

If the Activity Log feature is implemented, log:
- SSO provider created/updated/deleted
- SSO login success (with IdP groups received)
- SSO login failure (with error reason)
- Group mapping changed
- Provisioning mode changed
- User auto-provisioned via SSO
- Pending approval created/approved/rejected
- SSO enforcement enabled/disabled
- Role sync triggered (with old role → new role)

---

## 15. Edge Cases & Error Handling

### IdP Down / Unreachable
If the IdP is unreachable during SSO login, show a clear error: "Your identity provider is not responding. Please try again or contact your IT administrator." If `allowPasswordLogin` is true, offer the fallback: "You can also sign in with your email and password."

### User Removed from IdP Group
On next SSO login, if `roleSyncBehavior` is `SYNC_ON_LOGIN` and the user no longer matches any group mapping, they fall back to the default SSO role. If the default role is less privileged, their access is reduced. Log this role change.

### User Exists in Multiple Orgs with Different SSO Providers
The smart login routing shows an org picker. Each org may have different SSO providers. The user clicks the org they want, is redirected to that org's IdP, and the session is scoped to that org.

### SSO User Tries Global Login with Password
If the user's org has `enforceSSO: true`, the global login should detect this after email entry and redirect to the org SSO page instead of accepting a password.

### Domain Conflict Between Orgs
Two orgs cannot register the same email domain. Enforce uniqueness on `ssoProvider.domain` globally (not just per-org). This prevents domain hijacking.

### Org Admin Locks Themselves Out
If an org admin enables `enforceSSO` and the SSO provider is misconfigured, they can't log in. Mitigation:
- Site admins can disable SSO for any org from the admin panel
- Before enabling `enforceSSO`, require a successful test SSO login
- Grace period: `enforceSSO` doesn't take effect for 24 hours after enabling, giving the admin time to test and revert

---

## 16. Implementation Phases

### Phase 1: Plugin Integration & Org Login Pages
1. Install and configure `@better-auth/sso` plugin
2. Run database migration for `ssoProvider` table
3. Create `/login/[orgSlug]` page
4. Implement smart login routing on `/login` (email domain → org lookup)
5. Basic OIDC provider registration (settings UI)

### Phase 2: SAML & Provider Management
1. SAML provider configuration UI
2. SP metadata display with copy buttons
3. Test connection functionality
4. Multiple providers per org

### Phase 3: User Provisioning
1. Implement provisioning modes (auto-create, require approval, existing only)
2. Create `PendingSSOApproval` model and migration
3. Build approval UI in team settings
4. Email notifications for approvals/rejections

### Phase 4: Group-to-Role Mapping
1. Group mapping configuration UI
2. Group extraction from OIDC tokens and SAML assertions
3. Role assignment logic with custom role support
4. Role sync behaviour options

### Phase 5: SSO Enforcement & Hardening
1. `enforceSSO` toggle with password login blocking
2. Middleware enforcement checks
3. Domain uniqueness validation
4. Grace period for SSO enforcement
5. Site admin emergency override
6. Full security audit

---

## Notes

- Better Auth's SSO plugin does the heavy lifting for SAML/OIDC protocol handling. GearFlow's implementation is primarily about the UI, provisioning logic, group mapping, and login flow design.
- The `ssoProvider` table is managed by Better Auth — don't create a separate model for it. Use Better Auth's API endpoints to CRUD providers.
- Domain uniqueness is critical. If `acmecorp.com` is registered by Org A, Org B cannot also register it. This prevents phishing attacks where a malicious org intercepts SSO for another company's domain.
- SCIM (System for Cross-domain Identity Management) for automated user provisioning/deprovisioning from the IdP is a natural extension of this feature but is out of scope for v1. Better Auth has SCIM support in its enterprise tier — evaluate later.
- Consider adding "Just-In-Time" (JIT) deprovisioning: if an SSO user hasn't logged in for X days, automatically disable their membership. Out of scope for v1.
- The org-specific login page (`/login/[orgSlug]`) doubles as a branded login page even for orgs without SSO. This is a nice side benefit — orgs can share their custom login URL with their team.
