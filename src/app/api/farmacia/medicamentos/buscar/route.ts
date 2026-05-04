import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim()

  if (!q || q.length < 1) return NextResponse.json([])

  const medicamentos = await prisma.medicamento.findMany({
    where: {
      activo: true,
      OR: [
        { codigo: { contains: q, mode: "insensitive" } },
        { nombreGenerico: { contains: q, mode: "insensitive" } },
        { nombreComercial: { contains: q, mode: "insensitive" } },
      ],
    },
    include: { categoria: true },
    take: 8,
    orderBy: { nombreGenerico: "asc" },
  })

  return NextResponse.json(medicamentos)
}
