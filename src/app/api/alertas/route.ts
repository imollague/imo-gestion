import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const ahora = new Date()
  const en30dias = new Date()
  en30dias.setDate(en30dias.getDate() + 30)

  const [productos, medicamentos, medicamentosPorVencer, vehiculos] = await Promise.all([
    prisma.productoBodega.findMany({
      where: { activo: true },
      select: { stockActual: true, stockMinimo: true },
    }),
    prisma.medicamento.findMany({
      where: { activo: true },
      select: { stockActual: true, stockMinimo: true },
    }),
    prisma.loteFarmacia.count({
      where: {
        retirado: false,
        stockActual: { gt: 0 },
        fechaVencimiento: { gte: ahora, lte: en30dias },
      },
    }),
    prisma.vehiculo.findMany({
      where: { activo: true },
      select: {
        id: true,
        vencimientos: { select: { fechaVencimiento: true, diasAlerta: true, tipoDocumento: { select: { diasAlertaDefault: true } } } },
      },
    }),
  ])

  const productosStockBajo = productos.filter((p) => p.stockActual <= p.stockMinimo && p.stockMinimo > 0).length
  const medicamentosStockBajo = medicamentos.filter((m) => m.stockActual <= m.stockMinimo && m.stockMinimo > 0).length

  // Vehículos con al menos un documento vencido o dentro de su umbral de alerta configurado
  let vehiculosDocVencidos = 0
  let vehiculosDocPorVencer = 0
  for (const v of vehiculos) {
    const vencido = v.vencimientos.some((ve) => ve.fechaVencimiento < ahora)
    const porVencer = !vencido && v.vencimientos.some((ve) => {
      const umbralDias = ve.diasAlerta ?? ve.tipoDocumento.diasAlertaDefault
      const limite = new Date(ahora.getTime() + umbralDias * 86400000)
      return ve.fechaVencimiento <= limite
    })
    if (vencido) vehiculosDocVencidos++
    else if (porVencer) vehiculosDocPorVencer++
  }

  const total = productosStockBajo + medicamentosStockBajo + medicamentosPorVencer + vehiculosDocVencidos + vehiculosDocPorVencer

  return NextResponse.json({
    productosStockBajo,
    medicamentosStockBajo,
    medicamentosPorVencer,
    vehiculosDocVencidos,
    vehiculosDocPorVencer,
    total,
  })
}
