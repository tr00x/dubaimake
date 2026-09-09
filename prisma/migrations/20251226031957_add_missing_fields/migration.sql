/*
  Warnings:

  - You are about to drop the `Settings` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Car" ADD COLUMN "acceleration" REAL;
ALTER TABLE "Car" ADD COLUMN "bodyType" TEXT;
ALTER TABLE "Car" ADD COLUMN "bodyType_en" TEXT;
ALTER TABLE "Car" ADD COLUMN "bodyType_ru" TEXT;
ALTER TABLE "Car" ADD COLUMN "color" TEXT;
ALTER TABLE "Car" ADD COLUMN "color_en" TEXT;
ALTER TABLE "Car" ADD COLUMN "color_ru" TEXT;
ALTER TABLE "Car" ADD COLUMN "condition_en" TEXT;
ALTER TABLE "Car" ADD COLUMN "condition_ru" TEXT;
ALTER TABLE "Car" ADD COLUMN "description_en" TEXT;
ALTER TABLE "Car" ADD COLUMN "description_ru" TEXT;
ALTER TABLE "Car" ADD COLUMN "driveType" TEXT;
ALTER TABLE "Car" ADD COLUMN "driveType_en" TEXT;
ALTER TABLE "Car" ADD COLUMN "driveType_ru" TEXT;
ALTER TABLE "Car" ADD COLUMN "engineCapacity" TEXT;
ALTER TABLE "Car" ADD COLUMN "fuelType_en" TEXT;
ALTER TABLE "Car" ADD COLUMN "fuelType_ru" TEXT;
ALTER TABLE "Car" ADD COLUMN "tags_en" TEXT;
ALTER TABLE "Car" ADD COLUMN "tags_ru" TEXT;
ALTER TABLE "Car" ADD COLUMN "title_en" TEXT;
ALTER TABLE "Car" ADD COLUMN "title_ru" TEXT;
ALTER TABLE "Car" ADD COLUMN "transmission_en" TEXT;
ALTER TABLE "Car" ADD COLUMN "transmission_ru" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Settings";
PRAGMA foreign_keys=on;
