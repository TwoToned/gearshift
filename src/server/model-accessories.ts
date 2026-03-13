"use server";

import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { getOrgContext, requirePermission } from "@/lib/org-context";
import { recalculateProjectTotals } from "@/server/line-items";

export async function getModelAccessories(modelId: string) {
  const { organizationId } = await getOrgContext();

  const accessories = await prisma.modelAccessory.findMany({
    where: { parentModelId: modelId, organizationId },
    include: {
      accessoryModel: {
        select: {
          id: true,
          name: true,
          manufacturer: true,
          modelNumber: true,
          image: true,
          isActive: true,
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return serialize(accessories);
}

export async function addModelAccessory(
  parentModelId: string,
  data: {
    accessoryModelId: string;
    quantity: number;
    level: "MANDATORY" | "OPTIONAL" | "RECOMMENDED";
    notes?: string;
  },
) {
  const { organizationId } = await requirePermission("model", "update");

  if (parentModelId === data.accessoryModelId) {
    throw new Error("A model cannot be an accessory of itself.");
  }

  // Detect circular references
  await detectCircularReference(organizationId, parentModelId, data.accessoryModelId);

  // Get next sort order
  const lastAccessory = await prisma.modelAccessory.findFirst({
    where: { parentModelId, organizationId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const accessory = await prisma.modelAccessory.create({
    data: {
      organizationId,
      parentModelId,
      accessoryModelId: data.accessoryModelId,
      quantity: data.quantity,
      level: data.level,
      notes: data.notes || null,
      sortOrder: (lastAccessory?.sortOrder ?? -1) + 1,
    },
    include: {
      accessoryModel: {
        select: {
          id: true,
          name: true,
          manufacturer: true,
          modelNumber: true,
          image: true,
          isActive: true,
          defaultRentalPrice: true,
        },
      },
    },
  });

  // Propagate: add this accessory to all existing active project line items using the parent model
  if (data.level !== "RECOMMENDED") {
    await propagateNewAccessory(organizationId, parentModelId, accessory);
  }

  return serialize(accessory);
}

export async function updateModelAccessory(
  id: string,
  data: {
    quantity?: number;
    level?: "MANDATORY" | "OPTIONAL" | "RECOMMENDED";
    notes?: string;
  },
) {
  const { organizationId } = await requirePermission("model", "update");

  const existing = await prisma.modelAccessory.findFirst({
    where: { id, organizationId },
  });
  if (!existing) throw new Error("Accessory not found.");

  const updated = await prisma.modelAccessory.update({
    where: { id },
    data: {
      quantity: data.quantity,
      level: data.level,
      notes: data.notes,
    },
    include: {
      accessoryModel: {
        select: {
          id: true,
          name: true,
          manufacturer: true,
          modelNumber: true,
          image: true,
          isActive: true,
        },
      },
    },
  });

  // Propagate quantity/level changes to existing project accessory line items
  if (data.quantity !== undefined || data.level !== undefined) {
    await propagateAccessoryUpdate(organizationId, existing, updated);
  }

  return serialize(updated);
}

export async function removeModelAccessory(id: string) {
  const { organizationId } = await requirePermission("model", "update");

  const existing = await prisma.modelAccessory.findFirst({
    where: { id, organizationId },
  });
  if (!existing) throw new Error("Accessory not found.");

  // Remove accessory line items from active projects before deleting the definition
  await propagateAccessoryRemoval(organizationId, existing);

  await prisma.modelAccessory.delete({ where: { id } });
  return { success: true };
}

export async function reorderModelAccessories(
  parentModelId: string,
  orderedIds: string[],
) {
  const { organizationId } = await requirePermission("model", "update");

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.modelAccessory.updateMany({
        where: { id, parentModelId, organizationId },
        data: { sortOrder: index },
      }),
    ),
  );

  return { success: true };
}

// ---- Propagation helpers ----
// These sync ModelAccessory changes to existing active project line items.

/**
 * Find all active (non-finished, non-template) project line items that use a given model.
 * Returns the parent line items along with their project IDs.
 */
async function findActiveLineItemsForModel(organizationId: string, modelId: string) {
  return prisma.projectLineItem.findMany({
    where: {
      organizationId,
      modelId,
      status: { not: "CANCELLED" },
      project: {
        isTemplate: false,
        status: { notIn: ["CANCELLED", "RETURNED", "COMPLETED", "INVOICED"] },
      },
    },
    select: { id: true, projectId: true, quantity: true },
  });
}

/**
 * When a new ModelAccessory is added, create accessory child line items
 * on all active projects that have the parent model.
 */
async function propagateNewAccessory(
  organizationId: string,
  parentModelId: string,
  accessory: {
    id: string;
    level: string;
    quantity: number;
    accessoryModelId: string;
    accessoryModel: { id: string; name: string; defaultRentalPrice: unknown };
  },
) {
  const parentLineItems = await findActiveLineItemsForModel(organizationId, parentModelId);
  if (parentLineItems.length === 0) return;

  const unitPrice = accessory.accessoryModel.defaultRentalPrice
    ? Number(accessory.accessoryModel.defaultRentalPrice)
    : null;

  const projectsToRecalc = new Set<string>();

  for (const parent of parentLineItems) {
    // Check if accessory already exists as a child of this line item
    const existing = await prisma.projectLineItem.findFirst({
      where: {
        parentLineItemId: parent.id,
        modelId: accessory.accessoryModelId,
        isAccessory: true,
        organizationId,
        status: { not: "CANCELLED" },
      },
    });
    if (existing) continue;

    const qty = parent.quantity * accessory.quantity;
    const lineTotal = unitPrice != null ? Math.round(unitPrice * qty * 100) / 100 : null;

    // Get next sort order
    const lastChild = await prisma.projectLineItem.findFirst({
      where: { parentLineItemId: parent.id, organizationId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    await prisma.projectLineItem.create({
      data: {
        organizationId,
        projectId: parent.projectId,
        type: "EQUIPMENT",
        modelId: accessory.accessoryModelId,
        description: accessory.accessoryModel.name,
        quantity: qty,
        unitPrice,
        pricingType: "PER_DAY",
        duration: 1,
        lineTotal,
        sortOrder: (lastChild?.sortOrder ?? 0) + 1,
        parentLineItemId: parent.id,
        isAccessory: true,
        accessoryLevel: accessory.level as "MANDATORY" | "OPTIONAL",
      },
    });

    projectsToRecalc.add(parent.projectId);
  }

  // Recalculate totals for affected projects
  for (const projectId of projectsToRecalc) {
    await recalculateProjectTotals(projectId);
  }
}

/**
 * When a ModelAccessory is updated (quantity or level), update all existing
 * accessory line items on active projects (unless manually overridden).
 */
async function propagateAccessoryUpdate(
  organizationId: string,
  oldDef: { parentModelId: string; accessoryModelId: string; quantity: number },
  newDef: { quantity: number; level: string },
) {
  // Find all parent line items using the parent model
  const parentLineItems = await findActiveLineItemsForModel(organizationId, oldDef.parentModelId);
  if (parentLineItems.length === 0) return;

  const projectsToRecalc = new Set<string>();

  for (const parent of parentLineItems) {
    // Find the accessory child line item
    const accChild = await prisma.projectLineItem.findFirst({
      where: {
        parentLineItemId: parent.id,
        modelId: oldDef.accessoryModelId,
        isAccessory: true,
        manualOverride: false,
        organizationId,
        status: { not: "CANCELLED" },
      },
    });
    if (!accChild) continue;

    const newQty = parent.quantity * newDef.quantity;
    const unitPrice = accChild.unitPrice ? Number(accChild.unitPrice) : null;
    const lineTotal = unitPrice != null
      ? Math.round(unitPrice * newQty * accChild.duration * 100) / 100
      : null;

    await prisma.projectLineItem.update({
      where: { id: accChild.id },
      data: {
        quantity: newQty,
        lineTotal,
        accessoryLevel: newDef.level as "MANDATORY" | "OPTIONAL" | "RECOMMENDED",
      },
    });

    projectsToRecalc.add(parent.projectId);
  }

  for (const projectId of projectsToRecalc) {
    await recalculateProjectTotals(projectId);
  }
}

/**
 * When a ModelAccessory is removed, delete the corresponding accessory line items
 * from active projects (unless manually overridden).
 */
async function propagateAccessoryRemoval(
  organizationId: string,
  accDef: { parentModelId: string; accessoryModelId: string },
) {
  const parentLineItems = await findActiveLineItemsForModel(organizationId, accDef.parentModelId);
  if (parentLineItems.length === 0) return;

  const projectsToRecalc = new Set<string>();

  for (const parent of parentLineItems) {
    const accChild = await prisma.projectLineItem.findFirst({
      where: {
        parentLineItemId: parent.id,
        modelId: accDef.accessoryModelId,
        isAccessory: true,
        manualOverride: false,
        organizationId,
        status: { not: "CANCELLED" },
      },
    });
    if (!accChild) continue;

    // Also delete any grandchildren (accessories of this accessory)
    await prisma.projectLineItem.deleteMany({
      where: {
        parentLineItemId: accChild.id,
        organizationId,
        isAccessory: true,
      },
    });

    await prisma.projectLineItem.delete({ where: { id: accChild.id } });
    projectsToRecalc.add(parent.projectId);
  }

  for (const projectId of projectsToRecalc) {
    await recalculateProjectTotals(projectId);
  }
}

/**
 * Detect circular references: check if adding accessoryModelId as a child
 * of parentModelId would create a cycle. We walk the accessory tree from
 * accessoryModelId up to 3 levels and see if parentModelId appears.
 */
async function detectCircularReference(
  organizationId: string,
  parentModelId: string,
  accessoryModelId: string,
) {
  const visited = new Set<string>();
  const queue = [accessoryModelId];

  for (let depth = 0; depth < 3 && queue.length > 0; depth++) {
    const currentBatch = [...queue];
    queue.length = 0;

    const children = await prisma.modelAccessory.findMany({
      where: {
        organizationId,
        parentModelId: { in: currentBatch },
      },
      select: { accessoryModelId: true },
    });

    for (const child of children) {
      if (child.accessoryModelId === parentModelId) {
        throw new Error(
          "Cannot add this accessory — it would create a circular reference.",
        );
      }
      if (!visited.has(child.accessoryModelId)) {
        visited.add(child.accessoryModelId);
        queue.push(child.accessoryModelId);
      }
    }
  }
}
