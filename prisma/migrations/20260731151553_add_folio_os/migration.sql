-- CreateTable
CREATE TABLE "ContadorFolio" (
    "id" SERIAL NOT NULL,
    "modulo" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ContadorFolio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContadorFolio_modulo_anio_key" ON "ContadorFolio"("modulo", "anio");

-- AlterTable: add folio column (nullable, so existing rows are unaffected)
ALTER TABLE "OrdenServicioFlota" ADD COLUMN "folio" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "OrdenServicioFlota_folio_key" ON "OrdenServicioFlota"("folio");
