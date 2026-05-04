import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { TipoMovimiento } from "@/generated/prisma/client"

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const desde = searchParams.get("desde")
  const hasta = searchParams.get("hasta")

  if (!desde || !hasta) {
    return NextResponse.json({ error: "Parametros desde y hasta requeridos" }, { status: 400 })
  }

  const fechaDesde = new Date(desde)
  const fechaHasta = new Date(hasta + "T23:59:59")

  const where = {
    fecha: { gte: fechaDesde, lte: fechaHasta },
    anulado: false,
    anulacionDeId: null,
  }

  const movimientos = await prisma.movimientoFarmacia.findMany({
    where,
    include: {
      medicamento: { select: { id: true, nombreGenerico: true, unidad: true, categoria: { select: { nombre: true } } } },
      usuario: { select: { id: true, name: true } },
    },
    orderBy: { fecha: "asc" },
  })

  // ── Consumo por medicamento ──────────────────────────
  const consumoMap: Record<number, { id: number; nombre: string; unidad: string; categoria: string; totalDespachos: number; totalEntradas: number; ajustes: number }> = {}

  movimientos.forEach((m) => {
    const mid = m.medicamentoId
    if (!consumoMap[mid]) {
      consumoMap[mid] = {
        id: mid,
        nombre: m.medicamento.nombreGenerico,
        unidad: m.medicamento.unidad,
        categoria: m.medicamento.categoria.nombre,
        totalDespachos: 0,
        totalEntradas: 0,
        ajustes: 0,
      }
    }
    if (m.tipo === TipoMovimiento.SALIDA) consumoMap[mid].totalDespachos += m.cantidad
    else if (m.tipo === TipoMovimiento.ENTRADA) consumoMap[mid].totalEntradas += m.cantidad
    else if (m.tipo === TipoMovimiento.AJUSTE) consumoMap[mid].ajustes += m.cantidad
  })

  const consumoPorMedicamento = Object.values(consumoMap)
    .sort((a, b) => b.totalDespachos - a.totalDespachos)

  // ── Evolución por día ────────────────────────────────
  const evolucionMap: Record<string, { fecha: string; entradas: number; despachos: number; ajustes: number }> = {}

  movimientos.forEach((m) => {
    const fecha = m.fecha.toISOString().split("T")[0]
    if (!evolucionMap[fecha]) evolucionMap[fecha] = { fecha, entradas: 0, despachos: 0, ajustes: 0 }
    if (m.tipo === TipoMovimiento.ENTRADA) evolucionMap[fecha].entradas += m.cantidad
    else if (m.tipo === TipoMovimiento.SALIDA) evolucionMap[fecha].despachos += m.cantidad
    else if (m.tipo === TipoMovimiento.AJUSTE) evolucionMap[fecha].ajustes += m.cantidad
  })

  const evolucionPorDia = Object.values(evolucionMap)

  // ── Distribución por categoría ───────────────────────
  const categoriaMap: Record<string, number> = {}
  movimientos
    .filter((m) => m.tipo === TipoMovimiento.SALIDA)
    .forEach((m) => {
      const cat = m.medicamento.categoria.nombre
      categoriaMap[cat] = (categoriaMap[cat] || 0) + m.cantidad
    })

  const porCategoria = Object.entries(categoriaMap)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)

  // ── Entradas vs despachos por mes ────────────────────
  const mesMap: Record<string, { mes: string; entradas: number; despachos: number }> = {}
  movimientos.forEach((m) => {
    const d = m.fecha
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (!mesMap[mes]) mesMap[mes] = { mes, entradas: 0, despachos: 0 }
    if (m.tipo === TipoMovimiento.ENTRADA) mesMap[mes].entradas += m.cantidad
    else if (m.tipo === TipoMovimiento.SALIDA) mesMap[mes].despachos += m.cantidad
  })

  const entradasVsDespachos = Object.values(mesMap).sort((a, b) => a.mes.localeCompare(b.mes))

  // ── Movimientos por usuario ──────────────────────────
  const usuarioMap: Record<number, { nombre: string; entradas: number; despachos: number; ajustes: number; total: number }> = {}
  movimientos.forEach((m) => {
    const uid = m.usuarioId
    if (!usuarioMap[uid]) usuarioMap[uid] = { nombre: m.usuario.name, entradas: 0, despachos: 0, ajustes: 0, total: 0 }
    if (m.tipo === TipoMovimiento.ENTRADA) usuarioMap[uid].entradas++
    else if (m.tipo === TipoMovimiento.SALIDA) usuarioMap[uid].despachos++
    else if (m.tipo === TipoMovimiento.AJUSTE) usuarioMap[uid].ajustes++
    usuarioMap[uid].total++
  })

  const porUsuario = Object.values(usuarioMap).sort((a, b) => b.total - a.total)

  // ── Stock crítico actual ─────────────────────────────
  const medicamentosActivos = await prisma.medicamento.findMany({
    where: { activo: true },
    include: { categoria: { select: { nombre: true } } },
    orderBy: { stockActual: "asc" },
  })

  const stockCritico = medicamentosActivos
    .filter((m) => m.stockActual <= m.stockMinimo)
    .map((m) => ({
      id: m.id,
      nombre: m.nombreGenerico,
      categoria: m.categoria.nombre,
      unidad: m.unidad,
      stockActual: m.stockActual,
      stockMinimo: m.stockMinimo,
      agotado: m.stockActual === 0,
    }))

  // ── Lotes por vencer y vencidos ──────────────────────
  const ahora = new Date()
  const en30dias = new Date()
  en30dias.setDate(en30dias.getDate() + 30)

  const [lotesVencidos, lotesPorVencer] = await Promise.all([
    prisma.loteFarmacia.findMany({
      where: { retirado: false, stockActual: { gt: 0 }, fechaVencimiento: { lt: ahora } },
      include: { medicamento: { select: { nombreGenerico: true, unidad: true } } },
      orderBy: { fechaVencimiento: "asc" },
    }),
    prisma.loteFarmacia.findMany({
      where: { retirado: false, stockActual: { gt: 0 }, fechaVencimiento: { gte: ahora, lte: en30dias } },
      include: { medicamento: { select: { nombreGenerico: true, unidad: true } } },
      orderBy: { fechaVencimiento: "asc" },
    }),
  ])

  // ── Resumen general ──────────────────────────────────
  const totalEntradas = movimientos.filter((m) => m.tipo === TipoMovimiento.ENTRADA).reduce((s, m) => s + m.cantidad, 0)
  const totalDespachos = movimientos.filter((m) => m.tipo === TipoMovimiento.SALIDA).reduce((s, m) => s + m.cantidad, 0)
  const totalAjustes = movimientos.filter((m) => m.tipo === TipoMovimiento.AJUSTE).length
  const totalMovimientos = movimientos.length

  return NextResponse.json({
    resumen: { totalMovimientos, totalEntradas, totalDespachos, totalAjustes, stockCritico: stockCritico.length, lotesVencidos: lotesVencidos.length, lotesPorVencer: lotesPorVencer.length },
    consumoPorMedicamento,
    evolucionPorDia,
    porCategoria,
    entradasVsDespachos,
    porUsuario,
    stockCritico,
    lotesVencidos: lotesVencidos.map((l) => ({
      id: l.id,
      numeroLote: l.numeroLote,
      medicamento: l.medicamento.nombreGenerico,
      unidad: l.medicamento.unidad,
      stockActual: l.stockActual,
      fechaVencimiento: l.fechaVencimiento,
    })),
    lotesPorVencer: lotesPorVencer.map((l) => ({
      id: l.id,
      numeroLote: l.numeroLote,
      medicamento: l.medicamento.nombreGenerico,
      unidad: l.medicamento.unidad,
      stockActual: l.stockActual,
      fechaVencimiento: l.fechaVencimiento,
    })),
  })
}
