-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationEvent" ADD VALUE 'REQUEST_ACCEPTED';
ALTER TYPE "NotificationEvent" ADD VALUE 'REQUEST_REJECTED';
ALTER TYPE "NotificationEvent" ADD VALUE 'RESCHEDULE_REQUESTED';
ALTER TYPE "NotificationEvent" ADD VALUE 'APPOINTMENT_CONFIRMED';
ALTER TYPE "NotificationEvent" ADD VALUE 'APPOINTMENT_CANCELLED';

-- AlterEnum
BEGIN;
CREATE TYPE "ServiceRequestStatus_new" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'RESCHEDULE_REQUESTED', 'CANCELLED', 'COMPLETED');
ALTER TABLE "public"."ServiceRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ServiceRequest" ALTER COLUMN "status" TYPE "ServiceRequestStatus_new" USING ("status"::text::"ServiceRequestStatus_new");
ALTER TYPE "ServiceRequestStatus" RENAME TO "ServiceRequestStatus_old";
ALTER TYPE "ServiceRequestStatus_new" RENAME TO "ServiceRequestStatus";
DROP TYPE "public"."ServiceRequestStatus_old";
ALTER TABLE "ServiceRequest" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';
COMMIT;

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "preferredDate" TIMESTAMP(3),
ADD COLUMN     "preferredSlot" TEXT,
ADD COLUMN     "referenceNumber" TEXT NOT NULL,
ADD COLUMN     "sequenceNumber" SERIAL NOT NULL,
ADD COLUMN     "urgencyDescription" TEXT,
ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_sequenceNumber_key" ON "ServiceRequest"("sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_referenceNumber_key" ON "ServiceRequest"("referenceNumber");

-- CreateIndex
CREATE INDEX "ServiceRequest_vehicleId_idx" ON "ServiceRequest"("vehicleId");

-- CreateIndex
CREATE INDEX "ServiceRequest_createdAt_idx" ON "ServiceRequest"("createdAt");

