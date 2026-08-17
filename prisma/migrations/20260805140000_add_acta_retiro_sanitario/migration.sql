-- Nuevos valores de enum
ALTER TYPE "TipoMovimiento" ADD VALUE 'RETIRO_SANITARIO';
ALTER TYPE "TipoDocumento" ADD VALUE 'ACTA_RETIRO_SANITARIO';

-- Tabla ActaRetiroSanitario
CREATE TABLE "ActaRetiroSanitario" (
    "id" SERIAL NOT NULL,
    "modulo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE_JEFE',
    "descripcion" TEXT NOT NULL,
    "causa" TEXT NOT NULL,
    "referenciaOficial" TEXT,
    "destino" TEXT NOT NULL,
    "observaciones" TEXT,
    "urlFirmadoResponsable" TEXT,
    "urlFirmadoFinal" TEXT,
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" INTEGER NOT NULL,
    "jefeId" INTEGER,
    "firmadoJefeId" INTEGER,
    "fechaFirmaJefe" TIMESTAMP(3),
    CONSTRAINT "ActaRetiroSanitario_pkey" PRIMARY KEY ("id")
);

-- Tabla ActaRetiroSanitarioItem
CREATE TABLE "ActaRetiroSanitarioItem" (
    "id" SERIAL NOT NULL,
    "actaId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "lote" TEXT,
    "fechaVencimiento" TIMESTAMP(3),
    "cantidad" INTEGER NOT NULL,
    "stockAntes" INTEGER NOT NULL,
    "observacion" TEXT,
    "productoId" INTEGER,
    "medicamentoId" INTEGER,
    CONSTRAINT "ActaRetiroSanitarioItem_pkey" PRIMARY KEY ("id")
);

-- FK ActaRetiroSanitario
ALTER TABLE "ActaRetiroSanitario" ADD CONSTRAINT "ActaRetiroSanitario_creadoPorId_fkey"
    FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActaRetiroSanitario" ADD CONSTRAINT "ActaRetiroSanitario_jefeId_fkey"
    FOREIGN KEY ("jefeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActaRetiroSanitario" ADD CONSTRAINT "ActaRetiroSanitario_firmadoJefeId_fkey"
    FOREIGN KEY ("firmadoJefeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- FK ActaRetiroSanitarioItem
ALTER TABLE "ActaRetiroSanitarioItem" ADD CONSTRAINT "ActaRetiroSanitarioItem_actaId_fkey"
    FOREIGN KEY ("actaId") REFERENCES "ActaRetiroSanitario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
