import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireRole } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

// GET - Listar todas las categorías
export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const categorias = await prisma.categoriaFarmacia.findMany({
    orderBy: { nombre: "asc" },
    include: {
      _count: { select: { medicamentos: true } },
    },
  })

  return NextResponse.json(categorias)
}

// POST - Crear nueva categoría
export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN")
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { nombre } = body

  if (!nombre) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 })

  const categoria = await prisma.categoriaFarmacia.create({
    data: { nombre },
  })

  return NextResponse.json(categoria, { status: 201 })
}

// PUT - Editar categoría
export async function PUT(req: NextRequest) {
  const auth = await requireRole("ADMIN")
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { id, nombre } = body

  if (!id || !nombre) return NextResponse.json({ error: "ID y nombre requeridos" }, { status: 400 })

  const categoria = await prisma.categoriaFarmacia.update({
    where: { id },
    data: { nombre },
  })

  return NextResponse.json(categoria)
}

// DELETE - Eliminar categoría (solo si no tiene medicamentos asociados)
export async function DELETE(req: NextRequest) {
  const auth = await requireRole("ADMIN")
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { id } = body

  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })

  const count = await prisma.medicamento.count({
    where: { categoriaId: id, activo: true },
  })

  if (count > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar, tiene ${count} medicamento(s) asociado(s)` },
      { status: 400 }
    )
  }

  await prisma.categoriaFarmacia.delete({ where: { id } })

  return NextResponse.json({ mensaje: "Categoría eliminada" })
}
