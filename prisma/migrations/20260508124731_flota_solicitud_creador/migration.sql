/*
  Warnings:

  - Added the required column `creadoPorId` to the `SolicitudVehiculo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SolicitudVehiculo" ADD COLUMN     "creadoPorId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "SolicitudVehiculo" ADD CONSTRAINT "SolicitudVehiculo_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
