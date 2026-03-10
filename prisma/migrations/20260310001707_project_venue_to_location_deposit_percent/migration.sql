/*
  Warnings:

  - You are about to drop the column `depositRequired` on the `project` table. All the data in the column will be lost.
  - You are about to drop the column `venue` on the `project` table. All the data in the column will be lost.
  - You are about to drop the column `venueContactEmail` on the `project` table. All the data in the column will be lost.
  - You are about to drop the column `venueContactName` on the `project` table. All the data in the column will be lost.
  - You are about to drop the column `venueContactPhone` on the `project` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "project" DROP COLUMN "depositRequired",
DROP COLUMN "venue",
DROP COLUMN "venueContactEmail",
DROP COLUMN "venueContactName",
DROP COLUMN "venueContactPhone",
ADD COLUMN     "depositPercent" DECIMAL(5,2),
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "siteContactEmail" TEXT,
ADD COLUMN     "siteContactName" TEXT,
ADD COLUMN     "siteContactPhone" TEXT;

-- CreateIndex
CREATE INDEX "project_locationId_idx" ON "project"("locationId");

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
