-- AlterTable
ALTER TABLE "pets" ADD COLUMN     "neutered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "neuteredDate" TIMESTAMP(3);
