import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

// GET - Listar lotes de un medicamento
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const medicamentoId = searchParams.get("medicamentoId")
  const soloActivos = searchParams.get("soloActivos") !== "false"

  if (!medicamentoId) {
    return NextResponse.json({ error: "medicamentoId requerido" }, { status: 400 })
  }

  const lotes = await prisma.loteFarmacia.findMany({
    where: {
      medicamentoId: parseInt(medicamentoId),
      ...(soloActivos && { retirado: false }),
    },
    orderBy: [
      { retirado: "asc" },
      { fechaIngreso: "asc" },
    ],
  })

  return NextResponse.json(lotes)
}
