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

  const movimientos = await prisma.movimientoBodega.findMany({
    where,
    include: {
      producto: { select: { id: true, nombre: true, unidad: true, categoria: { select: { nombre: true } } } },
      usuario: { select: { id: true, name: true } },
    },
    orderBy: { fecha: "asc" },
  })

  // ── Consumo por producto (salidas) ───────────────────
  const consumoMap: Record<number, { id: number; nombre: string; unidad: string; categoria: string; totalSalidas: number; totalEntradas: number; ajustes: number }> = {}

  movimientos.forEach((m) => {
    const pid = m.productoId
    if (!consumoMap[pid]) {
      consumoMap[pid] = {
        id: pid,
        nombre: m.producto.nombre,
        unidad: m.producto.unidad,
        categoria: m.producto.categoria.nombre,
        totalSalidas: 0,
        totalEntradas: 0,
        ajustes: 0,
      }
    }
    if (m.tipo === TipoMovimiento.SALIDA) consumoMap[pid].totalSalidas += m.cantidad
    else if (m.tipo === TipoMovimiento.ENTRADA) consumoMap[pid].totalEntradas += m.cantidad
    else if (m.tipo === TipoMovimiento.AJUSTE) consumoMap[pid].ajustes += m.cantidad
  })

  const consumoPorProducto = Object.values(consumoMap)
    .sort((a, b) => b.totalSalidas - a.totalSalidas)

  // ── Evolución por día ────────────────────────────────
  const evolucionMap: Record<string, { fecha: string; entradas: number; salidas: number; ajustes: number }> = {}

  movimientos.forEach((m) => {
    const fecha = m.fecha.toISOString().split("T")[0]
    if (!evolucionMap[fecha]) evolucionMap[fecha] = { fecha, entradas: 0, salidas: 0, ajustes: 0 }
    if (m.tipo === TipoMovimiento.ENTRADA) evolucionMap[fecha].entradas += m.cantidad
    else if (m.tipo === TipoMovimiento.SALIDA) evolucionMap[fecha].salidas += m.cantidad
    else if (m.tipo === TipoMovimiento.AJUSTE) evolucionMap[fecha].ajustes += m.cantidad
  })

  const evolucionPorDia = Object.values(evolucionMap)

  // ── Distribución por categoría ───────────────────────
  const categoriaMap: Record<string, number> = {}
  movimientos
    .filter((m) => m.tipo === TipoMovimiento.SALIDA)
    .forEach((m) => {
      const cat = m.producto.categoria.nombre
      categoriaMap[cat] = (categoriaMap[cat] || 0) + m.cantidad
    })

  const porCategoria = Object.entries(categoriaMap)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)

  // ── Entradas vs salidas por mes ──────────────────────
  const mesMap: Record<string, { mes: string; entradas: number; salidas: number }> = {}
  movimientos.forEach((m) => {
    const d = m.fecha
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (!mesMap[mes]) mesMap[mes] = { mes, entradas: 0, salidas: 0 }
    if (m.tipo === TipoMovimiento.ENTRADA) mesMap[mes].entradas += m.cantidad
    else if (m.tipo === TipoMovimiento.SALIDA) mesMap[mes].salidas += m.cantidad
  })

  const entradasVsSalidas = Object.values(mesMap).sort((a, b) => a.mes.localeCompare(b.mes))

  // ── Movimientos por usuario ──────────────────────────
  const usuarioMap: Record<number, { nombre: string; entradas: number; salidas: number; ajustes: number; total: number }> = {}
  movimientos.forEach((m) => {
    const uid = m.usuarioId
    if (!usuarioMap[uid]) usuarioMap[uid] = { nombre: m.usuario.name, entradas: 0, salidas: 0, ajustes: 0, total: 0 }
    if (m.tipo === TipoMovimiento.ENTRADA) usuarioMap[uid].entradas++
    else if (m.tipo === TipoMovimiento.SALIDA) usuarioMap[uid].salidas++
    else if (m.tipo === TipoMovimiento.AJUSTE) usuarioMap[uid].ajustes++
    usuarioMap[uid].total++
  })

  const porUsuario = Object.values(usuarioMap).sort((a, b) => b.total - a.total)

  // ── Stock crítico actual ─────────────────────────────
  const productosActivos = await prisma.productoBodega.findMany({
    where: { activo: true },
    include: { categoria: { select: { nombre: true } } },
    orderBy: { stockActual: "asc" },
  })

  const stockCritico = productosActivos
    .filter((p) => p.stockActual <= p.stockMinimo)
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria.nombre,
      unidad: p.unidad,
      stockActual: p.stockActual,
      stockMinimo: p.stockMinimo,
      agotado: p.stockActual === 0,
    }))

  // ── Resumen general ──────────────────────────────────
  const totalEntradas = movimientos.filter((m) => m.tipo === TipoMovimiento.ENTRADA).reduce((s, m) => s + m.cantidad, 0)
  const totalSalidas = movimientos.filter((m) => m.tipo === TipoMovimiento.SALIDA).reduce((s, m) => s + m.cantidad, 0)
  const totalAjustes = movimientos.filter((m) => m.tipo === TipoMovimiento.AJUSTE).length
  const totalMovimientos = movimientos.length

  return NextResponse.json({
    resumen: { totalMovimientos, totalEntradas, totalSalidas, totalAjustes, stockCritico: stockCritico.length },
    consumoPorProducto,
    evolucionPorDia,
    porCategoria,
    entradasVsSalidas,
    porUsuario,
    stockCritico,
  })
}
