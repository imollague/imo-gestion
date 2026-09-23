import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarCronSecret } from "@/lib/cronAuth"

export async function GET(req: NextRequest) {
  if (!verificarCronSecret(req)) {
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