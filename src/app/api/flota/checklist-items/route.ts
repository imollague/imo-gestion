import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function GET() {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const items = await prisma.checklistItem.findMany({
    where: { activo: true },
    orderBy: [{ categoria: "asc" }, { orden: "asc" }],
  })

  return NextResponse.json(items)
}