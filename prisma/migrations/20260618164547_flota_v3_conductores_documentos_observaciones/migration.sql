/*
  Reordenado a mano respecto al SQL generado por Prisma para poder hacer el
  backfill de vencimientos ANTES de soltar las columnas viejas de Vehiculo.
*/

-- AlterTable
ALTER TABLE "SolicitudVehiculo" ADD COLUMN     "conductorFlotaId" INTEGER;

-- CreateTable
CREATE TABLE "ConductorFlota" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "rut" TEXT,
    "numeroCaucion" TEXT,
    "numeroLicencia" TEXT,
    "tipoLicencia" TEXT NOT NULL,
    "fechaLicencia" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConductorFlota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoDocumentoVehiculo" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "diasAlertaDefault" INTEGER NOT NULL DEFAULT 30,
    "esDefault" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TipoDocumentoVehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VencimientoDocumentoVehiculo" (
    "id" SERIAL NOT NULL,
    "vehiculoId" INTEGER NOT NULL,
    "tipoDocumentoId" INTEGER NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "diasAlerta" INTEGER,

    CONSTRAINT "VencimientoDocumentoVehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservacionVehiculo" (
    "id" SERIAL NOT NULL,
    "vehiculoId" INTEGER NOT NULL,
    "solicitudId" INTEGER,
    "origen" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTA',
    "creadoPorId" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoPorId" INTEGER,
    "fechaCierre" TIMESTAMP(3),

    CONSTRAINT "ObservacionVehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservacionNota" (
    "id" SERIAL NOT NULL,
    "observacionId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "autorId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservacionNota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservacionArchivo" (
    "id" SERIAL NOT NULL,
    "observacionId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "subidoPorId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservacionArchivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConductorFlota_userId_key" ON "ConductorFlota"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VencimientoDocumentoVehiculo_vehiculoId_tipoDocumentoId_key" ON "VencimientoDocumentoVehiculo"("vehiculoId", "tipoDocumentoId");

-- AddForeignKey
ALTER TABLE "SolicitudVehiculo" ADD CONSTRAINT "SolicitudVehiculo_conductorFlotaId_fkey" FOREIGN KEY ("conductorFlotaId") REFERENCES "ConductorFlota"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConductorFlota" ADD CONSTRAINT "ConductorFlota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VencimientoDocumentoVehiculo" ADD CONSTRAINT "VencimientoDocumentoVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VencimientoDocumentoVehiculo" ADD CONSTRAINT "VencimientoDocumentoVehiculo_tipoDocumentoId_fkey" FOREIGN KEY ("tipoDocumentoId") REFERENCES "TipoDocumentoVehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservacionVehiculo" ADD CONSTRAINT "ObservacionVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservacionVehiculo" ADD CONSTRAINT "ObservacionVehiculo_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudVehiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservacionVehiculo" ADD CONSTRAINT "ObservacionVehiculo_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservacionVehiculo" ADD CONSTRAINT "ObservacionVehiculo_cerradoPorId_fkey" FOREIGN KEY ("cerradoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservacionNota" ADD CONSTRAINT "ObservacionNota_observacionId_fkey" FOREIGN KEY ("observacionId") REFERENCES "ObservacionVehiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservacionNota" ADD CONSTRAINT "ObservacionNota_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservacionArchivo" ADD CONSTRAINT "ObservacionArchivo_observacionId_fkey" FOREIGN KEY ("observacionId") REFERENCES "ObservacionVehiculo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservacionArchivo" ADD CONSTRAINT "ObservacionArchivo_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed: catálogo de tipos de documento default (no se pueden borrar, solo editar el umbral)
INSERT INTO "TipoDocumentoVehiculo" ("nombre", "diasAlertaDefault", "esDefault", "activo")
VALUES
  ('SOAP', 30, true, true),
  ('Revisión técnica', 30, true, true),
  ('Permiso de circulación', 30, true, true);

-- Backfill: migrar vencimientos existentes de Vehiculo a la tabla genérica ANTES de soltar las columnas
INSERT INTO "VencimientoDocumentoVehiculo" ("vehiculoId", "tipoDocumentoId", "fechaVencimiento")
SELECT "id", (SELECT "id" FROM "TipoDocumentoVehiculo" WHERE "nombre" = 'SOAP'), "vencimientoSOAP"
FROM "Vehiculo" WHERE "vencimientoSOAP" IS NOT NULL;

INSERT INTO "VencimientoDocumentoVehiculo" ("vehiculoId", "tipoDocumentoId", "fechaVencimiento")
SELECT "id", (SELECT "id" FROM "TipoDocumentoVehiculo" WHERE "nombre" = 'Revisión técnica'), "vencimientoRevTecnica"
FROM "Vehiculo" WHERE "vencimientoRevTecnica" IS NOT NULL;

INSERT INTO "VencimientoDocumentoVehiculo" ("vehiculoId", "tipoDocumentoId", "fechaVencimiento")
SELECT "id", (SELECT "id" FROM "TipoDocumentoVehiculo" WHERE "nombre" = 'Permiso de circulación'), "vencimientoPermiso"
FROM "Vehiculo" WHERE "vencimientoPermiso" IS NOT NULL;

-- AlterTable: ahora sí, soltar las columnas viejas y agregar licenciasPermitidas
ALTER TABLE "Vehiculo" DROP COLUMN "vencimientoPermiso",
DROP COLUMN "vencimientoRevTecnica",
DROP COLUMN "vencimientoSOAP",
ADD COLUMN     "licenciasPermitidas" TEXT[] DEFAULT ARRAY[]::TEXT[];
