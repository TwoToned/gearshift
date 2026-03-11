-- CreateTable
CREATE TABLE "location_media" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'DOCUMENT',
    "displayName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "location_media_organizationId_idx" ON "location_media"("organizationId");

-- CreateIndex
CREATE INDEX "location_media_locationId_idx" ON "location_media"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "location_media_locationId_fileId_key" ON "location_media"("locationId", "fileId");

-- AddForeignKey
ALTER TABLE "location_media" ADD CONSTRAINT "location_media_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_media" ADD CONSTRAINT "location_media_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_media" ADD CONSTRAINT "location_media_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file_upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
