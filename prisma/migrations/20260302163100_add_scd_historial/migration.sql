-- CreateTable
CREATE TABLE "ProductoBodegaHistorial" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "unidad" TEXT NOT NULL,
    "stockMinimo" INTEGER NOT NULL,
    "validoDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validoHasta" TIMESTAMP(3),

    CONSTRAINT "ProductoBodegaHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicamentoHistorial" (
    "id" SERIAL NOT NULL,
    "medicamentoId" INTEGER NOT NULL,
    "nombreGenerico" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "formaFarmaceutica" TEXT NOT NULL,
    "concentracion" TEXT,
    "unidad" TEXT NOT NULL,
    "stockMinimo" INTEGER NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "validoDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validoHasta" TIMESTAMP(3),

    CONSTRAINT "MedicamentoHistorial_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProductoBodegaHistorial" ADD CONSTRAINT "ProductoBodegaHistorial_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "ProductoBodega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoBodegaHistorial" ADD CONSTRAINT "ProductoBodegaHistorial_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaBodega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicamentoHistorial" ADD CONSTRAINT "MedicamentoHistorial_medicamentoId_fkey" FOREIGN KEY ("medicamentoId") REFERENCES "Medicamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicamentoHistorial" ADD CONSTRAINT "MedicamentoHistorial_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaFarmacia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
