-- AlterTable
ALTER TABLE "User" ADD COLUMN     "rut" TEXT;

-- CreateTable
CREATE TABLE "DocumentoFirmado" (
    "id" SERIAL NOT NULL,
    "origen" TEXT NOT NULL,
    "origenId" INTEGER,
    "descripcion" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "urlOriginal" TEXT,
    "urlFirmado" TEXT,
    "checksumOriginal" TEXT,
    "checksumFirmado" TEXT,
    "idSolicitudFirmagob" TEXT,
    "errorMsg" TEXT,
    "firmadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" INTEGER NOT NULL,
    "firmadoPorId" INTEGER,

    CONSTRAINT "DocumentoFirmado_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DocumentoFirmado" ADD CONSTRAINT "DocumentoFirmado_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoFirmado" ADD CONSTRAINT "DocumentoFirmado_firmadoPorId_fkey" FOREIGN KEY ("firmadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
