import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireRole } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

// GET - Listar todos los productos activos
export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const productos = await prisma.productoBodega.findMany({
    where: { activo: true },
    include: { categoria: true },
    orderBy: { nombre: "asc" },
  })

  return NextResponse.json(productos)
}

// POST - Crear nuevo producto
export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN", "BODEGA")
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { codigo, nombre, descripcion, unidad, stockMinimo, categoriaId } = body

  if (!codigo || !nombre || !unidad || !categoriaId) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
  }

  // Verificar unicidad de código
  const existente = await prisma.productoBodega.findUnique({ where: { codigo } })
  if (existente) {
    return NextResponse.json({ error: `Ya existe un producto con el código "${codigo}"` }, { status: 400 })
  }

  const producto = await prisma.productoBodega.create({
    data: {
      codigo,
      nombre,
      descripcion,
      unidad,
      stockMinimo: stockMinimo || 0,
      categoriaId,
    },
    include: { categoria: true },
  })

  return NextResponse.json(producto, { status: 201 })
}

// PUT - Editar producto (solo datos, nunca el stock directamente)
export async function PUT(req: NextRequest) {
  const auth = await requireRole("ADMIN", "BODEGA")
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { id, codigo, nombre, descripcion, unidad, stockMinimo, categoriaId } = body

  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })

  // Verificar unicidad de código (excluyendo el producto actual)
  if (codigo) {
    const existente = await prisma.productoBodega.findFirst({
      where: { codigo, id: { not: id } },
    })
    if (existente) {
      return NextResponse.json({ error: `Ya existe un producto con el código "${codigo}"` }, { status: 400 })
    }
  }

  const producto = await prisma.productoBodega.update({
    where: { id },
    data: {
      codigo,
      nombre,
      descripcion,
      unidad,
      stockMinimo,
      categoriaId,
    },
    include: { categoria: true },
  })

  return NextResponse.json(producto)
}

// DELETE - Desactivar producto (soft delete para mantener historial)
export async function DELETE(req: NextRequest) {
  const auth = await requireRole("ADMIN")
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { id } = body

  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })

  const producto = await prisma.productoBodega.update({
    where: { id },
    data: { activo: false },
  })

  return NextResponse.json({ mensaje: "Producto desactivado", producto })
}
