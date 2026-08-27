-- CreateEnum
CREATE TYPE "PlateDataStatus" AS ENUM ('STRUCTURED', 'LEGACY_NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "RegistrationAreaType" AS ENUM ('DISTRICT', 'CIRCLE');

-- CreateTable
-- Volontairement vide à l'application de cette migration : aucune donnée
-- administrative (région, arrondissement, cercle, code officiel de plaque)
-- n'est insérée sans source vérifiée. Voir le rapport de l'évolution
-- "IMMATRICULATION MALI".
CREATE TABLE "MaliAdministrativeArea" (
    "id" TEXT NOT NULL,
    "regionName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RegistrationAreaType" NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaliAdministrativeArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaliAdministrativeArea_regionName_name_key" ON "MaliAdministrativeArea"("regionName", "name");

-- DropIndex
-- Remplacé par l'index unique créé plus bas (licensePlate devient une
-- contrainte d'unicité, pas seulement un index de recherche).
DROP INDEX "Vehicle_licensePlate_idx";

-- AlterTable
-- plateDataStatus NOT NULL DEFAULT 'LEGACY_NEEDS_REVIEW' : chaque véhicule
-- existant est automatiquement marqué "à revoir" par ce défaut, sans qu'aucune
-- donnée ne soit inventée pour reconstruire ses composants structurés
-- (section 19 de la demande "ÉVOLUTION IMMATRICULATION" — aucune perte de
-- données, aucune invention).
ALTER TABLE "Vehicle" ADD COLUMN "plateSeries" TEXT,
ADD COLUMN "plateSequence" INTEGER,
ADD COLUMN "plateSeriesSuffix" TEXT,
ADD COLUMN "registrationAreaType" "RegistrationAreaType",
ADD COLUMN "registrationAreaId" TEXT,
ADD COLUMN "registrationCountryCode" TEXT DEFAULT 'ML',
ADD COLUMN "plateDataStatus" "PlateDataStatus" NOT NULL DEFAULT 'LEGACY_NEEDS_REVIEW';

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_licensePlate_key" ON "Vehicle"("licensePlate");

-- CreateIndex
CREATE INDEX "Vehicle_registrationAreaId_idx" ON "Vehicle"("registrationAreaId");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_registrationAreaId_fkey" FOREIGN KEY ("registrationAreaId") REFERENCES "MaliAdministrativeArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
