-- CreateTable
CREATE TABLE "FotoRevisionVehiculo" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotoRevisionVehiculo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FotoRevisionVehiculo" ADD CONSTRAINT "FotoRevisionVehiculo_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudVehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
