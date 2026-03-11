"use server";

import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/org-context";
import { serialize } from "@/lib/serialize";
import type { OrgSettings } from "@/server/settings";

/**
 * Recalculate and update a TestTagAsset's status based on its latest test record and dates.
 */
async function recalculateStatus(
  testTagAssetId: string,
  organizationId: string,
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0] = prisma,
) {
  const asset = await tx.testTagAsset.findFirst({
    where: { id: testTagAssetId, organizationId },
    include: {
      testRecords: { orderBy: { testDate: "desc" }, take: 1 },
    },
  });
  if (!asset) return;

  // Retired items stay retired
  if (asset.status === "RETIRED") return;

  const latestRecord = asset.testRecords[0];

  if (!latestRecord) {
    await tx.testTagAsset.update({
      where: { id: testTagAssetId },
      data: { status: "NOT_YET_TESTED" },
    });
    return;
  }

  // If latest test failed, status is FAILED
  if (latestRecord.result === "FAIL") {
    await tx.testTagAsset.update({
      where: { id: testTagAssetId },
      data: { status: "FAILED" },
    });
    return;
  }

  // Determine due soon threshold
  const org = await tx.organization.findUnique({
    where: { id: organizationId },
  });
  let dueSoonDays = 14;
  if (org?.metadata) {
    try {
      const settings: OrgSettings = JSON.parse(org.metadata);
      dueSoonDays = settings.testTag?.dueSoonThresholdDays || 14;
    } catch { /* ignore */ }
  }

  const now = new Date();
  const nextDue = asset.nextDueDate;

  if (!nextDue || nextDue < now) {
    await tx.testTagAsset.update({
      where: { id: testTagAssetId },
      data: { status: "OVERDUE" },
    });
  } else {
    const dueSoonDate = new Date(now);
    dueSoonDate.setDate(dueSoonDate.getDate() + dueSoonDays);

    await tx.testTagAsset.update({
      where: { id: testTagAssetId },
      data: { status: nextDue <= dueSoonDate ? "DUE_SOON" : "CURRENT" },
    });
  }
}

