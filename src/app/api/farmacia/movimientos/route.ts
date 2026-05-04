import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireRole } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { TipoMovimiento } from "@/generated/prisma/client"

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get("tipo")
  const desde = searchParams.get("desde")
  const hasta = searchParams.get("hasta")
  const medicamentoId = searchParams.get("medicamentoId")
  const busqueda = searchParams.get("busqueda")
  const pagina = parseInt(searchParams.get("pagina") ?? "1")
  const limite = parseInt(searchParams.get("limite") ?? "50")
  const skip = (pagina - 1) * limite

  const where = {
    ...(tipo && { tipo: tipo as TipoMovimiento }),
    ...(medicamentoId && { medicamentoId: parseInt(medicamentoId) }),
    ...(desde || hasta ? {
      fecha: {
        ...(desde && { gte: new Date(desde) }),
        ...(hasta && { lte: new Date(hasta + "T23:59:59") }),
      }
    } : {}),
    ...(busqueda ? {
      OR: [
        { medicamento: { nombreGenerico: { contains: busqueda, mode: "insensitive" as const } } },
        { medicamento: { codigo: { contains: busqueda, mode: "insensitive" as const } } },
        { proveedor: { contains: busqueda, mode: "insensitive" as const } },
        { rutPaciente: { contains: busqueda, mode: "insensitive" as const } },
      ]
    } : {}),
  }

  const [movimientos, total, totalVigentes] = await Promise.all([
    prisma.movimientoFarmacia.findMany({
      where,
      include: {
        medicamento: {
          select: {
            id: true, codigo: true, nombreGenerico: true,
            nombreComercial: true, unidad: true,
            concentracion: true, formaFarmaceutica: true,
          },
        },
        usuario: { select: { id: true, name: true, username: true } },
      },
      orderBy: { fecha: "desc" },
      skip,
      take: limite,
    }),
    prisma.movimientoFarmacia.count({ where }),
    prisma.movimientoFarmacia.count({
      where: { ...where, anulado: false, anulacionDeId: null }
    }),
  ])

  return NextResponse.json({ movimientos, total, totalVigentes, pagina, limite, totalPaginas: Math.ceil(total / limite) })
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN", "FARMACIA")
  if (!auth.ok) return auth.response
  const { session } = auth

  const body = await req.json()
  const { tipo, cantidad, stockReal, lote, fechaVencimiento, proveedor, rutPaciente, pacienteId, observacion, medicamentoId } = body

  if (!tipo || !medicamentoId) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
  }

  if (tipo === TipoMovimiento.AJUSTE) {
    if (stockReal === undefined || stockReal === null || stockReal < 0) {
      return NextResponse.json({ error: "El stock real contado es requerido y debe ser mayor o igual a 0" }, { status: 400 })
    }
    if (!observacion) {
      return NextResponse.json({ error: "El motivo del ajuste es obligatorio" }, { status: 400 })
    }
  } else {
    if (!cantidad || cantidad <= 0) {
      return NextResponse.json({ error: "La cantidad debe ser mayor a 0" }, { status: 400 })
    }
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const medicamento = await tx.medicamento.findUnique({ where: { id: medicamentoId } })
      if (!medicamento || !medicamento.activo) throw new Error("Medicamento no encontrado o inactivo")

      // ── AJUSTE ──────────────────────────────────────────
      if (tipo === TipoMovimiento.AJUSTE) {
        const diferencia = stockReal - medicamento.stockActual
        if (diferencia === 0) throw new Error("El stock real coincide con el sistema, no es necesario ajustar")

        const movimiento = await tx.movimientoFarmacia.create({
          data: {
            tipo: TipoMovimiento.AJUSTE,
            cantidad: Math.abs(diferencia),
            observacion: `[AJUSTE] Stock anterior: ${medicamento.stockActual} → Stock real: ${stockReal}. Motivo: ${observacion}`,
            medicamentoId,
            usuarioId: parseInt(session.user.id),
          },
        })

        await tx.medicamento.update({
          where: { id: medicamentoId },
          data: { stockActual: stockReal },
        })

        return movimiento
      }

      // ── SALIDA ───────────────────────────────────────────
      if (tipo === TipoMovimiento.SALIDA) {
        if (medicamento.stockActual < cantidad) {
          throw new Error(`Stock insuficiente. Stock actual: ${medicamento.stockActual}`)
        }

        // Descontar del lote más antiguo con stock disponible (FIFO automático)
        const lotes = await tx.loteFarmacia.findMany({
          where: { medicamentoId, stockActual: { gt: 0 }, retirado: false },
          orderBy: { fechaIngreso: "asc" },
        })

        let restante = cantidad
        for (const loteItem of lotes) {
          if (restante <= 0) break
          const descontar = Math.min(loteItem.stockActual, restante)
          await tx.loteFarmacia.update({
            where: { id: loteItem.id },
            data: { stockActual: { decrement: descontar } },
          })
          restante -= descontar
        }

        const movimiento = await tx.movimientoFarmacia.create({
          data: {
            tipo, cantidad, rutPaciente, observacion, medicamentoId,
            usuarioId: parseInt(session.user.id),
            ...(pacienteId ? { pacienteId } : {}),
          },
        })

        await tx.medicamento.update({
          where: { id: medicamentoId },
          data: { stockActual: { decrement: cantidad } },
        })

        return movimiento
      }

      // ── ENTRADA ──────────────────────────────────────────
      const movimiento = await tx.movimientoFarmacia.create({
        data: {
          tipo, cantidad, lote,
          fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
          proveedor, observacion, medicamentoId,
          usuarioId: parseInt(session.user.id),
        },
      })

      // Crear lote si viene con número de lote
      if (lote) {
        const loteExistente = await tx.loteFarmacia.findFirst({
          where: { medicamentoId, numeroLote: lote, retirado: false },
        })

        if (loteExistente) {
          await tx.loteFarmacia.update({
            where: { id: loteExistente.id },
            data: { stockActual: { increment: cantidad } },
          })
        } else {
          await tx.loteFarmacia.create({
            data: {
              medicamentoId,
              numeroLote: lote,
              fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
              stockInicial: cantidad,
              stockActual: cantidad,
              proveedor,
            },
          })
        }
      }

      await tx.medicamento.update({
        where: { id: medicamentoId },
        data: { stockActual: { increment: cantidad } },
      })

      return movimiento
    })

    return NextResponse.json(resultado, { status: 201 })
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error al registrar movimiento"
    return NextResponse.json({ error: mensaje }, { status: 400 })
  }
}
