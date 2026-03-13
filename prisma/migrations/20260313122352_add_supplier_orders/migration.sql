-- CreateEnum
CREATE TYPE "SupplierOrderType" AS ENUM ('PURCHASE', 'SUBHIRE', 'REPAIR', 'LABOUR', 'OTHER');

-- CreateEnum
CREATE TYPE "SupplierOrderStatus" AS ENUM ('DRAFT', 'ORDERED', 'PARTIAL', 'RECEIVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "asset" ADD COLUMN     "purchaseOrderNumber" TEXT,
ADD COLUMN     "supplierOrderId" TEXT;

-- AlterTable
ALTER TABLE "project_line_item" ADD COLUMN     "subhireOrderNumber" TEXT,
ADD COLUMN     "supplierOrderId" TEXT;

-- AlterTable
ALTER TABLE "supplier" ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "defaultLeadTime" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "supplier_order" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "type" "SupplierOrderType" NOT NULL,
    "status" "SupplierOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderDate" TIMESTAMP(3),
    "expectedDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "subtotal" DECIMAL(10,2),
    "taxAmount" DECIMAL(10,2),
    "total" DECIMAL(10,2),
    "projectId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_order_item" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2),
    "lineTotal" DECIMAL(10,2),
    "modelId" TEXT,
    "assetId" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "supplier_order_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_order_organizationId_idx" ON "supplier_order"("organizationId");

-- CreateIndex
CREATE INDEX "supplier_order_organizationId_supplierId_idx" ON "supplier_order"("organizationId", "supplierId");

-- CreateIndex
CREATE INDEX "supplier_order_organizationId_orderNumber_idx" ON "supplier_order"("organizationId", "orderNumber");

-- CreateIndex
CREATE INDEX "supplier_order_item_orderId_idx" ON "supplier_order_item"("orderId");

-- CreateIndex
CREATE INDEX "asset_supplierOrderId_idx" ON "asset"("supplierOrderId");

-- CreateIndex
CREATE INDEX "project_line_item_supplierOrderId_idx" ON "project_line_item"("supplierOrderId");

-- AddForeignKey
ALTER TABLE "supplier_order" ADD CONSTRAINT "supplier_order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_order" ADD CONSTRAINT "supplier_order_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_order" ADD CONSTRAINT "supplier_order_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_order" ADD CONSTRAINT "supplier_order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_order_item" ADD CONSTRAINT "supplier_order_item_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "supplier_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_order_item" ADD CONSTRAINT "supplier_order_item_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "model"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_order_item" ADD CONSTRAINT "supplier_order_item_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "supplier_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_line_item" ADD CONSTRAINT "project_line_item_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "supplier_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
