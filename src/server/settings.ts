"use server";

import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/org-context";
import { serialize } from "@/lib/serialize";

export interface OrgBranding {
  primaryColor?: string;
  accentColor?: string;
  documentColor?: string;
  logoUrl?: string;
  iconUrl?: string;
  /** Which image to show on PDFs: "logo" (full width above header), "icon" (inline), or "none" */
  documentLogoMode?: "logo" | "icon" | "none";
  /** Whether to show the org name text on PDF documents (default true) */
  showOrgNameOnDocuments?: boolean;
}

export interface TestTagSettings {
  prefix?: string;
  digits?: number;
  counter?: number;
  defaultIntervalMonths?: number;
  defaultEquipmentClass?: "CLASS_I" | "CLASS_II" | "CLASS_II_DOUBLE_INSULATED" | "LEAD_CORD_ASSEMBLY";
  dueSoonThresholdDays?: number;
  companyName?: string;
  defaultTesterName?: string;
  defaultTestMethod?: "INSULATION_RESISTANCE" | "LEAKAGE_CURRENT" | "BOTH";
  checkoutPolicy?: "WARN" | "BLOCK";
}

export interface OrgSettings {
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  currency?: string;
  taxRate?: number;
  taxLabel?: string;
  assetTagPrefix?: string;
  assetTagCounter?: number;
  assetTagDigits?: number;
  branding?: OrgBranding;
  testTag?: TestTagSettings;
}

export async function getOrganization() {
  const { organizationId } = await getOrgContext();

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!org) throw new Error("Organization not found");

  let settings: OrgSettings = {};
  if (org.metadata) {
    try {
      settings = JSON.parse(org.metadata);
    } catch {
      // ignore
    }
  }

  return serialize({ ...org, settings });
}

export async function updateOrganization(data: {
  name: string;
  settings: OrgSettings;
}) {
  const { organizationId } = await getOrgContext();

  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      name: data.name,
      metadata: JSON.stringify(data.settings),
    },
  });

  return serialize(updated);
}

/** Get org-level T&T settings (for fallback defaults). */
export async function getOrgTestTagSettings(): Promise<TestTagSettings> {
  const { organizationId } = await getOrgContext();
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org?.metadata) return {};
  try {
    const settings = JSON.parse(org.metadata) as OrgSettings;
    return settings.testTag || {};
  } catch {
    return {};
  }
}

/** Read-only preview of the next N asset tags — does NOT increment the counter. */
export async function peekNextAssetTags(count = 1): Promise<string[]> {
  const { organizationId } = await getOrgContext();

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org) throw new Error("Organization not found");

  let settings: OrgSettings = {};
  if (org.metadata) {
    try {
      settings = JSON.parse(org.metadata);
    } catch {
      // ignore
    }
  }

  const prefix = settings.assetTagPrefix || "ASSET";
  const digits = settings.assetTagDigits || 4;
  const currentCounter = settings.assetTagCounter || 0;

  const tags: string[] = [];
  for (let i = 1; i <= count; i++) {
    tags.push(`${prefix}${String(currentCounter + i).padStart(digits, "0")}`);
  }
  return tags;
}

/** Atomically reserve N asset tags — increments the counter. Call only at creation time. */
export async function reserveAssetTags(count = 1): Promise<string[]> {
  const { organizationId } = await getOrgContext();

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new Error("Organization not found");

    let settings: OrgSettings = {};
    if (org.metadata) {
      try {
        settings = JSON.parse(org.metadata);
      } catch {
        // ignore
      }
    }

    const prefix = settings.assetTagPrefix || "ASSET";
    const digits = settings.assetTagDigits || 4;
    const currentCounter = settings.assetTagCounter || 0;

    const tags: string[] = [];
    for (let i = 1; i <= count; i++) {
      tags.push(`${prefix}${String(currentCounter + i).padStart(digits, "0")}`);
    }

    settings.assetTagCounter = currentCounter + count;

    await tx.organization.update({
      where: { id: organizationId },
      data: { metadata: JSON.stringify(settings) },
    });

    return tags;
  });
}

/** Read-only preview of the next N test tag IDs — does NOT increment the counter. */
export async function peekNextTestTagIds(count = 1): Promise<string[]> {
  const { organizationId } = await getOrgContext();

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org) throw new Error("Organization not found");

  let settings: OrgSettings = {};
  if (org.metadata) {
    try {
      settings = JSON.parse(org.metadata);
    } catch {
      // ignore
    }
  }

  const tt = settings.testTag || {};
  const prefix = tt.prefix || "TT";
  const digits = tt.digits || 4;
  const currentCounter = tt.counter || 0;

  const ids: string[] = [];
  for (let i = 1; i <= count; i++) {
    ids.push(`${prefix}${String(currentCounter + i).padStart(digits, "0")}`);
  }
  return ids;
}

/** Atomically reserve N test tag IDs — increments the counter. Call only at creation time. */
export async function reserveTestTagIds(count = 1): Promise<string[]> {
  const { organizationId } = await getOrgContext();

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new Error("Organization not found");

    let settings: OrgSettings = {};
    if (org.metadata) {
      try {
        settings = JSON.parse(org.metadata);
      } catch {
        // ignore
      }
    }

    const tt = settings.testTag || {};
    const prefix = tt.prefix || "TT";
    const digits = tt.digits || 4;
    const currentCounter = tt.counter || 0;

    const ids: string[] = [];
    for (let i = 1; i <= count; i++) {
      ids.push(`${prefix}${String(currentCounter + i).padStart(digits, "0")}`);
    }

    settings.testTag = { ...tt, counter: currentCounter + count };

    await tx.organization.update({
      where: { id: organizationId },
      data: { metadata: JSON.stringify(settings) },
    });

    return ids;
  });
}

/** @deprecated Use peekNextAssetTags for preview, reserveAssetTags for creation */
export async function getNextAssetTag(): Promise<string> {
  const tags = await peekNextAssetTags(1);
  return tags[0];
}

const VALID_ROLES = ["admin", "manager", "staff", "warehouse"] as const;
type MemberRole = (typeof VALID_ROLES)[number];

export async function addMemberByEmail(email: string, role: MemberRole) {
  const { organizationId } = await getOrgContext();

  if (!VALID_ROLES.includes(role)) {
    throw new Error("Invalid role");
  }

  // Find user by email
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user) {
    throw new Error("No account found with that email. They need to register first.");
  }

  // Check if already a member
  const existing = await prisma.member.findFirst({
    where: { organizationId, userId: user.id },
  });

  if (existing) {
    throw new Error("This person is already a member of your organization.");
  }

  const member = await prisma.member.create({
    data: {
      organizationId,
      userId: user.id,
      role,
    },
    include: { user: true },
  });

  return serialize(member);
}

export async function removeMember(memberId: string) {
  const { organizationId } = await getOrgContext();

  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId },
  });

  if (!member) throw new Error("Member not found");
  if (member.role === "owner") throw new Error("Cannot remove the owner");

  await prisma.member.delete({ where: { id: memberId } });
  return { success: true };
}

export async function getMembers() {
  const { organizationId } = await getOrgContext();

  const members = await prisma.member.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });

  return serialize(members);
}
