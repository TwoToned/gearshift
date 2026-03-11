import { prisma } from "@/lib/prisma";

export interface OverbookedInfo {
  /** How many units over capacity */
  overBy: number;
  /** Total stock for this model */
  totalStock: number;
  /** Total booked across all overlapping projects */
  totalBooked: number;
  /** True when a kit parent is overbooked only because its children are */
  inherited?: boolean;
}

/**
 * Computes which line items on a project are overbooked.
 * Returns a Map of line item ID → overbooking details.
 * Batches all DB queries for efficiency.
 *
 * Kit children count toward model availability — if a kit contains 3 mics
 * and 2 more are added individually, all 5 count against the model's stock.
 */
export async function computeOverbookedStatus(
  organizationId: string,
  lineItems: Array<{
    id: string;
    modelId: string | null;
    quantity: number;
    isKitChild: boolean;
    parentLineItemId: string | null;
    kitId: string | null;
    status: string;
  }>,
  rentalStartDate: Date | null,
  rentalEndDate: Date | null,
  projectId: string,
): Promise<Map<string, OverbookedInfo>> {
  const overbookedMap = new Map<string, OverbookedInfo>();

  if (!rentalStartDate || !rentalEndDate) return overbookedMap;

  // Collect ALL equipment line items with a modelId (including kit children)
  const relevantItems = lineItems.filter(
    (li) => li.modelId && li.status !== "CANCELLED",
  );
  if (relevantItems.length === 0) return overbookedMap;

  const modelIds = [...new Set(relevantItems.map((li) => li.modelId!))];

  // Batch query: all overlapping bookings for these models across all projects
  // Include BOTH regular items AND kit children — they all consume stock
  const overlappingBookings = await prisma.projectLineItem.findMany({
    where: {
      organizationId,
      modelId: { in: modelIds },
      status: { not: "CANCELLED" },
      project: {
        status: {
          notIn: ["CANCELLED", "RETURNED", "COMPLETED", "INVOICED"],
        },
        rentalStartDate: { lte: rentalEndDate },
        rentalEndDate: { gte: rentalStartDate },
      },
    },
    select: { modelId: true, quantity: true, projectId: true },
  });

  // Sum booked per model (total across all projects)
  const totalBookedByModel = new Map<string, number>();
  const thisProjectBookedByModel = new Map<string, number>();
  for (const booking of overlappingBookings) {
    const mid = booking.modelId!;
    totalBookedByModel.set(mid, (totalBookedByModel.get(mid) || 0) + booking.quantity);
    if (booking.projectId === projectId) {
      thisProjectBookedByModel.set(mid, (thisProjectBookedByModel.get(mid) || 0) + booking.quantity);
    }
  }

  // Batch query: total stock per model
  const models = await prisma.model.findMany({
    where: { id: { in: modelIds }, organizationId },
    include: {
      assets: { where: { isActive: true }, select: { id: true } },
      bulkAssets: { where: { isActive: true }, select: { totalQuantity: true } },
    },
  });

  const stockByModel = new Map<string, number>();
  for (const model of models) {
    const stock =
      model.assetType === "SERIALIZED"
        ? model.assets.length
        : model.bulkAssets.reduce((sum, ba) => sum + ba.totalQuantity, 0);
    stockByModel.set(model.id, stock);
  }

  // For each model, check if this project's total booking exceeds available
  for (const modelId of modelIds) {
    const totalStock = stockByModel.get(modelId) || 0;
    const totalBooked = totalBookedByModel.get(modelId) || 0;
    const bookedByOthers = totalBooked - (thisProjectBookedByModel.get(modelId) || 0);
    const availableForProject = totalStock - bookedByOthers;
    const bookedByThisProject = thisProjectBookedByModel.get(modelId) || 0;

    if (bookedByThisProject > availableForProject) {
      const overBy = bookedByThisProject - availableForProject;
      const info: OverbookedInfo = { overBy, totalStock, totalBooked };
      // Mark all line items of this model on this project as overbooked
      for (const li of relevantItems) {
        if (li.modelId === modelId) {
          overbookedMap.set(li.id, info);
        }
      }
    }
  }

  // Also mark kit parent items as overbooked if any of their children are
  for (const li of lineItems) {
    if (li.kitId && !li.isKitChild) {
      const children = lineItems.filter((c) => c.parentLineItemId === li.id);
      const overbookedChildren = children.filter((c) => overbookedMap.has(c.id));
      if (overbookedChildren.length > 0) {
        // Aggregate: sum up the overBy from distinct models
        const seen = new Set<string>();
        let totalOver = 0;
        let totalStock = 0;
        let totalBooked = 0;
        for (const c of overbookedChildren) {
          const info = overbookedMap.get(c.id)!;
          const mid = c.modelId!;
          if (!seen.has(mid)) {
            seen.add(mid);
            totalOver += info.overBy;
            totalStock += info.totalStock;
            totalBooked += info.totalBooked;
          }
        }
        overbookedMap.set(li.id, { overBy: totalOver, totalStock, totalBooked, inherited: true });
      }
    }
  }

  return overbookedMap;
}
