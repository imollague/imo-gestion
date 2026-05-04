/*
  Warnings:

  - A unique constraint covering the columns `[anulacionDeId]` on the table `MovimientoBodega` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[anulacionDeId]` on the table `MovimientoFarmacia` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "MovimientoBodega" ADD COLUMN     "anulacionDeId" INTEGER,
ADD COLUMN     "anulado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "motivoAnulacion" TEXT;

-- AlterTable
ALTER TABLE "MovimientoFarmacia" ADD COLUMN     "anulacionDeId" INTEGER,
ADD COLUMN     "anulado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "motivoAnulacion" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MovimientoBodega_anulacionDeId_key" ON "MovimientoBodega"("anulacionDeId");

-- CreateIndex
CREATE UNIQUE INDEX "MovimientoFarmacia_anulacionDeId_key" ON "MovimientoFarmacia"("anulacionDeId");

-- AddForeignKey
ALTER TABLE "MovimientoBodega" ADD CONSTRAINT "MovimientoBodega_anulacionDeId_fkey" FOREIGN KEY ("anulacionDeId") REFERENCES "MovimientoBodega"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoFarmacia" ADD CONSTRAINT "MovimientoFarmacia_anulacionDeId_fkey" FOREIGN KEY ("anulacionDeId") REFERENCES "MovimientoFarmacia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
