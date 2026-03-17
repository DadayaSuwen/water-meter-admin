-- CreateEnum
CREATE TYPE "MeterType" AS ENUM ('NB_IOT', 'LORA', 'ULTRASONIC', 'MECHANICAL');

-- CreateEnum
CREATE TYPE "ValveStatus" AS ENUM ('OPEN', 'CLOSED', 'ERROR');

-- AlterEnum
ALTER TYPE "MeterStatus" ADD VALUE 'OFFLINE';

-- AlterTable
ALTER TABLE "water_meters" ADD COLUMN     "batteryLevel" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "lastCommunicationAt" TIMESTAMP(3),
ADD COLUMN     "meterType" "MeterType" NOT NULL DEFAULT 'NB_IOT',
ADD COLUMN     "valveStatus" "ValveStatus" NOT NULL DEFAULT 'OPEN';
