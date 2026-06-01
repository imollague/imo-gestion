/*
  Warnings:

  - You are about to drop the `CargaCombustible` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CargaCombustible" DROP CONSTRAINT "CargaCombustible_bitacoraId_fkey";

-- AlterTable
ALTER TABLE "Vehiculo" ADD COLUMN     "imagenUrl" TEXT;

-- DropTable
DROP TABLE "CargaCombustible";

-- CreateTable
CREATE TABLE "ParadaViaje" (
    "id" SERIAL NOT NULL,
    "bitacoraId" INTEGER NOT NULL,
    "km" INTEGER NOT NULL,
    "descripcion" TEXT,
    "litros" DOUBLE PRECISION,
    "comprobanteRef" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParadaViaje_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ParadaViaje" ADD CONSTRAINT "ParadaViaje_bitacoraId_fkey" FOREIGN KEY ("bitacoraId") REFERENCES "BitacoraViaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
