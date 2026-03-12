-- AlterTable
ALTER TABLE "project" ADD COLUMN     "isTemplate" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "project_isTemplate_idx" ON "project"("isTemplate");
