-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'BODEGA', 'FARMACIA', 'VIEWER');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ENTRADA', 'SALIDA');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('ORDEN_COMPRA', 'FACTURA', 'GUIA_DESPACHO', 'NOTA_DEBITO', 'NOTA_CREDITO', 'ACTA_DONACION', 'SIN_DOCUMENTO', 'OTRO');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaBodega" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "CategoriaBodega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoBodega" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidad" TEXT NOT NULL,
    "stockActual" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 0,
    "categoriaId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductoBodega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoBodega" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "documento" "TipoDocumento" NOT NULL,
    "numeroDocumento" TEXT,
    "proveedor" TEXT,
    "destinatario" TEXT,
    "area" TEXT,
    "observacion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productoId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "MovimientoBodega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaFarmacia" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "CategoriaFarmacia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medicamento" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombreGenerico" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "formaFarmaceutica" TEXT NOT NULL,
    "concentracion" TEXT,
    "unidad" TEXT NOT NULL,
    "stockActual" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 0,
    "categoriaId" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Medicamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoFarmacia" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "lote" TEXT,
    "fechaVencimiento" TIMESTAMP(3),
    "proveedor" TEXT,
    "rutPaciente" TEXT,
    "observacion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "medicamentoId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "MovimientoFarmacia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaBodega_nombre_key" ON "CategoriaBodega"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoBodega_codigo_key" ON "ProductoBodega"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaFarmacia_nombre_key" ON "CategoriaFarmacia"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Medicamento_codigo_key" ON "Medicamento"("codigo");

-- AddForeignKey
ALTER TABLE "ProductoBodega" ADD CONSTRAINT "ProductoBodega_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaBodega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoBodega" ADD CONSTRAINT "MovimientoBodega_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "ProductoBodega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoBodega" ADD CONSTRAINT "MovimientoBodega_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicamento" ADD CONSTRAINT "Medicamento_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaFarmacia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoFarmacia" ADD CONSTRAINT "MovimientoFarmacia_medicamentoId_fkey" FOREIGN KEY ("medicamentoId") REFERENCES "Medicamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoFarmacia" ADD CONSTRAINT "MovimientoFarmacia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
