import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/apiAuth"
import { ROLES_PACIENTES } from "@/lib/farmaciaLotes"
import { prisma } from "@/lib/prisma"

// Búsqueda rápida para autocomplete (por RUT o nombre)
export async function GET(req: NextRequest) {
  const auth = await requireRole(...ROLES_PACIENTES)
  if (!auth.ok) return auth.response

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? ""
  if (q.length < 2) return NextResponse.json([])

  const pacientes = await prisma.paciente.findMany({
    where: {
      activo: true,
      OR: [
        { rut: { contains: q, mode: "insensitive" } },
        { nombre: { contains: q, mode: "insensitive" } },
        { apellido: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    take: 8,
    select: { id: true, rut: true, nombre: true, apellido: true, telefono: true },
  })

  return NextResponse.json(pacientes)
}
