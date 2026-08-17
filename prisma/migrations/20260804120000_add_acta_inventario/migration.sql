-- CreateTable: ActaInventario
CREATE TABLE "ActaInventario" (
    "id" SERIAL NOT NULL,
    "modulo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE_JEFE',
    "descripcion" TEXT NOT NULL,
    "tieneDiferencias" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,
    "urlFirmadoResponsable" TEXT,
    "urlFirmadoFinal" TEXT,
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" INTEGER NOT NULL,
    "jefeId" INTEGER,
    "firmadoJefeId" INTEGER,
    "fechaFirmaJefe" TIMESTAMP(3),

    CONSTRAINT "ActaInventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ActaInventarioItem
CREATE TABLE "ActaInventarioItem" (
    "id" SERIAL NOT NULL,
    "actaId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "stockSistema" INTEGER NOT NULL,
    "stockContado" INTEGER NOT NULL,
    "diferencia" INTEGER NOT NULL,
    "observacion" TEXT,
    "productoId" INTEGER,
    "medicamentoId" INTEGER,

    CONSTRAINT "ActaInventarioItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ActaInventario" ADD CONSTRAINT "ActaInventario_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActaInventario" ADD CONSTRAINT "ActaInventario_jefeId_fkey" FOREIGN KEY ("jefeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActaInventario" ADD CONSTRAINT "ActaInventario_firmadoJefeId_fkey" FOREIGN KEY ("firmadoJefeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActaInventarioItem" ADD CONSTRAINT "ActaInventarioItem_actaId_fkey" FOREIGN KEY ("actaId") REFERENCES "ActaInventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
