import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireRole } from "@/lib/apiAuth"
import { firmarDocumentoDesatendido } from "@/lib/firmagob"
import { uploadFile } from "@/lib/storage"

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const userId = parseInt(auth.session.user.id)
  const role = auth.session.user.role

  const where =
    role === "ADMIN"
      ? { modulo: "FARMACIA", estado: "PENDIENTE_JEFE" }
      : { modulo: "FARMACIA", estado: "PENDIENTE_JEFE", jefeId: userId }

  const actas = await prisma.actaMerma.findMany({
    where,
    include: {
      creadoPor: { select: { name: true } },
      items: {
        select: { nombre: true, cantidad: true, unidad: true, stockAntes: true },
        orderBy: { id: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(actas)
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN", "FARMACIA")
  if (!auth.ok) return auth.response

  const { rut } = auth.session.user
  if (!rut) {
    return NextResponse.json(
      { error: "Tu usuario no tiene RUT configurado. Solicita al administrador que lo ingrese en tu perfil." },
      { status: 400 }
    )
  }

  const body = await req.json()
  const { items, jefeId, motivo, observaciones, pdfBase64 } = body

  if (!pdfBase64 || !items?.length || !motivo || !jefeId) {
    return NextResponse.json({ error: "Faltan campos requeridos (items, motivo, jefe, pdf)" }, { status: 400 })
  }

  const userId = parseInt(auth.session.user.id)
  const fechaStr = new Date().toLocaleDateString("es-CL")
  const motivoLabel: Record<string, string> = {
    VENCIMIENTO: "Vencimiento", DAÑO: "Daño/Deterioro",
    PERDIDA: "Pérdida/Robo", USO_INTERNO: "Uso interno", OTRO: "Otro",
  }
  const descripcion = `Acta de Merma Farmacia — ${motivoLabel[motivo] ?? motivo} — ${fechaStr}`

  const acta = await prisma.actaMerma.create({
    data: {
      modulo: "FARMACIA",
      estado: "PENDIENTE_JEFE",
      descripcion,
      motivo,
      observaciones: observaciones ?? null,
      jefeId,
      creadoPorId: userId,
      items: {
        create: items.map((i: {
          medicamentoId: number; nombre: string; codigo: string; unidad: string;
          cantidad: number; stockAntes: number; observacion?: string;
        }) => ({
          nombre: i.nombre, codigo: i.codigo, unidad: i.unidad,
          cantidad: i.cantidad, stockAntes: i.stockAntes,
          observacion: i.observacion ?? null, medicamentoId: i.medicamentoId,
        })),
      },
    },
  })

  const resultado = await firmarDocumentoDesatendido({ rutFirmante: rut, pdfBase64, descripcion })

  if (!resultado.ok) {
    await prisma.actaMerma.update({
      where: { id: acta.id },
      data: { estado: "ERROR", errorMsg: resultado.error },
    })
    return NextResponse.json({ error: resultado.error }, { status: 400 })
  }

  const buffer = Buffer.from(resultado.pdfFirmadoBase64!, "base64")
  const { publicUrl } = await uploadFile(
    `firma/acta_merma_farmacia/${acta.id}-responsable.pdf`, buffer, "application/pdf"
  )

  await prisma.actaMerma.update({
    where: { id: acta.id },
    data: { urlFirmadoResponsable: publicUrl ?? null },
  })

  await prisma.documentoFirmado.create({
    data: {
      origen: "ACTA_MERMA_FARMACIA", origenId: acta.id, descripcion,
      estado: "FIRMADO", urlFirmado: publicUrl ?? null,
      checksumOriginal: resultado.checksumOriginal ?? null,
      checksumFirmado: resultado.checksumFirmado ?? null,
      idSolicitudFirmagob: resultado.idSolicitud ?? null,
      firmadoEn: new Date(), creadoPorId: userId, firmadoPorId: userId,
    },
  })

  return NextResponse.json({ ok: true, actaId: acta.id, estado: "PENDIENTE_JEFE" })
}
