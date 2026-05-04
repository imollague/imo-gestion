-- CreateTable
CREATE TABLE "LoteFarmacia" (
    "id" SERIAL NOT NULL,
    "medicamentoId" INTEGER NOT NULL,
    "numeroLote" TEXT NOT NULL,
    "fechaVencimiento" TIMESTAMP(3),
    "stockInicial" INTEGER NOT NULL,
    "stockActual" INTEGER NOT NULL,
    "fechaIngreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proveedor" TEXT,
    "retirado" BOOLEAN NOT NULL DEFAULT false,
    "motivoRetiro" TEXT,
    "fechaRetiro" TIMESTAMP(3),

    CONSTRAINT "LoteFarmacia_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LoteFarmacia" ADD CONSTRAINT "LoteFarmacia_medicamentoId_fkey" FOREIGN KEY ("medicamentoId") REFERENCES "Medicamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
