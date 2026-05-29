import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function GET() {
  const auth = await requireRole("ADMIN", "FLOTA")
  if (!auth.ok) return auth.response

  const vehiculos = await prisma.vehiculo.findMany({
    where: { activo: true },
    orderBy: { patente: "asc" },
    include: {
      solicitudes: {
        where: { estado: { in: ["PENDIENTE", "APROBADA", "EN_CURSO"] } },
        select: { id: true, estado: true },
      },
    },
  })

  const hoy = new Date()
  const data = vehiculos.map((v) => {
    const diasSOAP = v.vencimientoSOAP
      ? Math.ceil((v.vencimientoSOAP.getTime() - hoy.getTime()) / 86400000)
      : null
    const diasRevTecnica = v.vencimientoRevTecnica
      ? Math.ceil((v.vencimientoRevTecnica.getTime() - hoy.getTime()) / 86400000)
      : null
    const diasPermiso = v.vencimientoPermiso
      ? Math.ceil((v.vencimientoPermiso.getTime() - hoy.getTime()) / 86400000)
      : null

    const alertaDoc = [diasSOAP, diasRevTecnica, diasPermiso].some(
      (d) => d !== null && d <= 30
    )
    const enUso = v.solicitudes.some((s) => s.estado === "EN_CURSO")

    return { ...v, diasSOAP, diasRevTecnica, diasPermiso, alertaDoc, enUso }
  })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN", "FLOTA")
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { patente, marca, modelo, anio, tipo, kmActual, vencimientoSOAP,
    vencimientoRevTecnica, vencimientoPermiso, observaciones } = body

  if (!patente || !marca || !modelo || !anio || !tipo) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 })
  }

  const vehiculo = await prisma.vehiculo.create({
    data: {
      patente: patente.toUpperCase().trim(),
      marca,
      modelo,
      anio: parseInt(anio),
      tipo,
      kmActual: kmActual ? parseInt(kmActual) : 0,
      vencimientoSOAP: vencimientoSOAP ? new Date(vencimientoSOAP) : null,
      vencimientoRevTecnica: vencimientoRevTecnica ? new Date(vencimientoRevTecnica) : null,
      vencimientoPermiso: vencimientoPermiso ? new Date(vencimientoPermiso) : null,
      observaciones: observaciones || null,
    },
  })

  return NextResponse.json(vehiculo, { status: 201 })
}