import { prisma } from "@/lib/prisma";

/**
 * Computes which line items on a project are overbooked.
 * Returns a Set of line item IDs that are overbooked.
 * Batches all DB queries for efficiency.
 */
export async function computeOverbookedStatus(
  organizationId: string,
  lineItems: Array<{
    id: string;
    modelId: string | null;
    quantity: number;
    isKitChild: boolean;
    status: string;
  }>,
  rentalStartDate: Date | null,
  rentalEndDate: Date | null,
  projectId: string,
): Promise<Set<string>> {
  const overbookedIds = new Set<string>();

  if (!rentalStartDate || !rentalEndDate) return overbookedIds;

  // Collect equipment line items with a modelId (non-kit-child, non-cancelled)
  const relevantItems = lineItems.filter(
    (li) => li.modelId && !li.isKitChild && li.status !== "CANCELLED",
  );
  if (relevantItems.length === 0) return overbookedIds;

  const modelIds = [...new Set(relevantItems.map((li) => li.modelId!))];

  // Batch query: all overlapping bookings for these models across all projects
  const overlappingBookings = await prisma.projectLineItem.findMany({
    where: {
      organizationId,
      modelId: { in: modelIds },
      status: { not: "CANCELLED" },
      isKitChild: false,
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
      // Mark all line items of this model on this project as overbooked
      for (const li of relevantItems) {
        if (li.modelId === modelId) {
          overbookedIds.add(li.id);
        }
      }
    }
  }

  return overbookedIds;
}
