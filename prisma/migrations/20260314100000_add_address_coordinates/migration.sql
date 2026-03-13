-- AlterTable: Add coordinate fields to location
ALTER TABLE "location" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "location" ADD COLUMN "longitude" DOUBLE PRECISION;

-- AlterTable: Add coordinate fields to client (billing + shipping)
ALTER TABLE "client" ADD COLUMN "billingLatitude" DOUBLE PRECISION;
ALTER TABLE "client" ADD COLUMN "billingLongitude" DOUBLE PRECISION;
ALTER TABLE "client" ADD COLUMN "shippingLatitude" DOUBLE PRECISION;
ALTER TABLE "client" ADD COLUMN "shippingLongitude" DOUBLE PRECISION;

-- AlterTable: Add coordinate fields to supplier
ALTER TABLE "supplier" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "supplier" ADD COLUMN "longitude" DOUBLE PRECISION;
