import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ bloqueId: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO", "MANTENIMIENTO")
  if (!auth.ok) return auth.response

  const { bloqueId } = await params

  const versiones = await prisma.bloqueMantenimientoVersion.findMany({
    where: { bloqueId: parseInt(bloqueId) },
    include: { editadoPor: { select: { name: true } } },
    orderBy: { fecha: "desc" },
  })

  return NextResponse.json(versiones)
}
