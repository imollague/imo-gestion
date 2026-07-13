import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { TipoMovimiento } from "@/generated/prisma/client"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("ADMIN", "FARMACIA")
  if (!auth.ok) return auth.response
  const { session } = auth

  const { id } = await params
  const movimientoId = parseInt(id)
  const body = await req.json()
  const { motivo } = body

  if (!motivo?.trim()) {
    return NextResponse.json({ error: "El motivo de anulacion es obligatorio" }, { status: 400 })
  }

  const movimiento = await prisma.movimientoFarmacia.findUnique({
    where: { id: movimientoId },
    include: { medicamento: true },
  })

  if (!movimiento) return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 })
  if (movimiento.anulado) return NextResponse.json({ error: "Este movimiento ya fue anulado" }, { status: 400 })

  if (movimiento.tipo === TipoMovimiento.ENTRADA && movimiento.medicamento.stockActual < movimiento.cantidad) {
    return NextResponse.json({
      error: `No se puede anular. Stock actual (${movimiento.medicamento.stockActual}) es menor a la cantidad a descontar (${movimiento.cantidad})`
    }, { status: 400 })
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      await tx.movimientoFarmacia.update({
        where: { id: movimientoId },
        data: { anulado: true, motivoAnulacion: motivo.trim() },
      })

      const tipoInverso = movimiento.tipo === TipoMovimiento.ENTRADA
        ? TipoMovimiento.SALIDA
        : TipoMovimiento.ENTRADA

      const movimientoAnulacion = await tx.movimientoFarmacia.create({
        data: {
          tipo: tipoInverso,
          cantidad: movimiento.cantidad,
          observacion: `ANULACION: ${motivo.trim()}`,
          medicamentoId: movimiento.medicamentoId,
          usuarioId: parseInt(session.user.id),
          anulado: false,
          anulacionDeId: movimientoId,
        },
      })

      const delta = movimiento.tipo === TipoMovimiento.ENTRADA
        ? -movimiento.cantidad
        : movimiento.cantidad

      await tx.medicamento.update({
        where: { id: movimiento.medicamentoId },
        data: { stockActual: { increment: delta } },
      })

      // Revertir lote si la entrada tenía lote asociado
      if (movimiento.tipo === TipoMovimiento.ENTRADA && movimiento.lote) {
        const loteExistente = await tx.loteFarmacia.findFirst({
          where: { medicamentoId: movimiento.medicamentoId, numeroLote: movimiento.lote, retirado: false },
        })
        if (loteExistente) {
          const nuevoStock = loteExistente.stockActual - movimiento.cantidad
          if (nuevoStock <= 0) {
            await tx.loteFarmacia.delete({ where: { id: loteExistente.id } })
          } else {
            await tx.loteFarmacia.update({
              where: { id: loteExistente.id },
              data: { stockActual: nuevoStock },
            })
          }
        }
      }

      return movimientoAnulacion
    })

    return NextResponse.json(resultado, { status: 201 })
  } catch (error) {
    if (error instanceof Error && !("code" in error)) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("[farmacia/anular] error:", error)
    return NextResponse.json({ error: "Error al anular movimiento" }, { status: 500 })
  }
}
