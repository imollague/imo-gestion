-- AlterTable
ALTER TABLE "MovimientoFarmacia" ADD COLUMN     "pacienteId" INTEGER;

-- CreateTable
CREATE TABLE "Paciente" (
    "id" SERIAL NOT NULL,
    "rut" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Paciente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Paciente_rut_key" ON "Paciente"("rut");

-- AddForeignKey
ALTER TABLE "MovimientoFarmacia" ADD CONSTRAINT "MovimientoFarmacia_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
