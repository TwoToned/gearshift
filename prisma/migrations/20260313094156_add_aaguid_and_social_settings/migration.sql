-- AlterTable
ALTER TABLE "passkey" ADD COLUMN     "aaguid" TEXT;

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "socialLoginGoogle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "socialLoginMicrosoft" BOOLEAN NOT NULL DEFAULT false;
