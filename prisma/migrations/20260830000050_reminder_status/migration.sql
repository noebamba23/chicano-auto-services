-- AlterEnum
BEGIN;
CREATE TYPE "ReminderStatus_new" AS ENUM ('PENDING', 'SCHEDULED', 'SENT', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."MaintenanceReminder" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "MaintenanceReminder" ALTER COLUMN "status" TYPE "ReminderStatus_new" USING ("status"::text::"ReminderStatus_new");
ALTER TYPE "ReminderStatus" RENAME TO "ReminderStatus_old";
ALTER TYPE "ReminderStatus_new" RENAME TO "ReminderStatus";
DROP TYPE "public"."ReminderStatus_old";
ALTER TABLE "MaintenanceReminder" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
COMMIT;
