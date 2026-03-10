-- AlterTable
ALTER TABLE "location" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "location_parentId_idx" ON "location"("parentId");

-- AddForeignKey
ALTER TABLE "location" ADD CONSTRAINT "location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
