-- CreateTable
CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "metadata" JSONB,
    "projectId" TEXT,
    "assetId" TEXT,
    "kitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_log_organizationId_createdAt_idx" ON "activity_log"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_log_organizationId_entityType_idx" ON "activity_log"("organizationId", "entityType");

-- CreateIndex
CREATE INDEX "activity_log_organizationId_userId_idx" ON "activity_log"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "activity_log_organizationId_projectId_idx" ON "activity_log"("organizationId", "projectId");

-- CreateIndex
CREATE INDEX "activity_log_organizationId_assetId_idx" ON "activity_log"("organizationId", "assetId");

-- CreateIndex
CREATE INDEX "activity_log_organizationId_entityType_entityId_idx" ON "activity_log"("organizationId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
