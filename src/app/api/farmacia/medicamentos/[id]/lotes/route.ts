import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/apiAuth"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const medicamentoId = parseInt(id)
  if (isNaN(medicamentoId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const lotes = await prisma.loteFarmacia.findMany({
    where: { medicamentoId, retirado: false, stockActual: { gt: 0 } },
    select: {
      id: true,
      numeroLote: true,
      fechaVencimiento: true,
      stockActual: true,
      proveedor: true,
    },
    orderBy: { fechaVencimiento: "asc" },
  })

  return NextResponse.json(lotes)
}
