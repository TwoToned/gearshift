-- CreateTable
CREATE TABLE "custom_role" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "permissions" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_role_organizationId_idx" ON "custom_role"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "custom_role_organizationId_name_key" ON "custom_role"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "custom_role" ADD CONSTRAINT "custom_role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
