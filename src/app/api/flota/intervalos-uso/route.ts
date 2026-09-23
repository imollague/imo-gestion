import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"
import { TipoVehiculo } from "@/generated/prisma/client"

// SEDAN queda fuera a propósito: valor histórico del enum sin uso, no se ofrece en la UI
const TIPOS_CONFIGURABLES = Object.values(TipoVehiculo).filter((t) => t !== "SEDAN")

export async function GET() {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const existentes = await prisma.intervaloUsoTipoVehiculo.findMany()
  const porTipo = new Map(existentes.map((i) => [i.tipo, i.intervalo]))

  const resultado = TIPOS_CONFIGURABLES.map((tipo) => ({
    tipo,
    intervalo: porTipo.get(tipo) ?? null,
  }))

  return NextResponse.json(resultado)
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { tipo, intervalo } = body

  if (!TIPOS_CONFIGURABLES.includes(tipo)) {
    return NextResponse.json({ error: "Tipo de vehículo inválido" }, { status: 400 })
  }

  const intervaloNum = intervalo === null || intervalo === "" ? null : parseInt(intervalo)
  if (intervaloNum !== null && (isNaN(intervaloNum) || intervaloNum <= 0)) {
    return NextResponse.json({ error: "Intervalo debe ser un número positivo o vacío para desactivar" }, { status: 400 })
  }

  const actualizado = await prisma.intervaloUsoTipoVehiculo.upsert({
    where: { tipo },
    create: { tipo, intervalo: intervaloNum },
    update: { intervalo: intervaloNum },
  })

  return NextResponse.json(actualizado)
}
