-- Simplification MVP de l'immatriculation malienne : retrait de toute
-- donnée territoriale (région/arrondissement/cercle) introduite par la
-- migration 20260827080000_vehicle_registration_mali. Seule la validation du
-- format LL CCC LL (licensePlate + plateDataStatus) est conservée. Aucune
-- perte de la valeur licensePlate elle-même — seuls les composants
-- structurés dérivés et le rattachement territorial (jamais peuplé, voir le
-- rapport de l'évolution précédente) sont retirés.

-- DropForeignKey
ALTER TABLE "Vehicle" DROP CONSTRAINT "Vehicle_registrationAreaId_fkey";

-- DropIndex
DROP INDEX "Vehicle_registrationAreaId_idx";

-- AlterTable
ALTER TABLE "Vehicle" DROP COLUMN "plateSeries",
DROP COLUMN "plateSequence",
DROP COLUMN "plateSeriesSuffix",
DROP COLUMN "registrationAreaType",
DROP COLUMN "registrationAreaId",
DROP COLUMN "registrationCountryCode";

-- DropTable
DROP TABLE "MaliAdministrativeArea";

-- DropEnum
DROP TYPE "RegistrationAreaType";
