import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

// Cerrar o reabrir una observación
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const { estado } = await req.json()
  if (estado !== "ABIERTA" && estado !== "CERRADA") {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 })
  }

  const userId = parseInt(auth.session.user.id)
  const observacion = await prisma.observacionVehiculo.update({
    where: { id: parseInt(id) },
    data: estado === "CERRADA"
      ? { estado, cerradoPorId: userId, fechaCierre: new Date() }
      : { estado, cerradoPorId: null, fechaCierre: null },
  })

  return NextResponse.json(observacion)
}
