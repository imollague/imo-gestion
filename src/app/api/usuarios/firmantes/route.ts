import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/apiAuth"

// Lista de usuarios activos con RUT configurado (potenciales firmantes)
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const firmantes = await prisma.user.findMany({
    where: { active: true, rut: { not: null } },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(firmantes)
}
