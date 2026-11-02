import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/apiAuth"
import { ROLES_LECTURA_FARMACIA } from "@/lib/farmaciaLotes"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const auth = await requireRole(...ROLES_LECTURA_FARMACIA)
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
