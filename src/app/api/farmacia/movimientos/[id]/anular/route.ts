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
  })

  if (!movimiento) return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 })
  if (movimiento.anulado) return NextResponse.json({ error: "Este movimiento ya fue anulado" }, { status: 400 })
  if (movimiento.anulacionDeId) {
    return NextResponse.json({ error: "Este movimiento es una anulación y no se puede anular" }, { status: 400 })
  }

  // Ajustes, mermas y retiros sanitarios nacen de un acta o de un conteo: se corrigen con un nuevo ajuste, no revirtiéndolos
  if (movimiento.tipo !== TipoMovimiento.ENTRADA && movimiento.tipo !== TipoMovimiento.SALIDA) {
    return NextResponse.json({
      error: "Solo se pueden anular entradas y despachos. Para corregir un ajuste, merma o retiro registra un ajuste de stock.",
    }, { status: 400 })
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // Marca como anulado solo si sigue vigente: evita anular dos veces con clics simultáneos
      const marcado = await tx.movimientoFarmacia.updateMany({
        where: { id: movimientoId, anulado: false },
        data: { anulado: true, motivoAnulacion: motivo.trim() },
      })
      if (marcado.count === 0) throw new Error("Este movimiento ya fue anulado")

      if (movimiento.tipo === TipoMovimiento.ENTRADA) {
        // El lote creado por la entrada debe seguir disponible y sin haberse consumido
        if (movimiento.lote) {
          const lote = await tx.loteFarmacia.findFirst({
            where: { medicamentoId: movimiento.medicamentoId, numeroLote: movimiento.lote, retirado: false },
          })
          if (!lote) {
            throw new Error(`No se puede anular: el lote ${movimiento.lote} ya fue retirado o no existe. Registra un ajuste de stock.`)
          }
          if (lote.stockActual < movimiento.cantidad) {
            throw new Error(`No se puede anular: del lote ${movimiento.lote} quedan ${lote.stockActual}, menos de los ${movimiento.cantidad} ingresados (ya se despachó parte).`)
          }
          if (lote.stockActual === movimiento.cantidad && lote.stockInicial === movimiento.cantidad) {
            await tx.loteFarmacia.delete({ where: { id: lote.id } }) // lote creado solo por esta entrada
          } else {
            await tx.loteFarmacia.update({
              where: { id: lote.id },
              data: { stockActual: { decrement: movimiento.cantidad } },
            })
          }
        }

        const descontado = await tx.medicamento.updateMany({
          where: { id: movimiento.medicamentoId, stockActual: { gte: movimiento.cantidad } },
          data: { stockActual: { decrement: movimiento.cantidad } },
        })
        if (descontado.count === 0) {
          throw new Error("No se puede anular: el stock actual es menor a la cantidad a descontar.")
        }
      } else {
        // SALIDA: el stock vuelve al lote del que salió
        if (movimiento.lote) {
          const lote = await tx.loteFarmacia.findFirst({
            where: { medicamentoId: movimiento.medicamentoId, numeroLote: movimiento.lote },
            orderBy: { id: "desc" },
          })
          if (!lote || lote.retirado) {
            throw new Error(`No se puede anular: el lote ${movimiento.lote} fue retirado o no existe. Registra un ajuste de stock.`)
          }
          await tx.loteFarmacia.update({
            where: { id: lote.id },
            data: { stockActual: { increment: movimiento.cantidad } },
          })
        }

        await tx.medicamento.update({
          where: { id: movimiento.medicamentoId },
          data: { stockActual: { increment: movimiento.cantidad } },
        })
      }

      return tx.movimientoFarmacia.create({
        data: {
          tipo: movimiento.tipo === TipoMovimiento.ENTRADA ? TipoMovimiento.SALIDA : TipoMovimiento.ENTRADA,
          cantidad: movimiento.cantidad,
          observacion: `ANULACION: ${motivo.trim()}`,
          medicamentoId: movimiento.medicamentoId,
          usuarioId: parseInt(session.user.id),
          anulado: false,
          anulacionDeId: movimientoId,
        },
      })
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
