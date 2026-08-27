-- AlterTable
ALTER TABLE "DiagnosticReport" ADD COLUMN "sequenceNumber" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN "sequenceNumber" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticReport_sequenceNumber_key" ON "DiagnosticReport"("sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_sequenceNumber_key" ON "Quote"("sequenceNumber");
