import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function GET() {
  const auth = await requireRole("ADMIN", "ENCARGADO", "MANTENIMIENTO")
  if (!auth.ok) return auth.response

  const [registros, totalActividades] = await Promise.all([
    prisma.registroMantenimiento.findMany({
      include: {
        creadoPor: { select: { name: true } },
        activo: { select: { nombre: true } },
        bloques: { select: { actividad: { select: { nombre: true } } } },
      },
      orderBy: { fecha: "desc" },
      take: 100,
    }),
    prisma.actividadMantenimiento.count({ where: { activo: true } }),
  ])

  return NextResponse.json({ registros, totalActividades })
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN", "ENCARGADO", "MANTENIMIENTO")
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const activoId = body?.activoId ? parseInt(body.activoId) : null

  const registro = await prisma.registroMantenimiento.create({
    data: { creadoPorId: parseInt(auth.session.user.id), activoId },
    include: { activo: { select: { nombre: true } } },
  })

  return NextResponse.json(registro, { status: 201 })
}
