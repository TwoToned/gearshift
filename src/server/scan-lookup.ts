"use server";

import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/org-context";

/**
 * Look up a scanned barcode value and return the URL to navigate to.
 * Checks: Asset → Kit → Test & Tag item (by testTagId).
 */
export async function scanLookup(value: string): Promise<{ url: string | null; label: string | null }> {
  const { organizationId } = await getOrgContext();
  const tag = value.trim();

  // 1. Check serialized assets
  const asset = await prisma.asset.findUnique({
    where: { organizationId_assetTag: { organizationId, assetTag: tag } },
    select: { id: true, assetTag: true },
  });
  if (asset) {
    return { url: `/assets/registry/${asset.id}`, label: `Asset ${asset.assetTag}` };
  }

  // 2. Check kits
  const kit = await prisma.kit.findUnique({
    where: { organizationId_assetTag: { organizationId, assetTag: tag } },
    select: { id: true, assetTag: true },
  });
  if (kit) {
    return { url: `/kits/${kit.id}`, label: `Kit ${kit.assetTag}` };
  }

  // 3. Check bulk assets (they have asset tags too)
  const bulk = await prisma.bulkAsset.findUnique({
    where: { organizationId_assetTag: { organizationId, assetTag: tag } },
    select: { id: true, assetTag: true },
  });
  if (bulk) {
    return { url: `/assets/registry/${bulk.id}`, label: `Bulk Asset ${bulk.assetTag}` };
  }

  // 4. Check test & tag items
  const ttAsset = await prisma.testTagAsset.findUnique({
    where: { organizationId_testTagId: { organizationId, testTagId: tag } },
    select: { id: true, testTagId: true },
  });
  if (ttAsset) {
    return { url: `/test-and-tag/${ttAsset.id}`, label: `T&T ${ttAsset.testTagId}` };
  }

  return { url: null, label: null };
}
