"use server";

import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/org-context";
import { serialize } from "@/lib/serialize";

export async function globalSearch(query: string) {
  const { organizationId } = await getOrgContext();

  if (!query || query.length < 2) return { results: [] };

  const [assets, bulkAssets, projects, clients, models] = await Promise.all([
    prisma.asset.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [
          { assetTag: { contains: query, mode: "insensitive" } },
          { serialNumber: { contains: query, mode: "insensitive" } },
          { customName: { contains: query, mode: "insensitive" } },
          { model: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      include: { model: true },
      take: 5,
    }),
    prisma.bulkAsset.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [
          { assetTag: { contains: query, mode: "insensitive" } },
          { model: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      include: { model: true },
      take: 5,
    }),
    prisma.project.findMany({
      where: {
        organizationId,
        isTemplate: false,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { projectNumber: { contains: query, mode: "insensitive" } },
        ],
      },
      include: { client: true },
      take: 5,
    }),
    prisma.client.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { contactName: { contains: query, mode: "insensitive" } },
          { contactEmail: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),
    prisma.model.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { manufacturer: { contains: query, mode: "insensitive" } },
          { modelNumber: { contains: query, mode: "insensitive" } },
        ],
      },
      include: { category: true },
      take: 5,
    }),
  ]);

  type SearchResult = {
    id: string;
    type: "asset" | "bulk-asset" | "project" | "client" | "model";
    title: string;
    subtitle: string | null;
    href: string;
  };

  const results: SearchResult[] = [];

  for (const a of assets) {
    results.push({
      id: a.id,
      type: "asset",
      title: a.assetTag + (a.customName ? ` — ${a.customName}` : ""),
      subtitle: a.model.name,
      href: `/assets/registry/${a.id}`,
    });
  }

  for (const b of bulkAssets) {
    results.push({
      id: b.id,
      type: "bulk-asset",
      title: b.assetTag,
      subtitle: `${b.model.name} (${b.totalQuantity} units)`,
      href: `/assets/registry/${b.id}`,
    });
  }

  for (const p of projects) {
    results.push({
      id: p.id,
      type: "project",
      title: `${p.projectNumber} — ${p.name}`,
      subtitle: p.client?.name || p.status,
      href: `/projects/${p.id}`,
    });
  }

  for (const c of clients) {
    results.push({
      id: c.id,
      type: "client",
      title: c.name,
      subtitle: c.contactName || c.contactEmail || null,
      href: `/clients/${c.id}`,
    });
  }

  for (const m of models) {
    results.push({
      id: m.id,
      type: "model",
      title: m.name + (m.modelNumber ? ` (${m.modelNumber})` : ""),
      subtitle: m.manufacturer || m.category?.name || null,
      href: `/assets/models/${m.id}`,
    });
  }

  return serialize({ results });
}
