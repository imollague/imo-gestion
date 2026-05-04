import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireRole } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim() ?? ""
  const page = parseInt(searchParams.get("page") ?? "1")
  const limit = 50

  const where = q
    ? {
        activo: true,
        OR: [
          { rut: { contains: q, mode: "insensitive" as const } },
          { nombre: { contains: q, mode: "insensitive" as const } },
          { apellido: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : { activo: true }

  const [pacientes, total] = await Promise.all([
    prisma.paciente.findMany({
      where,
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        rut: true,
        nombre: true,
        apellido: true,
        telefono: true,
        createdAt: true,
        _count: { select: { movimientos: true } },
      },
    }),
    prisma.paciente.count({ where }),
  ])

  return NextResponse.json({ pacientes, total, page, limit })
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN", "FARMACIA")
  if (!auth.ok) return auth.response

  const { rut, nombre, apellido, telefono } = await req.json()

  if (!rut?.trim()) return NextResponse.json({ error: "El RUT es obligatorio" }, { status: 400 })
  if (!nombre?.trim()) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 })
  if (!apellido?.trim()) return NextResponse.json({ error: "El apellido es obligatorio" }, { status: 400 })

  const existente = await prisma.paciente.findUnique({ where: { rut: rut.trim() } })
  if (existente) {
    return NextResponse.json({ error: `Ya existe un paciente con RUT ${rut}` }, { status: 400 })
  }

  const paciente = await prisma.paciente.create({
    data: {
      rut: rut.trim(),
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      telefono: telefono?.trim() || null,
    },
  })

  return NextResponse.json(paciente, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const auth = await requireRole("ADMIN", "FARMACIA")
  if (!auth.ok) return auth.response

  const { id, nombre, apellido, telefono } = await req.json()
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })

  const paciente = await prisma.paciente.update({
    where: { id },
    data: {
      nombre: nombre?.trim(),
      apellido: apellido?.trim(),
      telefono: telefono?.trim() || null,
    },
  })

  return NextResponse.json(paciente)
}
