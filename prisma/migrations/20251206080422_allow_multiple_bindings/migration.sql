-- CreateEnum
CREATE TYPE "Role" AS ENUM ('RESIDENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "MeterStatus" AS ENUM ('NORMAL', 'FAULTY');

-- CreateEnum
CREATE TYPE "BindingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "openid" TEXT NOT NULL,
    "username" TEXT,
    "phone" TEXT,
    "avatar" TEXT,
    "role" "Role" NOT NULL DEFAULT 'RESIDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "water_meters" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "lastReading" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "MeterStatus" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "water_meters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meter_bindings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "status" "BindingStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "reviewedBy" TEXT,
    "reviewRemark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meter_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "cost" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_tickets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "images" JSONB,
    "status" "TicketStatus" NOT NULL DEFAULT 'PENDING',
    "remark" TEXT,
    "handledBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_openid_key" ON "users"("openid");

-- CreateIndex
CREATE UNIQUE INDEX "water_meters_serialNumber_key" ON "water_meters"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "usage_records_meterId_period_key" ON "usage_records"("meterId", "period");

-- AddForeignKey
ALTER TABLE "meter_bindings" ADD CONSTRAINT "meter_bindings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_bindings" ADD CONSTRAINT "meter_bindings_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "water_meters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "water_meters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_tickets" ADD CONSTRAINT "repair_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_tickets" ADD CONSTRAINT "repair_tickets_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "water_meters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
