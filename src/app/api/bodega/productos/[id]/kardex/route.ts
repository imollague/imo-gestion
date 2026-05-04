import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const desde = searchParams.get("desde")
  const hasta = searchParams.get("hasta")

  const producto = await prisma.productoBodega.findUnique({
    where: { id: parseInt(id) },
    select: { id: true, nombre: true, codigo: true, unidad: true, stockActual: true },
  })

  if (!producto) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })

  const where: Record<string, unknown> = {
    productoId: parseInt(id),
    anulado: false,
    anulacionDeId: null,
  }
  if (desde || hasta) {
    where.fecha = {
      ...(desde ? { gte: new Date(desde) } : {}),
      ...(hasta ? { lte: new Date(hasta + "T23:59:59") } : {}),
    }
  }

  const movimientos = await prisma.movimientoBodega.findMany({
    where,
    orderBy: { fecha: "asc" },
    select: {
      id: true,
      tipo: true,
      cantidad: true,
      documento: true,
      numeroDocumento: true,
      proveedor: true,
      destinatario: true,
      area: true,
      observacion: true,
      fecha: true,
      usuario: { select: { name: true } },
    },
  })

  // Si hay filtro de fecha, calcular saldo inicial antes del período
  let saldoInicial = 0
  if (desde) {
    const movimientosAnteriores = await prisma.movimientoBodega.findMany({
      where: {
        productoId: parseInt(id),
        anulado: false,
        anulacionDeId: null,
        fecha: { lt: new Date(desde) },
      },
      orderBy: { fecha: "asc" },
      select: { tipo: true, cantidad: true, observacion: true },
    })
    saldoInicial = calcularSaldo(movimientosAnteriores, 0)
  }

  let saldo = saldoInicial
  const kardex = movimientos.map((m) => {
    const delta = calcularDelta(m.tipo, m.cantidad, m.observacion)
    saldo += delta

    return {
      id: m.id,
      fecha: m.fecha,
      tipo: m.tipo,
      documento: m.documento,
      numeroDocumento: m.numeroDocumento,
      proveedor: m.proveedor,
      destinatario: m.destinatario,
      area: m.area,
      observacion: m.observacion,
      usuario: m.usuario.name,
      entradas: m.tipo === "ENTRADA" ? m.cantidad : null,
      salidas: m.tipo === "SALIDA" ? m.cantidad : null,
      ajuste: m.tipo === "AJUSTE" ? delta : null,
      saldo,
    }
  })

  return NextResponse.json({
    producto,
    saldoInicial,
    kardex,
  })
}

function calcularDelta(
  tipo: string,
  cantidad: number,
  observacion: string | null
): number {
  if (tipo === "ENTRADA") return cantidad
  if (tipo === "SALIDA") return -cantidad
  // AJUSTE: extraer signo desde observacion "[AJUSTE] Stock anterior: X → Stock real: Y"
  if (tipo === "AJUSTE" && observacion) {
    const match = observacion.match(/Stock anterior:\s*(\d+)\s*→\s*Stock real:\s*(\d+)/)
    if (match) {
      const anterior = parseInt(match[1])
      const real = parseInt(match[2])
      return real - anterior
    }
  }
  return 0
}

function calcularSaldo(
  movimientos: { tipo: string; cantidad: number; observacion: string | null }[],
  base: number
): number {
  return movimientos.reduce((acc, m) => acc + calcularDelta(m.tipo, m.cantidad, m.observacion), base)
}
