import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const auth = await requireRole("ADMIN")
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const desde = searchParams.get("desde")
  const hasta = searchParams.get("hasta")

  // Rango por defecto: mes actual
  const ahora = new Date()
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const fechaDesde = desde ? new Date(desde) : inicioMes
  const fechaHasta = hasta ? new Date(hasta + "T23:59:59") : ahora

  const [usuarios, movsBodega, movsFarmacia] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, username: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.movimientoBodega.findMany({
      where: {
        fecha: { gte: fechaDesde, lte: fechaHasta },
        anulacionDeId: null,
      },
      select: {
        usuarioId: true,
        tipo: true,
        anulado: true,
        productoId: true,
        fecha: true,
      },
    }),
    prisma.movimientoFarmacia.findMany({
      where: {
        fecha: { gte: fechaDesde, lte: fechaHasta },
        anulacionDeId: null,
      },
      select: {
        usuarioId: true,
        tipo: true,
        anulado: true,
        medicamentoId: true,
        fecha: true,
      },
    }),
  ])

  const actividad = usuarios.map((u) => {
    const mb = movsBodega.filter((m) => m.usuarioId === u.id)
    const mf = movsFarmacia.filter((m) => m.usuarioId === u.id)

    const bodega = {
      total: mb.length,
      entradas: mb.filter((m) => m.tipo === "ENTRADA" && !m.anulado).length,
      salidas: mb.filter((m) => m.tipo === "SALIDA" && !m.anulado).length,
      ajustes: mb.filter((m) => m.tipo === "AJUSTE" && !m.anulado).length,
      anulados: mb.filter((m) => m.anulado).length,
      productosUnicos: new Set(mb.map((m) => m.productoId)).size,
    }

    const farmacia = {
      total: mf.length,
      entradas: mf.filter((m) => m.tipo === "ENTRADA" && !m.anulado).length,
      despachos: mf.filter((m) => m.tipo === "SALIDA" && !m.anulado).length,
      ajustes: mf.filter((m) => m.tipo === "AJUSTE" && !m.anulado).length,
      anulados: mf.filter((m) => m.anulado).length,
      medicamentosUnicos: new Set(mf.map((m) => m.medicamentoId)).size,
    }

    // Último movimiento
    const todosMovs = [
      ...mb.map((m) => m.fecha),
      ...mf.map((m) => m.fecha),
    ].sort((a, b) => b.getTime() - a.getTime())

    return {
      usuario: { id: u.id, name: u.name, username: u.username, role: u.role },
      bodega,
      farmacia,
      totalMovimientos: bodega.total + farmacia.total,
      ultimoMovimiento: todosMovs[0] ?? null,
    }
  })

  // Ordenar por total de movimientos desc
  actividad.sort((a, b) => b.totalMovimientos - a.totalMovimientos)

  return NextResponse.json({
    desde: fechaDesde,
    hasta: fechaHasta,
    actividad,
  })
}
