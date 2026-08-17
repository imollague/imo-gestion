-- Fase 2: Refactor tipo de vehículo
-- NO ejecutar sin aprobación explícita del usuario.
-- Pasos separados para no perder datos.

-- ─── PASO 1: Nuevos valores del enum TipoVehiculo ───────────────────────────
-- PostgreSQL no permite eliminar valores de enum, solo agregar.
-- La estrategia es crear el nuevo enum y migrar la columna.

ALTER TYPE "TipoVehiculo" ADD VALUE IF NOT EXISTS 'AUTOMOVIL';
ALTER TYPE "TipoVehiculo" ADD VALUE IF NOT EXISTS 'STATION_WAGON';
ALTER TYPE "TipoVehiculo" ADD VALUE IF NOT EXISTS 'TODO_TERRENO';
ALTER TYPE "TipoVehiculo" ADD VALUE IF NOT EXISTS 'FURGON';
ALTER TYPE "TipoVehiculo" ADD VALUE IF NOT EXISTS 'MINIBUS';
ALTER TYPE "TipoVehiculo" ADD VALUE IF NOT EXISTS 'MOTOCICLETA';
ALTER TYPE "TipoVehiculo" ADD VALUE IF NOT EXISTS 'CARRO_ARRASTRE';
-- CAMIONETA, CAMION, MAQUINARIA, BUS, OTRO ya existen — se omiten

-- ─── PASO 2: Nuevos enums ────────────────────────────────────────────────────
CREATE TYPE "UsoMunicipal" AS ENUM (
  'AMBULANCIA',
  'ALJIBE',
  'RECOLECTOR_RESIDUOS',
  'TRANSPORTE_PERSONAL',
  'OPERATIVO_TERRENO',
  'EMERGENCIA',
  'ADMINISTRATIVO',
  'OBRAS',
  'OTRO'
);

CREATE TYPE "UnidadMedidaUso" AS ENUM (
  'KILOMETROS',
  'HORAS'
);

-- ─── PASO 3: Nuevas columnas en Vehiculo ────────────────────────────────────
ALTER TABLE "Vehiculo"
  ADD COLUMN IF NOT EXISTS "numeroInterno"   TEXT,
  ADD COLUMN IF NOT EXISTS "usoMunicipal"    "UsoMunicipal",
  ADD COLUMN IF NOT EXISTS "unidadMedidaUso" "UnidadMedidaUso" NOT NULL DEFAULT 'KILOMETROS',
  ADD COLUMN IF NOT EXISTS "horasUso"        INTEGER NOT NULL DEFAULT 0;

-- ─── PASO 4: patente nullable ────────────────────────────────────────────────
-- Primero eliminamos la restricción NOT NULL (mantenemos el UNIQUE index)
ALTER TABLE "Vehiculo" ALTER COLUMN "patente" DROP NOT NULL;

-- ─── PASO 5: Migración de datos — valores seguros (mapeo 1-a-1) ─────────────
UPDATE "Vehiculo" SET "tipo" = 'AUTOMOVIL'  WHERE "tipo" = 'SEDAN';
-- CAMIONETA → CAMIONETA  (sin cambio)
-- CAMION    → CAMION     (sin cambio)
-- MAQUINARIA → MAQUINARIA (sin cambio)
-- OTRO      → OTRO       (sin cambio)

-- ─── PASO 6: MAQUINARIA → unidadMedidaUso = HORAS ───────────────────────────
UPDATE "Vehiculo" SET "unidadMedidaUso" = 'HORAS' WHERE "tipo" = 'MAQUINARIA';

-- ─── PASO 7: BUS — provisional, requiere revisión manual ────────────────────
-- Los registros BUS quedan con valor 'BUS' (válido en el nuevo enum).
-- Lista para revisión manual:
-- SELECT id, patente, marca, modelo FROM "Vehiculo" WHERE tipo = 'BUS';
-- El encargado debe decidir uno por uno si es BUS o MINIBUS.
