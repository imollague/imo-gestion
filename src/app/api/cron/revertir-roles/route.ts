import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const usuarios = await prisma.user.findMany({
    where: {
      roleExpiration: { lte: new Date() },
      roleAnterior: { not: null },
    },
  })

  for (const u of usuarios) {
    await prisma.user.update({
      where: { id: u.id },
      data: {
        role: u.roleAnterior!,
        roleAnterior: null,
        roleExpiration: null,
      },
    })
  }

  return NextResponse.json({ revertidos: usuarios.length })
}