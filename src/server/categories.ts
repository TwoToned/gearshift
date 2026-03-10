"use server";

import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/org-context";
import { categorySchema, type CategoryFormValues } from "@/lib/validations/category";

export async function getCategories() {
  const { organizationId } = await getOrgContext();
  return prisma.category.findMany({
    where: { organizationId },
    include: { parent: true, _count: { select: { models: true, children: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getCategoryTree() {
  const { organizationId } = await getOrgContext();
  const categories = await prisma.category.findMany({
    where: { organizationId },
    include: { _count: { select: { models: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  // Build tree structure
  const map = new Map<string, typeof categories[0] & { children: typeof categories }>();
  const roots: (typeof categories[0] & { children: typeof categories })[] = [];

  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] });
  }
  for (const cat of categories) {
    const node = map.get(cat.id)!;
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function createCategory(data: CategoryFormValues) {
  const { organizationId } = await getOrgContext();
  const parsed = categorySchema.parse(data);
  return prisma.category.create({
    data: {
      ...parsed,
      parentId: parsed.parentId || null,
      organizationId,
    },
  });
}

export async function updateCategory(id: string, data: CategoryFormValues) {
  const { organizationId } = await getOrgContext();
  const parsed = categorySchema.parse(data);
  return prisma.category.update({
    where: { id, organizationId },
    data: {
      ...parsed,
      parentId: parsed.parentId || null,
    },
  });
}

export async function deleteCategory(id: string) {
  const { organizationId } = await getOrgContext();
  // Check for children or models first
  const category = await prisma.category.findUnique({
    where: { id, organizationId },
    include: { _count: { select: { children: true, models: true } } },
  });
  if (!category) throw new Error("Category not found");
  if (category._count.children > 0) throw new Error("Cannot delete category with subcategories");
  if (category._count.models > 0) throw new Error("Cannot delete category with models");

  return prisma.category.delete({ where: { id, organizationId } });
}
