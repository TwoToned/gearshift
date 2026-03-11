-- AlterTable
ALTER TABLE "project_line_item" ADD COLUMN     "supplierId" TEXT;

-- CreateIndex
CREATE INDEX "project_line_item_supplierId_idx" ON "project_line_item"("supplierId");

-- AddForeignKey
ALTER TABLE "project_line_item" ADD CONSTRAINT "project_line_item_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
