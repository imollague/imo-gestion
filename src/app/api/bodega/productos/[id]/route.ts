import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireRole } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params

  const producto = await prisma.productoBodega.findUnique({
    where: { id: parseInt(id) },
    include: {
      categoria: true,
      movimientos: {
        select: {
          id: true,
          tipo: true,
          cantidad: true,
          documento: true,
          numeroDocumento: true,
          proveedor: true,
          destinatario: true,
          area: true,
          observacion: true,
          fecha: true,
          anulado: true,
          anulacionDeId: true,
          usuario: { select: { id: true, name: true } },
        },
        orderBy: { fecha: "desc" },
        take: 50,
      },
      historial: {
        orderBy: { validoDesde: "desc" },
        include: { categoria: true },
      },
    },
  })

  if (!producto) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })

  return NextResponse.json(producto)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("ADMIN", "BODEGA")
  if (!auth.ok) return auth.response

  const { id } = await params
  const productoId = parseInt(id)
  const body = await req.json()
  const { codigo, nombre, descripcion, unidad, stockMinimo, categoriaId } = body

  // Verificar unicidad de código (excluyendo el producto actual)
  if (codigo) {
    const existente = await prisma.productoBodega.findFirst({
      where: { codigo, id: { not: productoId } },
    })
    if (existente) {
      return NextResponse.json({ error: `Ya existe un producto con el código "${codigo}"` }, { status: 400 })
    }
  }

  const resultado = await prisma.$transaction(async (tx) => {
    // Cerrar registro SCD anterior
    await tx.productoBodegaHistorial.updateMany({
      where: { productoId, validoHasta: null },
      data: { validoHasta: new Date() },
    })

    // Actualizar producto
    const producto = await tx.productoBodega.update({
      where: { id: productoId },
      data: { codigo, nombre, descripcion, unidad, stockMinimo, categoriaId },
      include: { categoria: true },
    })

    // Crear nuevo registro SCD
    await tx.productoBodegaHistorial.create({
      data: {
        productoId,
        nombre,
        categoriaId,
        unidad,
        stockMinimo,
        validoDesde: new Date(),
      },
    })

    return producto
  })

  return NextResponse.json(resultado)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("ADMIN")
  if (!auth.ok) return auth.response

  const { id } = await params

  const producto = await prisma.productoBodega.update({
    where: { id: parseInt(id) },
    data: { activo: false },
  })

  return NextResponse.json({ mensaje: "Producto desactivado", producto })
}
