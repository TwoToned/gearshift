/**
 * Role-based permission system for GearFlow.
 *
 * Defines what each org role can do. Used for both server-side enforcement
 * (via requirePermission) and client-side UI gating.
 */

export const RESOURCES = [
  "asset",
  "model",
  "kit",
  "project",
  "client",
  "warehouse",
  "testTag",
  "maintenance",
  "orgSettings",
  "orgMembers",
  "reports",
] as const;

export type Resource = (typeof RESOURCES)[number];

export type Action = string;

/** Full permission map: resource -> array of allowed actions */
export type PermissionMap = Record<Resource, readonly string[]>;

const ALL_ASSET = ["create", "read", "update", "delete", "import", "export"] as const;
const ALL_PROJECT = ["create", "read", "update", "delete", "manage_line_items", "generate_documents"] as const;

export const rolePermissions: Record<string, PermissionMap> = {
  owner: {
    asset: ALL_ASSET,
    model: ALL_ASSET,
    kit: ["create", "read", "update", "delete"],
    project: ALL_PROJECT,
    client: ["create", "read", "update", "delete"],
    warehouse: ["check_out", "check_in", "scan"],
    testTag: ["create", "read", "update", "delete", "quick_test", "generate_reports"],
    maintenance: ["create", "read", "update", "delete"],
    orgSettings: ["read", "update"],
    orgMembers: ["read", "invite", "update_role", "remove"],
    reports: ["view", "export"],
  },
  admin: {
    asset: ALL_ASSET,
    model: ALL_ASSET,
    kit: ["create", "read", "update", "delete"],
    project: ALL_PROJECT,
    client: ["create", "read", "update", "delete"],
    warehouse: ["check_out", "check_in", "scan"],
    testTag: ["create", "read", "update", "delete", "quick_test", "generate_reports"],
    maintenance: ["create", "read", "update", "delete"],
    orgSettings: ["read", "update"],
    orgMembers: ["read", "invite", "update_role", "remove"],
    reports: ["view", "export"],
  },
  manager: {
    asset: ["create", "read", "update", "import", "export"],
    model: ["create", "read", "update", "import", "export"],
    kit: ["create", "read", "update"],
    project: ["create", "read", "update", "manage_line_items", "generate_documents"],
    client: ["create", "read", "update"],
    warehouse: ["check_out", "check_in", "scan"],
    testTag: ["create", "read", "update", "quick_test", "generate_reports"],
    maintenance: ["create", "read", "update"],
    orgSettings: ["read"],
    orgMembers: ["read"],
    reports: ["view", "export"],
  },
  member: {
    asset: ["create", "read", "update"],
    model: ["create", "read", "update"],
    kit: ["read"],
    project: ["create", "read", "update", "manage_line_items", "generate_documents"],
    client: ["create", "read", "update"],
    warehouse: ["check_out", "check_in", "scan"],
    testTag: ["create", "read", "update", "quick_test"],
    maintenance: ["create", "read", "update"],
    orgSettings: [],
    orgMembers: [],
    reports: ["view"],
  },
  // Legacy roles — map to member-level
  staff: {
    asset: ["create", "read", "update"],
    model: ["create", "read", "update"],
    kit: ["read"],
    project: ["create", "read", "update", "manage_line_items", "generate_documents"],
    client: ["create", "read", "update"],
    warehouse: ["check_out", "check_in", "scan"],
    testTag: ["create", "read", "update", "quick_test"],
    maintenance: ["create", "read", "update"],
    orgSettings: [],
    orgMembers: [],
    reports: ["view"],
  },
  warehouse: {
    asset: ["read"],
    model: ["read"],
    kit: ["read"],
    project: ["read"],
    client: ["read"],
    warehouse: ["check_out", "check_in", "scan"],
    testTag: ["read"],
    maintenance: ["read"],
    orgSettings: [],
    orgMembers: [],
    reports: ["view"],
  },
  viewer: {
    asset: ["read"],
    model: ["read"],
    kit: ["read"],
    project: ["read"],
    client: ["read"],
    warehouse: [],
    testTag: ["read"],
    maintenance: ["read"],
    orgSettings: [],
    orgMembers: [],
    reports: ["view"],
  },
};

/** Check if a role has a specific permission */
export function hasPermission(
  role: string,
  resource: Resource,
  action: string,
): boolean {
  const perms = rolePermissions[role];
  if (!perms) return false;
  return perms[resource]?.includes(action) ?? false;
}

/** All org roles in hierarchy order */
export const ORG_ROLES = ["owner", "admin", "manager", "member", "viewer"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/** Roles that can be assigned (excludes owner — owner is transferred) */
export const ASSIGNABLE_ROLES = ["admin", "manager", "member", "viewer"] as const;

/** Role display labels */
export const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  member: "Member",
  staff: "Staff",
  warehouse: "Warehouse",
  viewer: "Viewer",
};
