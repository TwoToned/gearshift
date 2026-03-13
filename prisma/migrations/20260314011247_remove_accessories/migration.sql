-- DropForeignKey
ALTER TABLE "model_accessory" DROP CONSTRAINT "model_accessory_organizationId_fkey";
ALTER TABLE "model_accessory" DROP CONSTRAINT "model_accessory_parentModelId_fkey";
ALTER TABLE "model_accessory" DROP CONSTRAINT "model_accessory_accessoryModelId_fkey";

-- DropTable
DROP TABLE "model_accessory";

-- AlterTable
ALTER TABLE "project_line_item" DROP COLUMN "isAccessory";
ALTER TABLE "project_line_item" DROP COLUMN "accessoryLevel";
ALTER TABLE "project_line_item" DROP COLUMN "manualOverride";

-- DropEnum
DROP TYPE "AccessoryLevel";
