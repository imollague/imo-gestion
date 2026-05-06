-- CreateEnum
CREATE TYPE "TipoVehiculo" AS ENUM ('CAMIONETA', 'SEDAN', 'CAMION_LIVIANO', 'CAMION_PESADO', 'MAQUINARIA', 'BUS', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoVehiculo" AS ENUM ('OPERATIVO', 'EN_MANTENCION', 'FUERA_SERVICIO', 'DADO_DE_BAJA');

-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'EN_CURSO', 'CERRADA');

-- CreateEnum
CREATE TYPE "TipoMantencion" AS ENUM ('PREVENTIVA', 'CORRECTIVA', 'EMERGENCIA');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'FLOTA';

-- CreateTable
CREATE TABLE "Vehiculo" (
    "id" SERIAL NOT NULL,
    "patente" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "tipo" "TipoVehiculo" NOT NULL,
    "estado" "EstadoVehiculo" NOT NULL DEFAULT 'OPERATIVO',
    "kmActual" INTEGER NOT NULL DEFAULT 0,
    "vencimientoSOAP" TIMESTAMP(3),
    "vencimientoRevTecnica" TIMESTAMP(3),
    "vencimientoPermiso" TIMESTAMP(3),
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoVehiculo" (
    "id" SERIAL NOT NULL,
    "vehiculoId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "subidoPorId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoVehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudVehiculo" (
    "id" SERIAL NOT NULL,
    "vehiculoId" INTEGER NOT NULL,
    "conductorId" INTEGER,
    "conductorNombre" TEXT NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'PENDIENTE',
    "destino" TEXT NOT NULL,
    "proposito" TEXT NOT NULL,
    "fechaSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aprobadoPorId" INTEGER,
    "fechaAprobacion" TIMESTAMP(3),
    "motivoRechazo" TEXT,
    "fechaCierre" TIMESTAMP(3),
    "cerradoPorId" INTEGER,

    CONSTRAINT "SolicitudVehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistSolicitud" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "completadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistSolicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" SERIAL NOT NULL,
    "categoria" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistRespuesta" (
    "id" SERIAL NOT NULL,
    "checklistId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "valor" TEXT NOT NULL,
    "observacion" TEXT,

    CONSTRAINT "ChecklistRespuesta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenServicioFlota" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "horaSalidaEst" TIMESTAMP(3) NOT NULL,
    "horaRetornoEst" TIMESTAMP(3),
    "folioFedoks" TEXT,
    "firmadaPorId" INTEGER,
    "fechaFirma" TIMESTAMP(3),
    "firmada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OrdenServicioFlota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BitacoraViaje" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "kmSalida" INTEGER NOT NULL,
    "kmLlegada" INTEGER,
    "horaRetornoReal" TIMESTAMP(3),
    "observacion" TEXT,
    "registradoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BitacoraViaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargaCombustible" (
    "id" SERIAL NOT NULL,
    "bitacoraId" INTEGER NOT NULL,
    "kmAlMomento" INTEGER NOT NULL,
    "litros" DOUBLE PRECISION NOT NULL,
    "comprobanteRef" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CargaCombustible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HojaVidaVehiculo" (
    "id" SERIAL NOT NULL,
    "vehiculoId" INTEGER NOT NULL,
    "solicitudId" INTEGER,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HojaVidaVehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MantencionVehiculo" (
    "id" SERIAL NOT NULL,
    "vehiculoId" INTEGER NOT NULL,
    "tipo" "TipoMantencion" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "taller" TEXT,
    "costo" DOUBLE PRECISION,
    "kmAlMomento" INTEGER,
    "descripcion" TEXT,
    "registradoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "MantencionVehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehiculo_patente_key" ON "Vehiculo"("patente");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistSolicitud_solicitudId_key" ON "ChecklistSolicitud"("solicitudId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenServicioFlota_solicitudId_key" ON "OrdenServicioFlota"("solicitudId");

-- CreateIndex
CREATE UNIQUE INDEX "BitacoraViaje_solicitudId_key" ON "BitacoraViaje"("solicitudId");

-- AddForeignKey
ALTER TABLE "DocumentoVehiculo" ADD CONSTRAINT "DocumentoVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoVehiculo" ADD CONSTRAINT "DocumentoVehiculo_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudVehiculo" ADD CONSTRAINT "SolicitudVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudVehiculo" ADD CONSTRAINT "SolicitudVehiculo_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudVehiculo" ADD CONSTRAINT "SolicitudVehiculo_cerradoPorId_fkey" FOREIGN KEY ("cerradoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistSolicitud" ADD CONSTRAINT "ChecklistSolicitud_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudVehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistRespuesta" ADD CONSTRAINT "ChecklistRespuesta_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "ChecklistSolicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistRespuesta" ADD CONSTRAINT "ChecklistRespuesta_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ChecklistItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenServicioFlota" ADD CONSTRAINT "OrdenServicioFlota_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudVehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenServicioFlota" ADD CONSTRAINT "OrdenServicioFlota_firmadaPorId_fkey" FOREIGN KEY ("firmadaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BitacoraViaje" ADD CONSTRAINT "BitacoraViaje_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudVehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargaCombustible" ADD CONSTRAINT "CargaCombustible_bitacoraId_fkey" FOREIGN KEY ("bitacoraId") REFERENCES "BitacoraViaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HojaVidaVehiculo" ADD CONSTRAINT "HojaVidaVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HojaVidaVehiculo" ADD CONSTRAINT "HojaVidaVehiculo_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudVehiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HojaVidaVehiculo" ADD CONSTRAINT "HojaVidaVehiculo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MantencionVehiculo" ADD CONSTRAINT "MantencionVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MantencionVehiculo" ADD CONSTRAINT "MantencionVehiculo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
