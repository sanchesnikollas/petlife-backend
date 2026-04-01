-- AlterTable
ALTER TABLE "pets" ADD COLUMN     "activityLevel" TEXT,
ADD COLUMN     "healthPlan" TEXT,
ADD COLUMN     "healthPlanNumber" TEXT;

-- CreateTable
CREATE TABLE "veterinarians" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clinic" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "specialty" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "veterinarians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_routines" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "walksPerDay" INTEGER,
    "walkDuration" INTEGER,
    "daycare" BOOLEAN NOT NULL DEFAULT false,
    "daycareName" TEXT,
    "daycarePhone" TEXT,
    "bathFrequency" TEXT,
    "bathLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pet_routines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "veterinarians_userId_idx" ON "veterinarians"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "pet_routines_petId_key" ON "pet_routines"("petId");

-- AddForeignKey
ALTER TABLE "veterinarians" ADD CONSTRAINT "veterinarians_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_routines" ADD CONSTRAINT "pet_routines_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
