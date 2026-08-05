-- Nuevos valores de enum
ALTER TYPE "TipoMovimiento" ADD VALUE 'MERMA';
ALTER TYPE "TipoDocumento" ADD VALUE 'ACTA_MERMA';

-- Tabla ActaMerma
CREATE TABLE "ActaMerma" (
    "id" SERIAL NOT NULL,
    "modulo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE_JEFE',
    "descripcion" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "observaciones" TEXT,
    "urlFirmadoResponsable" TEXT,
    "urlFirmadoFinal" TEXT,
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" INTEGER NOT NULL,
    "jefeId" INTEGER,
    "firmadoJefeId" INTEGER,
    "fechaFirmaJefe" TIMESTAMP(3),
    CONSTRAINT "ActaMerma_pkey" PRIMARY KEY ("id")
);

-- Tabla ActaMermaItem
CREATE TABLE "ActaMermaItem" (
    "id" SERIAL NOT NULL,
    "actaId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stockAntes" INTEGER NOT NULL,
    "observacion" TEXT,
    "productoId" INTEGER,
    "medicamentoId" INTEGER,
    CONSTRAINT "ActaMermaItem_pkey" PRIMARY KEY ("id")
);

-- FK ActaMerma
ALTER TABLE "ActaMerma" ADD CONSTRAINT "ActaMerma_creadoPorId_fkey"
    FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActaMerma" ADD CONSTRAINT "ActaMerma_jefeId_fkey"
    FOREIGN KEY ("jefeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActaMerma" ADD CONSTRAINT "ActaMerma_firmadoJefeId_fkey"
    FOREIGN KEY ("firmadoJefeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- FK ActaMermaItem
ALTER TABLE "ActaMermaItem" ADD CONSTRAINT "ActaMermaItem_actaId_fkey"
    FOREIGN KEY ("actaId") REFERENCES "ActaMerma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
