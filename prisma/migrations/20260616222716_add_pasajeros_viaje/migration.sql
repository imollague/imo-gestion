-- CreateTable
CREATE TABLE "PasajeroViaje" (
    "id" SERIAL NOT NULL,
    "paradaId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "rut" TEXT,

    CONSTRAINT "PasajeroViaje_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PasajeroViaje" ADD CONSTRAINT "PasajeroViaje_paradaId_fkey" FOREIGN KEY ("paradaId") REFERENCES "ParadaViaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;
