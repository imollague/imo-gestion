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

  // Ajustes, mermas y retiros sanitarios nacen de un acta o de un conteo: se corrigen con un nuevo ajuste, no revirtiéndolos
  if (movimiento.tipo !== "ENTRADA" && movimiento.tipo !== "SALIDA") {
    return NextResponse.json({
      error: "Solo se pueden anular entradas y salidas. Para corregir un ajuste, merma o retiro registra un ajuste de stock.",
    }, { status: 400 })
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // Marca como anulado solo si sigue vigente: evita anular dos veces con clics simultáneos
      const marcado = await tx.movimientoBodega.updateMany({
        where: { id: movimientoId, anulado: false },
        data: { anulado: true, motivoAnulacion: motivo.trim() },
      })
      if (marcado.count === 0) throw new Error("Este movimiento ya fue anulado")

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

      if (movimiento.tipo === "ENTRADA") {
        // Descuento condicional dentro de la transacción: el stock actual debe cubrir lo que se revierte
        const descontado = await tx.productoBodega.updateMany({
          where: { id: movimiento.productoId, stockActual: { gte: movimiento.cantidad } },
          data: { stockActual: { decrement: movimiento.cantidad } },
        })
        if (descontado.count === 0) {
          throw new Error("No se puede anular: el stock actual es menor a la cantidad a descontar.")
        }
      } else {
        await tx.productoBodega.update({
          where: { id: movimiento.productoId },
          data: { stockActual: { increment: movimiento.cantidad } },
        })
      }

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
