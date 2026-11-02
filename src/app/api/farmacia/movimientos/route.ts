import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { TipoMovimiento } from "@/generated/prisma/client"
import { descontarStockLotes, ROLES_LECTURA_FARMACIA } from "@/lib/farmaciaLotes"

export async function GET(req: NextRequest) {
  const auth = await requireRole(...ROLES_LECTURA_FARMACIA)
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

  // El RUT del paciente solo lo ven quienes operan la farmacia
  const puedeVerPacientes = auth.session.user.role !== "VIEWER"
  const salida = puedeVerPacientes ? movimientos : movimientos.map((m) => ({ ...m, rutPaciente: null }))

  return NextResponse.json({ movimientos: salida, total, totalVigentes, pagina, limite, totalPaginas: Math.ceil(total / limite) })
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
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      return NextResponse.json({ error: "La cantidad debe ser un número entero mayor a 0" }, { status: 400 })
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

        // Si el ajuste baja el stock, la baja sale también de los lotes (lo "sin lote" primero, luego los que vencen antes)
        if (diferencia < 0) {
          await descontarStockLotes(tx, medicamento, -diferencia, { incluirVencidos: true })
        }

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

      // ── SALIDA (despacho) ────────────────────────────────
      if (tipo === TipoMovimiento.SALIDA) {
        // FEFO: sale primero el lote que vence antes; los lotes vencidos no se despachan
        const asignaciones = await descontarStockLotes(tx, medicamento, cantidad, { incluirVencidos: false })

        // Descuento condicional: si otro despacho simultáneo ya consumió el stock, no deja negativos
        const descontado = await tx.medicamento.updateMany({
          where: { id: medicamentoId, stockActual: { gte: cantidad } },
          data: { stockActual: { decrement: cantidad } },
        })
        if (descontado.count === 0) throw new Error("Stock insuficiente. Intenta nuevamente.")

        // Un movimiento por lote usado, para que el kardex y la anulación sepan de qué lote salió cada parte
        const movimientos = []
        for (const a of asignaciones) {
          movimientos.push(await tx.movimientoFarmacia.create({
            data: {
              tipo, cantidad: a.cantidad, rutPaciente, observacion, medicamentoId,
              lote: a.lote?.numeroLote ?? null,
              fechaVencimiento: a.lote?.fechaVencimiento ?? null,
              usuarioId: parseInt(session.user.id),
              ...(pacienteId ? { pacienteId } : {}),
            },
          }))
        }

        return { ...movimientos[0], movimientos }
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
    if (error instanceof Error && !("code" in error)) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("[farmacia/movimientos] error:", error)
    return NextResponse.json({ error: "Error al registrar movimiento" }, { status: 500 })
  }
}