export async function createTestTagRecord(data: {
  testTagAssetId: string;
  testDate: Date | string;
  testerName: string;
  result: "PASS" | "FAIL";
  visualInspectionResult?: "PASS" | "FAIL";
  visualCordCondition?: boolean;
  visualPlugCondition?: boolean;
  visualHousingCondition?: boolean;
  visualSwitchCondition?: boolean;
  visualVentsUnobstructed?: boolean;
  visualCordGrip?: boolean;
  visualEarthPin?: boolean;
  visualMarkingsLegible?: boolean;
  visualNoModifications?: boolean;
  visualNotes?: string;
  equipmentClassTested?: "CLASS_I" | "CLASS_II" | "CLASS_II_DOUBLE_INSULATED" | "LEAD_CORD_ASSEMBLY";
  testMethod?: "INSULATION_RESISTANCE" | "LEAKAGE_CURRENT" | "BOTH";
  earthContinuityResult?: "PASS" | "FAIL" | "NOT_APPLICABLE";
  earthContinuityReading?: number;
  insulationResult?: "PASS" | "FAIL" | "NOT_APPLICABLE";
  insulationReading?: number;
  insulationTestVoltage?: number;
  leakageCurrentResult?: "PASS" | "FAIL" | "NOT_APPLICABLE";
  leakageCurrentReading?: number;
  polarityResult?: "PASS" | "FAIL" | "NOT_APPLICABLE";
  rcdTripTimeResult?: "PASS" | "FAIL" | "NOT_APPLICABLE";
  rcdTripTimeReading?: number;
  functionalTestResult?: "PASS" | "FAIL" | "NOT_APPLICABLE";
  functionalTestNotes?: string;
  failureAction?: "NONE" | "REPAIRED" | "REMOVED_FROM_SERVICE" | "DISPOSED" | "REFERRED_TO_ELECTRICIAN";
  failureNotes?: string;
  nextDueDate: Date | string;
}) {
  const { organizationId, userId } = await getOrgContext();

  // Verify asset exists and belongs to org
  const testTagAsset = await prisma.testTagAsset.findFirst({
    where: { id: data.testTagAssetId, organizationId },
  });
  if (!testTagAsset) throw new Error("Test tag asset not found");

  const testDate = new Date(data.testDate);
  const nextDueDate = new Date(data.nextDueDate);

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.testTagRecord.create({
      data: {
        organizationId,
        testTagAssetId: data.testTagAssetId,
        testDate,
        testedById: userId,
        testerName: data.testerName,
        result: data.result,
        visualInspectionResult: data.visualInspectionResult || "PASS",
        visualCordCondition: data.visualCordCondition ?? null,
        visualPlugCondition: data.visualPlugCondition ?? null,
        visualHousingCondition: data.visualHousingCondition ?? null,
        visualSwitchCondition: data.visualSwitchCondition ?? null,
        visualVentsUnobstructed: data.visualVentsUnobstructed ?? null,
        visualCordGrip: data.visualCordGrip ?? null,
        visualEarthPin: data.visualEarthPin ?? null,
        visualMarkingsLegible: data.visualMarkingsLegible ?? null,
        visualNoModifications: data.visualNoModifications ?? null,
        visualNotes: data.visualNotes || null,
        equipmentClassTested: data.equipmentClassTested || "CLASS_I",
        testMethod: data.testMethod || "INSULATION_RESISTANCE",
        earthContinuityResult: data.earthContinuityResult || "NOT_APPLICABLE",
        earthContinuityReading: data.earthContinuityReading ?? null,
        insulationResult: data.insulationResult || "NOT_APPLICABLE",
        insulationReading: data.insulationReading ?? null,
        insulationTestVoltage: data.insulationTestVoltage ?? null,
        leakageCurrentResult: data.leakageCurrentResult || "NOT_APPLICABLE",
        leakageCurrentReading: data.leakageCurrentReading ?? null,
        polarityResult: data.polarityResult || "NOT_APPLICABLE",
        rcdTripTimeResult: data.rcdTripTimeResult || "NOT_APPLICABLE",
        rcdTripTimeReading: data.rcdTripTimeReading ?? null,
        functionalTestResult: data.functionalTestResult || "NOT_APPLICABLE",
        functionalTestNotes: data.functionalTestNotes || null,
        failureAction: data.failureAction || "NONE",
        failureNotes: data.failureNotes || null,
        nextDueDate,
      },
    });

    // Update parent TestTagAsset
    await tx.testTagAsset.update({
      where: { id: data.testTagAssetId },
      data: {
        lastTestDate: testDate,
        nextDueDate,
      },
    });

    // Recalculate status
    await recalculateStatus(data.testTagAssetId, organizationId, tx);

    return created;
  });

  return serialize(record);
}

export async function getTestTagRecords(testTagAssetId: string, params?: {
  page?: number;
  pageSize?: number;
}) {
  const { organizationId } = await getOrgContext();
  const { page = 1, pageSize = 20 } = params || {};

  const where = { organizationId, testTagAssetId };

  const [records, total] = await Promise.all([
    prisma.testTagRecord.findMany({
      where,
      orderBy: { testDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        testedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.testTagRecord.count({ where }),
  ]);

  return serialize({
    records,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function getRecentTestRecords(params?: {
  page?: number;
  pageSize?: number;
}) {
  const { organizationId } = await getOrgContext();
  const { page = 1, pageSize = 20 } = params || {};

  const where = { organizationId };

  const [records, total] = await Promise.all([
    prisma.testTagRecord.findMany({
      where,
      orderBy: { testDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        testTagAsset: { select: { testTagId: true, description: true } },
        testedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.testTagRecord.count({ where }),
  ]);

  return serialize({
    records,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function getSessionSummary(recordIds: string[]) {
  const { organizationId } = await getOrgContext();

  const records = await prisma.testTagRecord.findMany({
    where: { organizationId, id: { in: recordIds } },
    include: {
      testTagAsset: { select: { testTagId: true, description: true } },
      testedBy: { select: { id: true, name: true } },
    },
    orderBy: { testDate: "desc" },
  });

  const passCount = records.filter((r) => r.result === "PASS").length;
  const failCount = records.filter((r) => r.result === "FAIL").length;

  return serialize({
    total: records.length,
    passCount,
    failCount,
    records,
  });
}

/** Batch recalculate statuses — useful for cron or after settings change */
export async function recalculateAllStatuses() {
  const { organizationId } = await getOrgContext();

  const assets = await prisma.testTagAsset.findMany({
    where: { organizationId, isActive: true, status: { not: "RETIRED" } },
    select: { id: true },
  });

  for (const asset of assets) {
    await recalculateStatus(asset.id, organizationId);
  }

  return { updated: assets.length };
}
