import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireRole } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

// GET - Obtener medicamento por ID con sus movimientos e historial
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id: idStr } = await params
  const id = parseInt(idStr)

  const medicamento = await prisma.medicamento.findUnique({
    where: { id },
    include: {
      categoria: true,
      movimientos: {
        select: {
          id: true,
          tipo: true,
          cantidad: true,
          lote: true,
          fechaVencimiento: true,
          proveedor: true,
          rutPaciente: true,
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

  if (!medicamento) return NextResponse.json({ error: "Medicamento no encontrado" }, { status: 404 })

  return NextResponse.json(medicamento)
}

// PUT - Editar medicamento por ID (con historial SCD)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("ADMIN", "FARMACIA")
  if (!auth.ok) return auth.response

  const { id: idStr } = await params
  const id = parseInt(idStr)
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

  // Verificar unicidad de código (excluyendo el medicamento actual)
  if (codigo) {
    const existente = await prisma.medicamento.findFirst({
      where: { codigo, id: { not: id } },
    })
    if (existente) {
      return NextResponse.json({ error: `Ya existe un medicamento con el código "${codigo}"` }, { status: 400 })
    }
  }

  const resultado = await prisma.$transaction(async (tx) => {
    // Cerrar registro SCD anterior
    await tx.medicamentoHistorial.updateMany({
      where: { medicamentoId: id, validoHasta: null },
      data: { validoHasta: new Date() },
    })

    // Actualizar medicamento
    const medicamento = await tx.medicamento.update({
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

    // Crear nuevo registro SCD
    await tx.medicamentoHistorial.create({
      data: {
        medicamentoId: id,
        nombreGenerico,
        nombreComercial,
        formaFarmaceutica,
        concentracion,
        unidad,
        stockMinimo,
        categoriaId,
        validoDesde: new Date(),
      },
    })

    return medicamento
  })

  return NextResponse.json(resultado)
}

// DELETE - Desactivar medicamento por ID
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("ADMIN")
  if (!auth.ok) return auth.response

  const { id: idStr } = await params
  const id = parseInt(idStr)

  const medicamento = await prisma.medicamento.update({
    where: { id },
    data: { activo: false },
  })

  return NextResponse.json({ mensaje: "Medicamento desactivado", medicamento })
}
