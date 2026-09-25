import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const actividadId = parseInt(id)
  const body = await req.json()
  const { descripcion, requiereImagen, tipo, valorMin, valorMax } = body

  if (!descripcion?.trim()) return NextResponse.json({ error: "Descripción es obligatoria" }, { status: 400 })
  if (tipo && !["TEXTO", "FECHA_HORA", "NUMERO"].includes(tipo)) {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 })
  }

  const max = await prisma.campoActividadMantenimiento.aggregate({
    where: { actividadId },
    _max: { orden: true },
  })

  const campo = await prisma.campoActividadMantenimiento.create({
    data: {
      actividadId,
      descripcion: descripcion.trim(),
      requiereImagen: Boolean(requiereImagen),
      tipo: tipo ?? "TEXTO",
      valorMin: valorMin === undefined || valorMin === null || valorMin === "" ? null : parseFloat(valorMin),
      valorMax: valorMax === undefined || valorMax === null || valorMax === "" ? null : parseFloat(valorMax),
      orden: (max._max.orden ?? -1) + 1,
    },
  })

  return NextResponse.json(campo, { status: 201 })
}
