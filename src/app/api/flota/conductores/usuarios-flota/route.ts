import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

// Usuarios con rol FLOTA disponibles para vincular a un conductor del roster
export async function GET() {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const usuarios = await prisma.user.findMany({
    where: { role: "FLOTA", active: true },
    select: { id: true, name: true, username: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(usuarios)
}
