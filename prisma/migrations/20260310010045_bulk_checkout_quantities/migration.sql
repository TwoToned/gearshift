-- AlterTable
ALTER TABLE "project_line_item" ADD COLUMN     "checkedOutQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "returnedQuantity" INTEGER NOT NULL DEFAULT 0;
