import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"
import { toProxyUrl } from "@/lib/storage"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO", "MANTENIMIENTO")
  if (!auth.ok) return auth.response

  const { id } = await params

  const [registro, actividades] = await Promise.all([
    prisma.registroMantenimiento.findUnique({
      where: { id: parseInt(id) },
      include: {
        creadoPor: { select: { name: true } },
        activo: { select: { id: true, nombre: true } },
        bloques: {
          include: {
            actividad: { select: { id: true, nombre: true } },
            creadoPor: { select: { name: true } },
            editadoPor: { select: { name: true } },
            respuestas: { include: { campo: true }, orderBy: { campo: { orden: "asc" } } },
            hallazgos: { orderBy: { fecha: "desc" } },
            _count: { select: { versiones: true } },
          },
          orderBy: { fecha: "desc" },
        },
      },
    }),
    prisma.actividadMantenimiento.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { orden: "asc" },
    }),
  ])
  if (!registro) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  return NextResponse.json({
    registro: {
      ...registro,
      bloques: registro.bloques.map((b) => ({
        ...b,
        respuestas: b.respuestas.map((r) => ({ ...r, imagenUrl: toProxyUrl(r.imagenUrl) })),
      })),
    },
    actividades,
  })
}
