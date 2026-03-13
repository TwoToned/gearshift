-- CreateEnum
CREATE TYPE "AccessoryLevel" AS ENUM ('MANDATORY', 'OPTIONAL', 'RECOMMENDED');

-- AlterTable
ALTER TABLE "project_line_item" ADD COLUMN     "accessoryLevel" "AccessoryLevel",
ADD COLUMN     "isAccessory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manualOverride" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "model_accessory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentModelId" TEXT NOT NULL,
    "accessoryModelId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "level" "AccessoryLevel" NOT NULL,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "model_accessory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "model_accessory_organizationId_idx" ON "model_accessory"("organizationId");

-- CreateIndex
CREATE INDEX "model_accessory_parentModelId_idx" ON "model_accessory"("parentModelId");

-- CreateIndex
CREATE UNIQUE INDEX "model_accessory_parentModelId_accessoryModelId_key" ON "model_accessory"("parentModelId", "accessoryModelId");

-- AddForeignKey
ALTER TABLE "model_accessory" ADD CONSTRAINT "model_accessory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_accessory" ADD CONSTRAINT "model_accessory_parentModelId_fkey" FOREIGN KEY ("parentModelId") REFERENCES "model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_accessory" ADD CONSTRAINT "model_accessory_accessoryModelId_fkey" FOREIGN KEY ("accessoryModelId") REFERENCES "model"("id") ON DELETE CASCADE ON UPDATE CASCADE;
