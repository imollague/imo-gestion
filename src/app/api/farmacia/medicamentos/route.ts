import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireRole } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

// GET - Listar todos los medicamentos activos
export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const medicamentos = await prisma.medicamento.findMany({
    where: { activo: true },
    include: { categoria: true },
    orderBy: { nombreGenerico: "asc" },
  })

  return NextResponse.json(medicamentos)
}

// POST - Crear nuevo medicamento
export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN", "FARMACIA")
  if (!auth.ok) return auth.response

  const body = await req.json()
  const {
    codigo,
    nombreGenerico,
    nombreComercial,
    formaFarmaceutica,
    concentracion,
    unidad,
    stockMinimo,
    categoriaId,
  } = body

  if (!codigo || !nombreGenerico || !formaFarmaceutica || !unidad || !categoriaId) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
  }

  // Verificar unicidad de código
  const existente = await prisma.medicamento.findUnique({ where: { codigo } })
  if (existente) {
    return NextResponse.json({ error: `Ya existe un medicamento con el código "${codigo}"` }, { status: 400 })
  }

  const medicamento = await prisma.medicamento.create({
    data: {
      codigo,
      nombreGenerico,
      nombreComercial,
      formaFarmaceutica,
      concentracion,
      unidad,
      stockMinimo: stockMinimo || 0,
      categoriaId,
    },
    include: { categoria: true },
  })

  return NextResponse.json(medicamento, { status: 201 })
}

// PUT - Editar medicamento (nunca el stock directamente)
export async function PUT(req: NextRequest) {
  const auth = await requireRole("ADMIN", "FARMACIA")
  if (!auth.ok) return auth.response

  const body = await req.json()
  const {
    id,
    codigo,
    nombreGenerico,
    nombreComercial,
    formaFarmaceutica,
    concentracion,
    unidad,
    stockMinimo,
    categoriaId,
  } = body

  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })

  // Verificar unicidad de código (excluyendo el medicamento actual)
  if (codigo) {
    const existente = await prisma.medicamento.findFirst({
      where: { codigo, id: { not: id } },
    })
    if (existente) {
      return NextResponse.json({ error: `Ya existe un medicamento con el código "${codigo}"` }, { status: 400 })
    }
  }

  const medicamento = await prisma.medicamento.update({
    where: { id },
    data: {
      codigo,
      nombreGenerico,
      nombreComercial,
      formaFarmaceutica,
      concentracion,
      unidad,
      stockMinimo,
      categoriaId,
    },
    include: { categoria: true },
  })

  return NextResponse.json(medicamento)
}

// DELETE - Desactivar medicamento (soft delete)
export async function DELETE(req: NextRequest) {
  const auth = await requireRole("ADMIN")
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { id } = body

  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })

  const medicamento = await prisma.medicamento.update({
    where: { id },
    data: { activo: false },
  })

  return NextResponse.json({ mensaje: "Medicamento desactivado", medicamento })
}
