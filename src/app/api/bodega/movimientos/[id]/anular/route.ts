import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("ADMIN", "BODEGA")
  if (!auth.ok) return auth.response
  const { session } = auth

  const { id } = await params
  const movimientoId = parseInt(id)
  const body = await req.json()
  const { motivo } = body

  if (!motivo?.trim()) {
    return NextResponse.json({ error: "El motivo de anulacion es obligatorio" }, { status: 400 })
  }

  const movimiento = await prisma.movimientoBodega.findUnique({
    where: { id: movimientoId },
    include: { producto: true },
  })

  if (!movimiento) {
    return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 })
  }

  if (movimiento.anulado) {
    return NextResponse.json({ error: "Este movimiento ya fue anulado" }, { status: 400 })
  }

  if (movimiento.anulacionDeId) {
    return NextResponse.json({ error: "Este movimiento ya tiene una anulacion asociada" }, { status: 400 })
  }

  if (movimiento.tipo === "ENTRADA" && movimiento.producto.stockActual < movimiento.cantidad) {
    return NextResponse.json({
      error: `No se puede anular. Stock actual (${movimiento.producto.stockActual}) es menor a la cantidad a descontar (${movimiento.cantidad})`
    }, { status: 400 })
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      await tx.movimientoBodega.update({
        where: { id: movimientoId },
        data: { anulado: true, motivoAnulacion: motivo.trim() },
      })

      const tipoInverso = movimiento.tipo === "ENTRADA" ? "SALIDA" : "ENTRADA"
      const movimientoAnulacion = await tx.movimientoBodega.create({
        data: {
          tipo: tipoInverso,
          cantidad: movimiento.cantidad,
          documento: "SIN_DOCUMENTO",
          observacion: `ANULACION: ${motivo.trim()}`,
          productoId: movimiento.productoId,
          usuarioId: parseInt(session.user.id),
          anulado: false,
          anulacionDeId: movimientoId,
        },
      })

      const delta = movimiento.tipo === "ENTRADA" ? -movimiento.cantidad : movimiento.cantidad
      await tx.productoBodega.update({
        where: { id: movimiento.productoId },
        data: { stockActual: { increment: delta } },
      })

      return movimientoAnulacion
    })

    return NextResponse.json(resultado, { status: 201 })
  } catch (error) {
    if (error instanceof Error && !("code" in error)) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("[bodega/anular] error:", error)
    return NextResponse.json({ error: "Error al anular movimiento" }, { status: 500 })
  }
}
