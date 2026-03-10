-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('SERIALIZED', 'BULK');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'CHECKED_OUT', 'IN_MAINTENANCE', 'RETIRED', 'LOST', 'RESERVED');

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED');

-- CreateEnum
CREATE TYPE "BulkAssetStatus" AS ENUM ('ACTIVE', 'LOW_STOCK', 'OUT_OF_STOCK', 'RETIRED');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('WAREHOUSE', 'VENUE', 'VEHICLE', 'OFFSITE');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('REPAIR', 'PREVENTATIVE', 'TEST_AND_TAG', 'INSPECTION', 'CLEANING', 'FIRMWARE_UPDATE');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaintenanceResult" AS ENUM ('PASS', 'FAIL', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('COMPANY', 'INDIVIDUAL', 'VENUE', 'PRODUCTION_COMPANY');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ENQUIRY', 'QUOTING', 'QUOTED', 'CONFIRMED', 'PREPPING', 'CHECKED_OUT', 'ON_SITE', 'RETURNED', 'COMPLETED', 'INVOICED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('DRY_HIRE', 'WET_HIRE', 'INSTALLATION', 'TOUR', 'CORPORATE', 'THEATRE', 'FESTIVAL', 'CONFERENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "LineItemType" AS ENUM ('EQUIPMENT', 'SERVICE', 'LABOUR', 'TRANSPORT', 'MISC');

-- CreateEnum
CREATE TYPE "PricingType" AS ENUM ('PER_DAY', 'PER_WEEK', 'FLAT', 'PER_HOUR');

