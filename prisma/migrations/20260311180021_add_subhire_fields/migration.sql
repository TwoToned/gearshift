-- AlterTable
ALTER TABLE "project_line_item" ADD COLUMN     "isSubhire" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showSubhireOnDocs" BOOLEAN NOT NULL DEFAULT false;
