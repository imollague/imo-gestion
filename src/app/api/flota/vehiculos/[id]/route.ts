import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const vehiculo = await prisma.vehiculo.findUnique({
    where: { id: parseInt(id) },
    include: {
      hojaVida: {
        orderBy: { fecha: "desc" },
        include: { usuario: { select: { name: true } } },
      },
      documentos: {
        orderBy: { fecha: "desc" },
        include: { subidoPor: { select: { name: true } } },
      },
      solicitudes: {
        orderBy: { fechaSolicitud: "desc" },
        take: 10,
        select: {
          id: true, estado: true, destino: true, proposito: true,
          conductorNombre: true, fechaSolicitud: true, fechaCierre: true,
        },
      },
      vencimientos: { include: { tipoDocumento: true } },
    },
  })

  if (!vehiculo) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json(vehiculo)
}

const PATENTE_RE = /^[A-Z]{2}\d{4}$|^[A-Z]{4}\d{2}$/

const patchSchema = z.object({
  patente: z.string().optional().nullable(),
  numeroInterno: z.string().optional().nullable(),
  marca: z.string().min(1).optional(),
  modelo: z.string().min(1).optional(),
  anio: z.coerce.number().int().min(1900).max(2100).optional(),
  tipo: z.enum(["AUTOMOVIL", "STATION_WAGON", "TODO_TERRENO", "CAMIONETA", "FURGON", "MINIBUS", "BUS", "CAMION", "MOTOCICLETA", "CARRO_ARRASTRE", "MAQUINARIA", "OTRO"]).optional(),
  estado: z.enum(["OPERATIVO", "EN_MANTENCION", "FUERA_SERVICIO", "DADO_DE_BAJA"]).optional(),
  usoMunicipal: z.enum(["AMBULANCIA", "ALJIBE", "RECOLECTOR_RESIDUOS", "TRANSPORTE_PERSONAL", "OPERATIVO_TERRENO", "EMERGENCIA", "ADMINISTRATIVO", "OBRAS", "OTRO"]).optional().nullable(),
  unidadMedidaUso: z.enum(["KILOMETROS", "HORAS"]).optional(),
  kmActual: z.coerce.number().int().min(0).optional(),
  horasUso: z.coerce.number().int().min(0).optional(),
  licenciasPermitidas: z.array(z.string()).optional(),
  observaciones: z.string().optional().nullable(),
  vencimientos: z.array(z.object({
    tipoDocumentoId: z.number().int(),
    fechaVencimiento: z.string().nullable(),
  })).optional(),
}).superRefine((d, ctx) => {
  if (d.patente != null && d.patente !== "") {
    const p = d.patente.trim().toUpperCase().replace(/-/g, "")
    if (!PATENTE_RE.test(p)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["patente"], message: "Formato inválido (ej: AB-1234 o ABCD-12)" })
    }
  }
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const vehiculoId = parseInt(id)
  const body = await req.json()

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Error de validación" }, { status: 400 })
  }

  const { patente, numeroInterno, marca, modelo, anio, tipo, estado, usoMunicipal, unidadMedidaUso, kmActual, horasUso, licenciasPermitidas, observaciones, vencimientos } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const operaciones: any[] = [
    prisma.vehiculo.update({
      where: { id: vehiculoId },
      data: {
        ...(patente !== undefined && { patente: patente ? patente.toUpperCase().trim().replace(/-/g, "") : null }),
        ...(numeroInterno !== undefined && { numeroInterno: numeroInterno?.trim() || null }),
        ...(marca && { marca }),
        ...(modelo && { modelo }),
        ...(anio && { anio }),
        ...(tipo && { tipo }),
        ...(estado && { estado }),
        ...(usoMunicipal !== undefined && { usoMunicipal }),
        ...(unidadMedidaUso && { unidadMedidaUso }),
        ...(kmActual !== undefined && { kmActual }),
        ...(horasUso !== undefined && { horasUso }),
        ...(licenciasPermitidas !== undefined && { licenciasPermitidas }),
        ...(observaciones !== undefined && { observaciones }),
      },
    }),
  ]

  if (Array.isArray(vencimientos)) {
    for (const v of vencimientos) {
      if (v.fechaVencimiento) {
        operaciones.push(
          prisma.vencimientoDocumentoVehiculo.upsert({
            where: { vehiculoId_tipoDocumentoId: { vehiculoId, tipoDocumentoId: v.tipoDocumentoId } },
            update: { fechaVencimiento: new Date(v.fechaVencimiento) },
            create: { vehiculoId, tipoDocumentoId: v.tipoDocumentoId, fechaVencimiento: new Date(v.fechaVencimiento) },
          })
        )
      } else {
        operaciones.push(
          prisma.vencimientoDocumentoVehiculo.deleteMany({
            where: { vehiculoId, tipoDocumentoId: v.tipoDocumentoId },
          })
        )
      }
    }
  }

  const [vehiculo] = await prisma.$transaction(operaciones)

  return NextResponse.json(vehiculo)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN")
  if (!auth.ok) return auth.response

  const { id } = await params
  await prisma.vehiculo.update({
    where: { id: parseInt(id) },
    data: { activo: false },
  })

  return NextResponse.json({ ok: true })
}
