import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const { notaCierre } = await req.json().catch(() => ({}))

  const hallazgo = await prisma.hallazgoMantenimiento.update({
    where: { id: parseInt(id) },
    data: {
      estado: "CERRADA",
      cerradoPorId: parseInt(auth.session.user.id),
      fechaCierre: new Date(),
      notaCierre: notaCierre?.trim() || null,
    },
  })

  return NextResponse.json(hallazgo)
}
