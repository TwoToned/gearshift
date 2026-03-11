-- CreateTable
CREATE TABLE "client_media" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'DOCUMENT',
    "displayName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_media_organizationId_idx" ON "client_media"("organizationId");

-- CreateIndex
CREATE INDEX "client_media_clientId_idx" ON "client_media"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_media_clientId_fileId_key" ON "client_media"("clientId", "fileId");

-- AddForeignKey
ALTER TABLE "client_media" ADD CONSTRAINT "client_media_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_media" ADD CONSTRAINT "client_media_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_media" ADD CONSTRAINT "client_media_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file_upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
