import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function GET() {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const vehiculos = await prisma.vehiculo.findMany({
    where: { activo: true },
    orderBy: { patente: "asc" },
    include: {
      solicitudes: {
        where: { estado: { in: ["PENDIENTE", "APROBADA", "EN_CURSO"] } },
        select: { id: true, estado: true },
      },
      vencimientos: { include: { tipoDocumento: true } },
    },
  })

  const hoy = new Date()
  const data = vehiculos.map((v) => {
    const vencimientosConDias = v.vencimientos.map((ve) => {
      const dias = Math.ceil((ve.fechaVencimiento.getTime() - hoy.getTime()) / 86400000)
      const umbral = ve.diasAlerta ?? ve.tipoDocumento.diasAlertaDefault
      return { ...ve, dias, alerta: dias <= umbral }
    })
    const alertaDoc = vencimientosConDias.some((ve) => ve.alerta)
    const enUso = v.solicitudes.some((s) => s.estado === "EN_CURSO")

    return { ...v, vencimientos: vencimientosConDias, alertaDoc, enUso }
  })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { patente, marca, modelo, anio, tipo, kmActual, licenciasPermitidas, observaciones } = body

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
      licenciasPermitidas: Array.isArray(licenciasPermitidas) ? licenciasPermitidas : [],
      observaciones: observaciones || null,
    },
  })

  return NextResponse.json(vehiculo, { status: 201 })
}
