import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const { texto } = await req.json()
  if (!texto?.trim()) return NextResponse.json({ error: "El texto es obligatorio" }, { status: 400 })

  const nota = await prisma.observacionNota.create({
    data: {
      observacionId: parseInt(id),
      texto: texto.trim(),
      autorId: parseInt(auth.session.user.id),
    },
    include: { autor: { select: { name: true } } },
  })

  return NextResponse.json(nota, { status: 201 })
}
