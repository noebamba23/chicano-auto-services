-- CreateEnum
CREATE TYPE "WorkOrderPriority" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "WorkOrderItemType" AS ENUM ('LABOR', 'PART', 'SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkOrderItemStatus" AS ENUM ('PENDING', 'DONE');

-- CreateEnum
CREATE TYPE "WorkOrderPartStatus" AS ENUM ('REQUESTED', 'AVAILABLE', 'ORDERED', 'RECEIVED', 'INSTALLED', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "WorkOrderPhotoPhase" AS ENUM ('BEFORE', 'AFTER');

-- AlterEnum
BEGIN;
CREATE TYPE "WorkOrderStatus_new" AS ENUM ('DRAFT', 'READY', 'SCHEDULED', 'IN_PROGRESS', 'WAITING_PARTS', 'QUALITY_CHECK', 'COMPLETED', 'CANCELLED', 'ON_HOLD');
ALTER TABLE "public"."WorkOrder" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "WorkOrder" ALTER COLUMN "status" TYPE "WorkOrderStatus_new" USING ("status"::text::"WorkOrderStatus_new");
ALTER TYPE "WorkOrderStatus" RENAME TO "WorkOrderStatus_old";
ALTER TYPE "WorkOrderStatus_new" RENAME TO "WorkOrderStatus";
DROP TYPE "public"."WorkOrderStatus_old";
ALTER TABLE "WorkOrder" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- DropForeignKey
ALTER TABLE "WorkOrderTask" DROP CONSTRAINT "WorkOrderTask_workOrderId_fkey";

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "acceptedQuoteVersionNumber" INTEGER NOT NULL,
ADD COLUMN     "additionalWorkNotes" TEXT,
ADD COLUMN     "additionalWorkRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "appointmentId" TEXT,
ADD COLUMN     "customerId" TEXT NOT NULL,
ADD COLUMN     "diagnosticReportId" TEXT,
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "priority" "WorkOrderPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "qualityCheckNotes" TEXT,
ADD COLUMN     "qualityCheckPassed" BOOLEAN,
ADD COLUMN     "qualityCheckedAt" TIMESTAMP(3),
ADD COLUMN     "qualityCheckedById" TEXT,
ADD COLUMN     "requiresTowing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scheduledDate" TIMESTAMP(3),
ADD COLUMN     "sequenceNumber" SERIAL NOT NULL,
ADD COLUMN     "serviceRequestId" TEXT NOT NULL,
ADD COLUMN     "technicianId" TEXT,
ADD COLUMN     "testDriveNotes" TEXT,
ADD COLUMN     "testDrivePerformed" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- DropTable
DROP TABLE "WorkOrderTask";

-- DropEnum
DROP TYPE "WorkOrderTaskStatus";

-- CreateTable
CREATE TABLE "WorkOrderItem" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "type" "WorkOrderItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit" TEXT,
    "unitPrice" DECIMAL(12,2),
    "totalPrice" DECIMAL(12,2),
    "sourceQuoteItemId" TEXT,
    "status" "WorkOrderItemStatus" NOT NULL DEFAULT 'PENDING',
    "estimatedMinutes" INTEGER,
    "actualMinutes" INTEGER,
    "technicianId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderPart" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "partId" TEXT,
    "label" TEXT NOT NULL,
    "reference" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "WorkOrderPartStatus" NOT NULL DEFAULT 'REQUESTED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrderPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderPhoto" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "phase" "WorkOrderPhotoPhase" NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkOrderItem_workOrderId_idx" ON "WorkOrderItem"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderPart_workOrderId_idx" ON "WorkOrderPart"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderPhoto_workOrderId_idx" ON "WorkOrderPhoto"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_sequenceNumber_key" ON "WorkOrder"("sequenceNumber");

-- CreateIndex
CREATE INDEX "WorkOrder_customerId_idx" ON "WorkOrder"("customerId");

-- CreateIndex
CREATE INDEX "WorkOrder_vehicleId_idx" ON "WorkOrder"("vehicleId");

-- CreateIndex
CREATE INDEX "WorkOrder_serviceRequestId_idx" ON "WorkOrder"("serviceRequestId");

-- CreateIndex
CREATE INDEX "WorkOrder_appointmentId_idx" ON "WorkOrder"("appointmentId");

-- CreateIndex
CREATE INDEX "WorkOrder_technicianId_idx" ON "WorkOrder"("technicianId");

-- CreateIndex
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");

-- CreateIndex
CREATE INDEX "WorkOrder_createdAt_idx" ON "WorkOrder"("createdAt");

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_diagnosticReportId_fkey" FOREIGN KEY ("diagnosticReportId") REFERENCES "DiagnosticReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderItem" ADD CONSTRAINT "WorkOrderItem_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderItem" ADD CONSTRAINT "WorkOrderItem_sourceQuoteItemId_fkey" FOREIGN KEY ("sourceQuoteItemId") REFERENCES "QuoteItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderItem" ADD CONSTRAINT "WorkOrderItem_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderPart" ADD CONSTRAINT "WorkOrderPart_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderPart" ADD CONSTRAINT "WorkOrderPart_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderPhoto" ADD CONSTRAINT "WorkOrderPhoto_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
