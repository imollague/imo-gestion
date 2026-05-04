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
  const loteId = parseInt(id)
  const body = await req.json()
  const { motivo } = body

  if (!motivo?.trim()) {
    return NextResponse.json({ error: "El motivo de retiro es obligatorio" }, { status: 400 })
  }

  const lote = await prisma.loteFarmacia.findUnique({
    where: { id: loteId },
    include: { medicamento: true },
  })

  if (!lote) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 })
  if (lote.retirado) return NextResponse.json({ error: "Este lote ya fue retirado" }, { status: 400 })

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const cantidadRetirar = lote.stockActual

      await tx.loteFarmacia.update({
        where: { id: loteId },
        data: {
          retirado: true,
          motivoRetiro: motivo.trim(),
          fechaRetiro: new Date(),
          stockActual: 0,
        },
      })

      let movimiento = null
      if (cantidadRetirar > 0) {
        movimiento = await tx.movimientoFarmacia.create({
          data: {
            tipo: TipoMovimiento.SALIDA,
            cantidad: cantidadRetirar,
            lote: lote.numeroLote,
            observacion: `[RETIRO DE LOTE] Lote: ${lote.numeroLote}. Motivo: ${motivo.trim()}`,
            medicamentoId: lote.medicamentoId,
            usuarioId: parseInt(session.user.id),
          },
        })

        await tx.medicamento.update({
          where: { id: lote.medicamentoId },
          data: { stockActual: { decrement: cantidadRetirar } },
        })
      }

      return { lote, movimiento, cantidadRetirada: cantidadRetirar }
    })

    return NextResponse.json(resultado, { status: 200 })
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error al retirar lote"
    return NextResponse.json({ error: mensaje }, { status: 400 })
  }
}
