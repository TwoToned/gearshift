-- CreateEnum
CREATE TYPE "TestTagStatus" AS ENUM ('NOT_YET_TESTED', 'CURRENT', 'DUE_SOON', 'OVERDUE', 'FAILED', 'RETIRED');

-- CreateEnum
CREATE TYPE "EquipmentClass" AS ENUM ('CLASS_I', 'CLASS_II', 'CLASS_II_DOUBLE_INSULATED');

-- CreateEnum
CREATE TYPE "ApplianceType" AS ENUM ('APPLIANCE', 'CORD_SET', 'EXTENSION_LEAD', 'POWER_BOARD', 'RCD_PORTABLE', 'RCD_FIXED', 'THREE_PHASE', 'OTHER');

-- CreateEnum
CREATE TYPE "TestResult" AS ENUM ('PASS', 'FAIL', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "TestMethod" AS ENUM ('INSULATION_RESISTANCE', 'LEAKAGE_CURRENT', 'BOTH');

-- CreateEnum
CREATE TYPE "FailureAction" AS ENUM ('NONE', 'REPAIRED', 'REMOVED_FROM_SERVICE', 'DISPOSED', 'REFERRED_TO_ELECTRICIAN');

-- CreateTable
CREATE TABLE "test_tag_asset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "testTagId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "equipmentClass" "EquipmentClass" NOT NULL DEFAULT 'CLASS_I',
    "applianceType" "ApplianceType" NOT NULL DEFAULT 'APPLIANCE',
    "make" TEXT,
    "modelName" TEXT,
    "serialNumber" TEXT,
    "location" TEXT,
    "testIntervalMonths" INTEGER NOT NULL DEFAULT 3,
    "status" "TestTagStatus" NOT NULL DEFAULT 'NOT_YET_TESTED',
    "lastTestDate" TIMESTAMP(3),
    "nextDueDate" TIMESTAMP(3),
    "notes" TEXT,
    "assetId" TEXT,
    "bulkAssetId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_tag_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_tag_record" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "testTagAssetId" TEXT NOT NULL,
    "testDate" TIMESTAMP(3) NOT NULL,
    "testedById" TEXT NOT NULL,
    "testerName" TEXT NOT NULL,
    "result" "TestResult" NOT NULL DEFAULT 'PASS',
    "visualInspectionResult" "TestResult" NOT NULL DEFAULT 'PASS',
    "visualCordCondition" BOOLEAN,
    "visualPlugCondition" BOOLEAN,
    "visualHousingCondition" BOOLEAN,
    "visualSwitchCondition" BOOLEAN,
    "visualVentsUnobstructed" BOOLEAN,
    "visualCordGrip" BOOLEAN,
    "visualEarthPin" BOOLEAN,
    "visualMarkingsLegible" BOOLEAN,
    "visualNoModifications" BOOLEAN,
    "visualNotes" TEXT,
    "equipmentClassTested" "EquipmentClass" NOT NULL DEFAULT 'CLASS_I',
    "testMethod" "TestMethod" NOT NULL DEFAULT 'INSULATION_RESISTANCE',
    "earthContinuityResult" "TestResult" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "earthContinuityReading" DOUBLE PRECISION,
    "insulationResult" "TestResult" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "insulationReading" DOUBLE PRECISION,
    "insulationTestVoltage" INTEGER,
    "leakageCurrentResult" "TestResult" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "leakageCurrentReading" DOUBLE PRECISION,
    "polarityResult" "TestResult" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "rcdTripTimeResult" "TestResult" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "rcdTripTimeReading" DOUBLE PRECISION,
    "functionalTestResult" "TestResult" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "functionalTestNotes" TEXT,
    "failureAction" "FailureAction" NOT NULL DEFAULT 'NONE',
    "failureNotes" TEXT,
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_tag_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "test_tag_asset_assetId_key" ON "test_tag_asset"("assetId");

-- CreateIndex
CREATE INDEX "test_tag_asset_organizationId_status_idx" ON "test_tag_asset"("organizationId", "status");

-- CreateIndex
CREATE INDEX "test_tag_asset_organizationId_nextDueDate_idx" ON "test_tag_asset"("organizationId", "nextDueDate");

-- CreateIndex
CREATE INDEX "test_tag_asset_organizationId_assetId_idx" ON "test_tag_asset"("organizationId", "assetId");

-- CreateIndex
CREATE INDEX "test_tag_asset_organizationId_bulkAssetId_idx" ON "test_tag_asset"("organizationId", "bulkAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "test_tag_asset_organizationId_testTagId_key" ON "test_tag_asset"("organizationId", "testTagId");

-- CreateIndex
CREATE INDEX "test_tag_record_organizationId_testTagAssetId_idx" ON "test_tag_record"("organizationId", "testTagAssetId");

-- CreateIndex
CREATE INDEX "test_tag_record_organizationId_testDate_idx" ON "test_tag_record"("organizationId", "testDate");

-- AddForeignKey
ALTER TABLE "test_tag_asset" ADD CONSTRAINT "test_tag_asset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_tag_asset" ADD CONSTRAINT "test_tag_asset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_tag_asset" ADD CONSTRAINT "test_tag_asset_bulkAssetId_fkey" FOREIGN KEY ("bulkAssetId") REFERENCES "bulk_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_tag_record" ADD CONSTRAINT "test_tag_record_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_tag_record" ADD CONSTRAINT "test_tag_record_testTagAssetId_fkey" FOREIGN KEY ("testTagAssetId") REFERENCES "test_tag_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_tag_record" ADD CONSTRAINT "test_tag_record_testedById_fkey" FOREIGN KEY ("testedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