-- CreateEnum
CREATE TYPE "LineItemStatus" AS ENUM ('QUOTED', 'CONFIRMED', 'PREPPED', 'CHECKED_OUT', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnCondition" AS ENUM ('GOOD', 'DAMAGED', 'MISSING');

-- CreateEnum
CREATE TYPE "ScanAction" AS ENUM ('CHECK_OUT', 'CHECK_IN', 'SCAN_VERIFY', 'TRANSFER');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "activeOrganizationId" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" TEXT,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "inviterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "modelNumber" TEXT,
    "categoryId" TEXT,
    "description" TEXT,
    "image" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "manuals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specifications" JSONB,
    "customFields" JSONB,
    "defaultRentalPrice" DECIMAL(10,2),
    "defaultPurchasePrice" DECIMAL(10,2),
    "replacementCost" DECIMAL(10,2),
    "weight" DECIMAL(8,2),
    "powerDraw" INTEGER,
    "testAndTagIntervalDays" INTEGER,
    "maintenanceIntervalDays" INTEGER,
    "assetType" "AssetType" NOT NULL DEFAULT 'SERIALIZED',
    "barcodeLabelTemplate" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "serialNumber" TEXT,
    "customName" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "condition" "AssetCondition" NOT NULL DEFAULT 'NEW',
    "purchaseDate" TIMESTAMP(3),
    "purchasePrice" DECIMAL(10,2),
    "purchaseSupplier" TEXT,
    "warrantyExpiry" TIMESTAMP(3),
    "notes" TEXT,
    "locationId" TEXT,
    "customFieldValues" JSONB,
    "lastTestAndTagDate" TIMESTAMP(3),
    "nextTestAndTagDate" TIMESTAMP(3),
    "barcode" TEXT,
    "qrCode" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_asset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "availableQuantity" INTEGER NOT NULL DEFAULT 0,
    "purchasePricePerUnit" DECIMAL(10,2),
    "locationId" TEXT,
    "status" "BulkAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "reorderThreshold" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "type" "LocationType" NOT NULL DEFAULT 'WAREHOUSE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_record" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reportedById" TEXT,
    "assignedToId" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "cost" DECIMAL(10,2),
    "partsUsed" TEXT,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "result" "MaintenanceResult",
    "nextDueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ClientType" NOT NULL DEFAULT 'COMPANY',
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "billingAddress" TEXT,
    "shippingAddress" TEXT,
    "taxId" TEXT,
    "paymentTerms" TEXT,
    "defaultDiscount" DECIMAL(5,2),
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ENQUIRY',
    "type" "ProjectType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "venue" TEXT,
    "venueContactName" TEXT,
    "venueContactPhone" TEXT,
    "venueContactEmail" TEXT,
    "loadInDate" TIMESTAMP(3),
    "loadInTime" TEXT,
    "eventStartDate" TIMESTAMP(3),
    "eventStartTime" TEXT,
    "eventEndDate" TIMESTAMP(3),
    "eventEndTime" TEXT,
    "loadOutDate" TIMESTAMP(3),
    "loadOutTime" TEXT,
    "rentalStartDate" TIMESTAMP(3),
    "rentalEndDate" TIMESTAMP(3),
    "projectManagerId" TEXT,
    "crewNotes" TEXT,
    "internalNotes" TEXT,
    "clientNotes" TEXT,
    "subtotal" DECIMAL(12,2),
    "discountPercent" DECIMAL(5,2),
    "discountAmount" DECIMAL(12,2),
    "taxAmount" DECIMAL(12,2),
    "total" DECIMAL(12,2),
    "depositRequired" DECIMAL(12,2),
    "depositPaid" DECIMAL(12,2),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_line_item" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "LineItemType" NOT NULL DEFAULT 'EQUIPMENT',
    "modelId" TEXT,
    "assetId" TEXT,
    "bulkAssetId" TEXT,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2),
    "pricingType" "PricingType" NOT NULL DEFAULT 'PER_DAY',
    "duration" INTEGER NOT NULL DEFAULT 1,
    "discount" DECIMAL(10,2),
    "lineTotal" DECIMAL(12,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "groupName" TEXT,
    "notes" TEXT,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "status" "LineItemStatus" NOT NULL DEFAULT 'QUOTED',
    "checkedOutAt" TIMESTAMP(3),
    "checkedOutById" TEXT,
    "returnedAt" TIMESTAMP(3),
    "returnedById" TEXT,
    "returnCondition" "ReturnCondition",
    "returnNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_line_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_scan_log" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT,
    "bulkAssetId" TEXT,
    "projectId" TEXT,
    "action" "ScanAction" NOT NULL,
    "scannedById" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "location" TEXT,

    CONSTRAINT "asset_scan_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "category_organizationId_idx" ON "category"("organizationId");

-- CreateIndex
CREATE INDEX "category_parentId_idx" ON "category"("parentId");

-- CreateIndex
CREATE INDEX "model_organizationId_idx" ON "model"("organizationId");

-- CreateIndex
CREATE INDEX "model_categoryId_idx" ON "model"("categoryId");

-- CreateIndex
CREATE INDEX "model_isActive_idx" ON "model"("isActive");

-- CreateIndex
CREATE INDEX "asset_organizationId_idx" ON "asset"("organizationId");

-- CreateIndex
CREATE INDEX "asset_status_idx" ON "asset"("status");

-- CreateIndex
CREATE INDEX "asset_modelId_idx" ON "asset"("modelId");

-- CreateIndex
CREATE INDEX "asset_locationId_idx" ON "asset"("locationId");

-- CreateIndex
CREATE INDEX "asset_isActive_idx" ON "asset"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "asset_organizationId_assetTag_key" ON "asset"("organizationId", "assetTag");

-- CreateIndex
CREATE INDEX "bulk_asset_organizationId_idx" ON "bulk_asset"("organizationId");

-- CreateIndex
CREATE INDEX "bulk_asset_status_idx" ON "bulk_asset"("status");

-- CreateIndex
CREATE INDEX "bulk_asset_modelId_idx" ON "bulk_asset"("modelId");

-- CreateIndex
CREATE INDEX "bulk_asset_isActive_idx" ON "bulk_asset"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "bulk_asset_organizationId_assetTag_key" ON "bulk_asset"("organizationId", "assetTag");

-- CreateIndex
CREATE INDEX "location_organizationId_idx" ON "location"("organizationId");

-- CreateIndex
CREATE INDEX "maintenance_record_organizationId_idx" ON "maintenance_record"("organizationId");

-- CreateIndex
CREATE INDEX "maintenance_record_assetId_idx" ON "maintenance_record"("assetId");

-- CreateIndex
CREATE INDEX "maintenance_record_status_idx" ON "maintenance_record"("status");

-- CreateIndex
CREATE INDEX "maintenance_record_scheduledDate_idx" ON "maintenance_record"("scheduledDate");

-- CreateIndex
CREATE INDEX "client_organizationId_idx" ON "client"("organizationId");

-- CreateIndex
CREATE INDEX "client_isActive_idx" ON "client"("isActive");

-- CreateIndex
CREATE INDEX "project_organizationId_idx" ON "project"("organizationId");

-- CreateIndex
CREATE INDEX "project_status_idx" ON "project"("status");

-- CreateIndex
CREATE INDEX "project_clientId_idx" ON "project"("clientId");

-- CreateIndex
CREATE INDEX "project_rentalStartDate_rentalEndDate_idx" ON "project"("rentalStartDate", "rentalEndDate");

-- CreateIndex
CREATE UNIQUE INDEX "project_organizationId_projectNumber_key" ON "project"("organizationId", "projectNumber");

-- CreateIndex
CREATE INDEX "project_line_item_organizationId_idx" ON "project_line_item"("organizationId");

-- CreateIndex
CREATE INDEX "project_line_item_projectId_idx" ON "project_line_item"("projectId");

-- CreateIndex
CREATE INDEX "project_line_item_modelId_idx" ON "project_line_item"("modelId");

-- CreateIndex
CREATE INDEX "project_line_item_assetId_idx" ON "project_line_item"("assetId");

-- CreateIndex
CREATE INDEX "project_line_item_bulkAssetId_idx" ON "project_line_item"("bulkAssetId");

-- CreateIndex
CREATE INDEX "asset_scan_log_organizationId_idx" ON "asset_scan_log"("organizationId");

-- CreateIndex
CREATE INDEX "asset_scan_log_assetId_idx" ON "asset_scan_log"("assetId");

-- CreateIndex
CREATE INDEX "asset_scan_log_bulkAssetId_idx" ON "asset_scan_log"("bulkAssetId");

-- CreateIndex
CREATE INDEX "asset_scan_log_projectId_idx" ON "asset_scan_log"("projectId");

-- CreateIndex
CREATE INDEX "asset_scan_log_scannedAt_idx" ON "asset_scan_log"("scannedAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model" ADD CONSTRAINT "model_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model" ADD CONSTRAINT "model_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_asset" ADD CONSTRAINT "bulk_asset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_asset" ADD CONSTRAINT "bulk_asset_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_asset" ADD CONSTRAINT "bulk_asset_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location" ADD CONSTRAINT "location_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_record" ADD CONSTRAINT "maintenance_record_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_record" ADD CONSTRAINT "maintenance_record_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_record" ADD CONSTRAINT "maintenance_record_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_record" ADD CONSTRAINT "maintenance_record_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_projectManagerId_fkey" FOREIGN KEY ("projectManagerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_line_item" ADD CONSTRAINT "project_line_item_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_line_item" ADD CONSTRAINT "project_line_item_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_line_item" ADD CONSTRAINT "project_line_item_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "model"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_line_item" ADD CONSTRAINT "project_line_item_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_line_item" ADD CONSTRAINT "project_line_item_bulkAssetId_fkey" FOREIGN KEY ("bulkAssetId") REFERENCES "bulk_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_line_item" ADD CONSTRAINT "project_line_item_checkedOutById_fkey" FOREIGN KEY ("checkedOutById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_line_item" ADD CONSTRAINT "project_line_item_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_scan_log" ADD CONSTRAINT "asset_scan_log_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_scan_log" ADD CONSTRAINT "asset_scan_log_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_scan_log" ADD CONSTRAINT "asset_scan_log_bulkAssetId_fkey" FOREIGN KEY ("bulkAssetId") REFERENCES "bulk_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_scan_log" ADD CONSTRAINT "asset_scan_log_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_scan_log" ADD CONSTRAINT "asset_scan_log_scannedById_fkey" FOREIGN KEY ("scannedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
