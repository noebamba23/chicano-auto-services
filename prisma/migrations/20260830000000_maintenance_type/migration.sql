-- CreateEnum
CREATE TYPE "MaintenanceReminderLevel" AS ENUM ('UPCOMING', 'DUE', 'OVERDUE');

-- AlterTable (add columns referencing the OLD enum first — safe, nullable, no data)
ALTER TABLE "WorkOrderItem" ADD COLUMN     "maintenanceType" "MaintenanceType";

ALTER TABLE "MaintenancePlan" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "priority" "WorkOrderPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "MaintenanceReminder" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completedByWorkOrderId" TEXT,
ADD COLUMN     "lastNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "lastNotifiedLevel" "MaintenanceReminderLevel",
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "priority" "WorkOrderPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "MaintenancePlan_vehicleId_idx" ON "MaintenancePlan"("vehicleId");

-- CreateIndex
CREATE INDEX "MaintenanceReminder_vehicleId_idx" ON "MaintenanceReminder"("vehicleId");

-- CreateIndex
CREATE INDEX "MaintenanceReminder_status_idx" ON "MaintenanceReminder"("status");

-- AlterEnum (now WorkOrderItem.maintenanceType exists, safe to rename type)
BEGIN;
CREATE TYPE "MaintenanceType_new" AS ENUM ('OIL_CHANGE', 'OIL_FILTER', 'AIR_FILTER', 'FUEL_FILTER', 'BRAKES', 'BRAKE_FLUID', 'TIRES', 'BATTERY', 'AIR_CONDITIONING', 'TIMING_BELT', 'SPARK_PLUGS', 'TRANSMISSION', 'COOLANT', 'TECHNICAL_INSPECTION', 'PERIODIC_SERVICE', 'OTHER');
ALTER TABLE "WorkOrderItem" ALTER COLUMN "maintenanceType" TYPE "MaintenanceType_new" USING ("maintenanceType"::text::"MaintenanceType_new");
ALTER TABLE "MaintenancePlan" ALTER COLUMN "type" TYPE "MaintenanceType_new" USING ("type"::text::"MaintenanceType_new");
ALTER TABLE "MaintenanceReminder" ALTER COLUMN "type" TYPE "MaintenanceType_new" USING ("type"::text::"MaintenanceType_new");
ALTER TYPE "MaintenanceType" RENAME TO "MaintenanceType_old";
ALTER TYPE "MaintenanceType_new" RENAME TO "MaintenanceType";
DROP TYPE "public"."MaintenanceType_old";
COMMIT;
