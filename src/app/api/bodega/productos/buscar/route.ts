import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

// GET - Buscar productos por código o nombre parcial
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim()

  if (!q || q.length < 1) return NextResponse.json([])

  const productos = await prisma.productoBodega.findMany({
    where: {
      activo: true,
      OR: [
        { codigo: { contains: q, mode: "insensitive" } },
        { nombre: { contains: q, mode: "insensitive" } },
      ],
    },
    include: { categoria: true },
    take: 8,
    orderBy: { nombre: "asc" },
  })

  return NextResponse.json(productos)
}
