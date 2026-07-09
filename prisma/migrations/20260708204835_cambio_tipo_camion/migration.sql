/*
  Warnings:

  - The values [CAMION_LIVIANO,CAMION_PESADO] on the enum `TipoVehiculo` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TipoVehiculo_new" AS ENUM ('CAMIONETA', 'SEDAN', 'CAMION', 'MAQUINARIA', 'BUS', 'OTRO');
ALTER TABLE "Vehiculo" ALTER COLUMN "tipo" TYPE "TipoVehiculo_new" USING ("tipo"::text::"TipoVehiculo_new");
ALTER TYPE "TipoVehiculo" RENAME TO "TipoVehiculo_old";
ALTER TYPE "TipoVehiculo_new" RENAME TO "TipoVehiculo";
DROP TYPE "public"."TipoVehiculo_old";
COMMIT;
