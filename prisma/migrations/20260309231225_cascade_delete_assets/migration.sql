-- DropForeignKey
ALTER TABLE "maintenance_record" DROP CONSTRAINT "maintenance_record_assetId_fkey";

-- AddForeignKey
ALTER TABLE "maintenance_record" ADD CONSTRAINT "maintenance_record_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
