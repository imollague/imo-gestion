import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

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

  // Lotes por vencer en 30 días (corregido: usar LoteFarmacia, no MovimientoFarmacia)
  const ahora = new Date()
  const en30dias = new Date()
  en30dias.setDate(en30dias.getDate() + 30)

  const medicamentosPorVencer = await prisma.loteFarmacia.count({
    where: {
      retirado: false,
      stockActual: { gt: 0 },
      fechaVencimiento: { gte: ahora, lte: en30dias },
    },
  })

  return NextResponse.json({
    productosStockBajo,
    medicamentosStockBajo,
    medicamentosPorVencer,
    total: productosStockBajo + medicamentosStockBajo + medicamentosPorVencer,
  })
}
