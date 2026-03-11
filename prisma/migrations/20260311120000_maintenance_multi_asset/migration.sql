-- CreateTable
CREATE TABLE "maintenance_record_asset" (
    "id" TEXT NOT NULL,
    "maintenanceRecordId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "maintenance_record_asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maintenance_record_asset_assetId_idx" ON "maintenance_record_asset"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_record_asset_maintenanceRecordId_assetId_key" ON "maintenance_record_asset"("maintenanceRecordId", "assetId");

-- Migrate existing data: copy assetId links into the join table
INSERT INTO "maintenance_record_asset" ("id", "maintenanceRecordId", "assetId")
SELECT gen_random_uuid(), "id", "assetId"
FROM "maintenance_record"
WHERE "assetId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "maintenance_record" DROP CONSTRAINT IF EXISTS "maintenance_record_assetId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "maintenance_record_assetId_idx";

-- AlterTable
ALTER TABLE "maintenance_record" DROP COLUMN "assetId";

-- AddForeignKey
ALTER TABLE "maintenance_record_asset" ADD CONSTRAINT "maintenance_record_asset_maintenanceRecordId_fkey" FOREIGN KEY ("maintenanceRecordId") REFERENCES "maintenance_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_record_asset" ADD CONSTRAINT "maintenance_record_asset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
