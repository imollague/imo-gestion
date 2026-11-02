import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/apiAuth"
import { ROLES_LECTURA_BODEGA } from "@/lib/farmaciaLotes"
import { prisma } from "@/lib/prisma"

// GET - Buscar productos por código o nombre parcial
export async function GET(req: NextRequest) {
  const auth = await requireRole(...ROLES_LECTURA_BODEGA)
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
