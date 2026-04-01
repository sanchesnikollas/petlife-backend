import { PrismaClient } from '@prisma/client';
import { beforeEach, afterAll } from 'vitest';

const prisma = new PrismaClient();

beforeEach(async () => {
  await prisma.attachment.deleteMany();
  await prisma.record.deleteMany();
  await prisma.mealLog.deleteMany();
  await prisma.weightEntry.deleteMany();
  await prisma.consultation.deleteMany();
  await prisma.medication.deleteMany();
  await prisma.deworming.deleteMany();
  await prisma.vaccine.deleteMany();
  await prisma.petRoutine.deleteMany();
  await prisma.foodConfig.deleteMany();
  await prisma.reminderConfig.deleteMany();
  await prisma.veterinarian.deleteMany();
  await prisma.pet.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
