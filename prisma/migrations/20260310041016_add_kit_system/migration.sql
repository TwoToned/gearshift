-- CreateEnum
CREATE TYPE "KitStatus" AS ENUM ('AVAILABLE', 'CHECKED_OUT', 'IN_MAINTENANCE', 'RETIRED', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "KitPricingMode" AS ENUM ('KIT_PRICE', 'ITEMIZED');

-- AlterTable
ALTER TABLE "asset" ADD COLUMN     "kitId" TEXT;

-- AlterTable
ALTER TABLE "asset_scan_log" ADD COLUMN     "kitId" TEXT;

-- AlterTable
ALTER TABLE "maintenance_record" ADD COLUMN     "kitId" TEXT,
ALTER COLUMN "assetId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "project_line_item" ADD COLUMN     "isKitChild" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kitId" TEXT,
ADD COLUMN     "parentLineItemId" TEXT,
ADD COLUMN     "pricingMode" "KitPricingMode";

-- CreateTable
CREATE TABLE "kit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "status" "KitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "condition" "AssetCondition" NOT NULL DEFAULT 'NEW',
    "locationId" TEXT,
    "weight" DECIMAL(8,2),
    "caseType" TEXT,
    "caseDimensions" TEXT,
    "image" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "barcode" TEXT,
    "qrCode" TEXT,
    "notes" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchasePrice" DECIMAL(10,2),
    "customFieldValues" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kit_serialized_item" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "position" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedById" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "kit_serialized_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kit_bulk_item" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "bulkAssetId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "position" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedById" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "kit_bulk_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kit_organizationId_idx" ON "kit"("organizationId");

-- CreateIndex
CREATE INDEX "kit_status_idx" ON "kit"("status");

-- CreateIndex
CREATE INDEX "kit_categoryId_idx" ON "kit"("categoryId");

-- CreateIndex
CREATE INDEX "kit_locationId_idx" ON "kit"("locationId");

-- CreateIndex
CREATE INDEX "kit_isActive_idx" ON "kit"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "kit_organizationId_assetTag_key" ON "kit"("organizationId", "assetTag");

-- CreateIndex
CREATE UNIQUE INDEX "kit_serialized_item_assetId_key" ON "kit_serialized_item"("assetId");

-- CreateIndex
CREATE INDEX "kit_serialized_item_kitId_idx" ON "kit_serialized_item"("kitId");

-- CreateIndex
CREATE UNIQUE INDEX "kit_serialized_item_organizationId_assetId_key" ON "kit_serialized_item"("organizationId", "assetId");

-- CreateIndex
CREATE INDEX "kit_bulk_item_kitId_idx" ON "kit_bulk_item"("kitId");

-- CreateIndex
CREATE INDEX "kit_bulk_item_bulkAssetId_idx" ON "kit_bulk_item"("bulkAssetId");

-- CreateIndex
CREATE INDEX "asset_kitId_idx" ON "asset"("kitId");

-- CreateIndex
CREATE INDEX "project_line_item_kitId_idx" ON "project_line_item"("kitId");

-- CreateIndex
CREATE INDEX "project_line_item_parentLineItemId_idx" ON "project_line_item"("parentLineItemId");

-- AddForeignKey
ALTER TABLE "kit" ADD CONSTRAINT "kit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit" ADD CONSTRAINT "kit_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit" ADD CONSTRAINT "kit_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_serialized_item" ADD CONSTRAINT "kit_serialized_item_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_serialized_item" ADD CONSTRAINT "kit_serialized_item_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "kit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_serialized_item" ADD CONSTRAINT "kit_serialized_item_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_serialized_item" ADD CONSTRAINT "kit_serialized_item_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_bulk_item" ADD CONSTRAINT "kit_bulk_item_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_bulk_item" ADD CONSTRAINT "kit_bulk_item_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "kit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_bulk_item" ADD CONSTRAINT "kit_bulk_item_bulkAssetId_fkey" FOREIGN KEY ("bulkAssetId") REFERENCES "bulk_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_bulk_item" ADD CONSTRAINT "kit_bulk_item_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "kit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_record" ADD CONSTRAINT "maintenance_record_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "kit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_line_item" ADD CONSTRAINT "project_line_item_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "kit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_line_item" ADD CONSTRAINT "project_line_item_parentLineItemId_fkey" FOREIGN KEY ("parentLineItemId") REFERENCES "project_line_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_scan_log" ADD CONSTRAINT "asset_scan_log_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "kit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
