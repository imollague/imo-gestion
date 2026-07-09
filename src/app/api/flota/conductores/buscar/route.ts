import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function GET(req: NextRequest) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  if (q.length < 2) return NextResponse.json([])

  const conductores = await prisma.conductorFlota.findMany({
    where: {
      activo: true,
      OR: [
        { nombre: { contains: q, mode: "insensitive" } },
        { rut: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { nombre: "asc" },
    take: 8,
  })

  return NextResponse.json(conductores)
}
