import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
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

const MAQUINARIA_TIPOS = ["MAQUINARIA", "CARRO_ARRASTRE"]
const PATENTE_RE = /^[A-Z]{2}\d{4}$|^[A-Z]{4}\d{2}$/

const createSchema = z.object({
  patente: z.string().optional().nullable(),
  numeroInterno: z.string().optional().nullable(),
  marca: z.string().min(1, "Marca requerida"),
  modelo: z.string().min(1, "Modelo requerido"),
  anio: z.coerce.number().int().min(1900).max(2100),
  tipo: z.enum(["AUTOMOVIL", "STATION_WAGON", "TODO_TERRENO", "CAMIONETA", "FURGON", "MINIBUS", "BUS", "CAMION", "MOTOCICLETA", "CARRO_ARRASTRE", "MAQUINARIA", "OTRO"]),
  usoMunicipal: z.enum(["AMBULANCIA", "ALJIBE", "RECOLECTOR_RESIDUOS", "TRANSPORTE_PERSONAL", "OPERATIVO_TERRENO", "EMERGENCIA", "ADMINISTRATIVO", "OBRAS", "OTRO"]).optional().nullable(),
  unidadMedidaUso: z.enum(["KILOMETROS", "HORAS"]).optional(),
  kmActual: z.coerce.number().int().min(0).optional(),
  horasUso: z.coerce.number().int().min(0).optional(),
  licenciasPermitidas: z.array(z.string()).optional(),
  observaciones: z.string().optional().nullable(),
}).superRefine((d, ctx) => {
  if (MAQUINARIA_TIPOS.includes(d.tipo)) {
    if (!d.numeroInterno?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["numeroInterno"], message: "Número interno es obligatorio para maquinaria y carros de arrastre" })
    }
  } else {
    const p = (d.patente ?? "").trim().toUpperCase().replace(/-/g, "")
    if (!p) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["patente"], message: "Patente es obligatoria" })
    } else if (!PATENTE_RE.test(p)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["patente"], message: "Formato inválido (ej: AB-1234 o ABCD-12)" })
    }
  }
})

export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { patente, numeroInterno, marca, modelo, anio, tipo, usoMunicipal, unidadMedidaUso, kmActual, horasUso, licenciasPermitidas, observaciones } = parsed.data

  const unidad = MAQUINARIA_TIPOS.includes(tipo) ? "HORAS" : (unidadMedidaUso ?? "KILOMETROS")

  const vehiculo = await prisma.vehiculo.create({
    data: {
      patente: patente ? patente.toUpperCase().trim().replace(/-/g, "") : null,
      numeroInterno: numeroInterno?.trim() || null,
      marca,
      modelo,
      anio,
      tipo,
      usoMunicipal: usoMunicipal ?? null,
      unidadMedidaUso: unidad,
      kmActual: kmActual ?? 0,
      horasUso: horasUso ?? 0,
      licenciasPermitidas: Array.isArray(licenciasPermitidas) ? licenciasPermitidas : [],
      observaciones: observaciones || null,
    },
  })

  return NextResponse.json(vehiculo, { status: 201 })
}
