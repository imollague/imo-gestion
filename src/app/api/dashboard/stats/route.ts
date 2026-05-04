import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { TipoMovimiento } from "@/generated/prisma/client"

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const dias = parseInt(searchParams.get("dias") ?? "30")

  const desde = new Date()
  desde.setDate(desde.getDate() - dias)

  const ahora = new Date()
  const en30dias = new Date()
  en30dias.setDate(en30dias.getDate() + 30)

  // ── Movimientos del período ──────────────────────────
  const [movimientosBodega, movimientosFarmacia] = await Promise.all([
    prisma.movimientoBodega.findMany({
      where: { fecha: { gte: desde }, anulado: false, anulacionDeId: null },
      select: { tipo: true, cantidad: true, fecha: true },
      orderBy: { fecha: "asc" },
    }),
    prisma.movimientoFarmacia.findMany({
      where: { fecha: { gte: desde }, anulado: false, anulacionDeId: null },
      select: { tipo: true, cantidad: true, fecha: true },
      orderBy: { fecha: "asc" },
    }),
  ])

  // ── Conteos generales ────────────────────────────────
  const [totalProductos, totalMedicamentos] = await Promise.all([
    prisma.productoBodega.count({ where: { activo: true } }),
    prisma.medicamento.count({ where: { activo: true } }),
  ])

  // ── Stock bajo ───────────────────────────────────────
  const [productos, medicamentos] = await Promise.all([
    prisma.productoBodega.findMany({
      where: { activo: true },
      select: { stockActual: true, stockMinimo: true },
    }),
    prisma.medicamento.findMany({
      where: { activo: true },
      select: { stockActual: true, stockMinimo: true },
    }),
  ])

  const productosStockBajo = productos.filter((p) => p.stockActual <= p.stockMinimo && p.stockMinimo > 0).length
  const medicamentosStockBajo = medicamentos.filter((m) => m.stockActual <= m.stockMinimo && m.stockMinimo > 0).length
  const productosAgotados = productos.filter((p) => p.stockActual === 0).length
  const medicamentosAgotados = medicamentos.filter((m) => m.stockActual === 0).length

  // ── Lotes farmacia (usando LoteFarmacia) ─────────────
  const [lotesVencidos, lotesPorVencer] = await Promise.all([
    prisma.loteFarmacia.count({
      where: {
        retirado: false,
        stockActual: { gt: 0 },
        fechaVencimiento: { lt: ahora },
      },
    }),
    prisma.loteFarmacia.count({
      where: {
        retirado: false,
        stockActual: { gt: 0 },
        fechaVencimiento: { gte: ahora, lte: en30dias },
      },
    }),
  ])

  // ── Desglose movimientos del período ─────────────────
  const entradasBodega = movimientosBodega.filter((m) => m.tipo === TipoMovimiento.ENTRADA).length
  const salidasBodega = movimientosBodega.filter((m) => m.tipo === TipoMovimiento.SALIDA).length
  const ajustesBodega = movimientosBodega.filter((m) => m.tipo === TipoMovimiento.AJUSTE).length
  const entradasFarmacia = movimientosFarmacia.filter((m) => m.tipo === TipoMovimiento.ENTRADA).length
  const despachosFarmacia = movimientosFarmacia.filter((m) => m.tipo === TipoMovimiento.SALIDA).length
  const ajustesFarmacia = movimientosFarmacia.filter((m) => m.tipo === TipoMovimiento.AJUSTE).length

  // ── Último movimiento de cada módulo ─────────────────
  const [ultimoMovBodega, ultimoMovFarmacia] = await Promise.all([
    prisma.movimientoBodega.findFirst({
      where: { anulado: false, anulacionDeId: null },
      orderBy: { fecha: "desc" },
      select: { fecha: true, tipo: true, producto: { select: { nombre: true } } },
    }),
    prisma.movimientoFarmacia.findFirst({
      where: { anulado: false, anulacionDeId: null },
      orderBy: { fecha: "desc" },
      select: { fecha: true, tipo: true, medicamento: { select: { nombreGenerico: true } } },
    }),
  ])

  // ── Gráfico por día ───────────────────────────────────
  const agruparPorDia = (movs: { tipo: string; cantidad: number; fecha: Date }[]) => {
    const mapa: Record<string, { fecha: string; entradas: number; salidas: number; ajustes: number }> = {}
    movs.forEach((m) => {
      const fecha = m.fecha.toISOString().split("T")[0]
      if (!mapa[fecha]) mapa[fecha] = { fecha, entradas: 0, salidas: 0, ajustes: 0 }
      if (m.tipo === TipoMovimiento.ENTRADA) mapa[fecha].entradas += m.cantidad
      else if (m.tipo === TipoMovimiento.SALIDA) mapa[fecha].salidas += m.cantidad
      else if (m.tipo === TipoMovimiento.AJUSTE) mapa[fecha].ajustes += m.cantidad
    })
    return Object.values(mapa)
  }

  // ── Top 5 productos más movidos ───────────────────────
  const topProductosBodega = await prisma.movimientoBodega.groupBy({
    by: ["productoId"],
    where: { fecha: { gte: desde }, anulado: false, anulacionDeId: null },
    _sum: { cantidad: true },
    orderBy: { _sum: { cantidad: "desc" } },
    take: 5,
  })

  const topProductosConNombre = await Promise.all(
    topProductosBodega.map(async (p) => {
      const producto = await prisma.productoBodega.findUnique({
        where: { id: p.productoId },
        select: { nombre: true },
      })
      return { nombre: producto?.nombre ?? "Desconocido", cantidad: p._sum.cantidad ?? 0 }
    })
  )

  // ── Top 5 medicamentos más despachados ────────────────
  const topMedicamentos = await prisma.movimientoFarmacia.groupBy({
    by: ["medicamentoId"],
    where: { fecha: { gte: desde }, tipo: TipoMovimiento.SALIDA, anulado: false, anulacionDeId: null },
    _sum: { cantidad: true },
    orderBy: { _sum: { cantidad: "desc" } },
    take: 5,
  })

  const topMedicamentosConNombre = await Promise.all(
    topMedicamentos.map(async (m) => {
      const medicamento = await prisma.medicamento.findUnique({
        where: { id: m.medicamentoId },
        select: { nombreGenerico: true },
      })
      return { nombre: medicamento?.nombreGenerico ?? "Desconocido", cantidad: m._sum.cantidad ?? 0 }
    })
  )

  return NextResponse.json({
    resumen: {
      // Inventario
      totalProductos,
      totalMedicamentos,
      productosStockBajo,
      medicamentosStockBajo,
      productosAgotados,
      medicamentosAgotados,
      // Farmacia lotes
      lotesVencidos,
      lotesPorVencer,
      // Movimientos del período
      totalMovimientosBodega: movimientosBodega.length,
      totalMovimientosFarmacia: movimientosFarmacia.length,
      entradasBodega,
      salidasBodega,
      ajustesBodega,
      entradasFarmacia,
      despachosFarmacia,
      ajustesFarmacia,
      // Último movimiento
      ultimoMovBodega: ultimoMovBodega
        ? { fecha: ultimoMovBodega.fecha, tipo: ultimoMovBodega.tipo, nombre: ultimoMovBodega.producto.nombre }
        : null,
      ultimoMovFarmacia: ultimoMovFarmacia
        ? { fecha: ultimoMovFarmacia.fecha, tipo: ultimoMovFarmacia.tipo, nombre: ultimoMovFarmacia.medicamento.nombreGenerico }
        : null,
    },
    graficoBodega: agruparPorDia(movimientosBodega),
    graficoFarmacia: agruparPorDia(movimientosFarmacia),
    topProductosBodega: topProductosConNombre,
    topMedicamentos: topMedicamentosConNombre,
  })
}
