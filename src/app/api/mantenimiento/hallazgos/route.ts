import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function GET(req: NextRequest) {
  const auth = await requireRole("ADMIN", "ENCARGADO", "MANTENIMIENTO")
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const estado = searchParams.get("estado") // ABIERTA | CERRADA | null (todas)

  const hallazgos = await prisma.hallazgoMantenimiento.findMany({
    where: estado ? { estado } : {},
    include: {
      creadoPor: { select: { name: true } },
      cerradoPor: { select: { name: true } },
      bloque: {
        select: {
          registroId: true,
          actividad: { select: { nombre: true } },
        },
      },
    },
    orderBy: { fecha: "desc" },
  })

  return NextResponse.json(hallazgos)
}
