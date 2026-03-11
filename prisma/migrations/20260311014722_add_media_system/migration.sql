-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('PHOTO', 'MANUAL', 'SPEC_SHEET', 'WIRING_DIAGRAM', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectMediaType" AS ENUM ('FLOOR_PLAN', 'QUOTE', 'INVOICE', 'SITE_MAP', 'RISK_ASSESSMENT', 'CLIENT_BRIEF', 'CAD', 'CONTRACT', 'PHOTO', 'OTHER');

-- CreateTable
CREATE TABLE "file_upload" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_media" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'PHOTO',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_media" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'PHOTO',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kit_media" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'PHOTO',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kit_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_media" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "type" "ProjectMediaType" NOT NULL DEFAULT 'OTHER',
    "displayName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "file_upload_organizationId_idx" ON "file_upload"("organizationId");

-- CreateIndex
CREATE INDEX "model_media_organizationId_idx" ON "model_media"("organizationId");

-- CreateIndex
CREATE INDEX "model_media_modelId_idx" ON "model_media"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "model_media_modelId_fileId_key" ON "model_media"("modelId", "fileId");

-- CreateIndex
CREATE INDEX "asset_media_organizationId_idx" ON "asset_media"("organizationId");

-- CreateIndex
CREATE INDEX "asset_media_assetId_idx" ON "asset_media"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_media_assetId_fileId_key" ON "asset_media"("assetId", "fileId");

-- CreateIndex
CREATE INDEX "kit_media_organizationId_idx" ON "kit_media"("organizationId");

-- CreateIndex
CREATE INDEX "kit_media_kitId_idx" ON "kit_media"("kitId");

-- CreateIndex
CREATE UNIQUE INDEX "kit_media_kitId_fileId_key" ON "kit_media"("kitId", "fileId");

-- CreateIndex
CREATE INDEX "project_media_organizationId_idx" ON "project_media"("organizationId");

-- CreateIndex
CREATE INDEX "project_media_projectId_idx" ON "project_media"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_media_projectId_fileId_key" ON "project_media"("projectId", "fileId");

-- AddForeignKey
ALTER TABLE "file_upload" ADD CONSTRAINT "file_upload_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_upload" ADD CONSTRAINT "file_upload_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_media" ADD CONSTRAINT "model_media_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_media" ADD CONSTRAINT "model_media_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_media" ADD CONSTRAINT "model_media_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file_upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_media" ADD CONSTRAINT "asset_media_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_media" ADD CONSTRAINT "asset_media_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_media" ADD CONSTRAINT "asset_media_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file_upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_media" ADD CONSTRAINT "kit_media_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_media" ADD CONSTRAINT "kit_media_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "kit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_media" ADD CONSTRAINT "kit_media_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file_upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_media" ADD CONSTRAINT "project_media_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_media" ADD CONSTRAINT "project_media_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_media" ADD CONSTRAINT "project_media_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file_upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
