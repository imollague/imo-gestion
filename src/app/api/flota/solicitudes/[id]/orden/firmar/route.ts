import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"
import { firmarDocumentoAtendido } from "@/lib/firmagob"
import { uploadFile } from "@/lib/storage"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { rut } = auth.session.user
  if (!rut) {
    return NextResponse.json(
      { error: "Tu usuario no tiene RUT configurado. Solicita al administrador que lo ingrese en tu perfil." },
      { status: 400 }
    )
  }

  const { id } = await params
  const solicitudId = parseInt(id)

  const solicitud = await prisma.solicitudVehiculo.findUnique({
    where: { id: solicitudId },
    include: { ordenServicio: true },
  })
  if (!solicitud) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (!solicitud.ordenServicio) {
    return NextResponse.json({ error: "No existe orden de servicio" }, { status: 400 })
  }
  if (solicitud.ordenServicio.firmada) {
    return NextResponse.json({ error: "Orden ya autorizada" }, { status: 409 })
  }

  const body = await req.json()
  const { pdfBase64, otp } = body
  if (!pdfBase64 || !otp) {
    return NextResponse.json({ error: "Campos requeridos: pdfBase64, otp" }, { status: 400 })
  }

  const userId = parseInt(auth.session.user.id)
  const descripcion = `Orden de Servicio Flota N° ${solicitudId}`

  // 1. Crear registro DocumentoFirmado en PENDIENTE
  const doc = await prisma.documentoFirmado.create({
    data: {
      origen: "ORDEN_SERVICIO_FLOTA",
      origenId: solicitudId,
      descripcion,
      estado: "PENDIENTE",
      creadoPorId: userId,
    },
  })

  // 2. Subir PDF original
  const bufferOriginal = Buffer.from(pdfBase64, "base64")
  const { publicUrl: urlOriginal } = await uploadFile(
    `firma/orden_servicio_flota/${doc.id}-original.pdf`,
    bufferOriginal,
    "application/pdf"
  )
  if (urlOriginal) {
    await prisma.documentoFirmado.update({ where: { id: doc.id }, data: { urlOriginal } })
  }

  // 3. Firmar con FirmaGob
  const resultado = await firmarDocumentoAtendido({ rutFirmante: rut, otp, pdfBase64, descripcion })

  if (!resultado.ok) {
    await prisma.documentoFirmado.update({
      where: { id: doc.id },
      data: { estado: "ERROR", errorMsg: resultado.error },
    })
    return NextResponse.json({ error: resultado.error }, { status: 400 })
  }

  // 4. Subir PDF firmado
  const bufferFirmado = Buffer.from(resultado.pdfFirmadoBase64!, "base64")
  const { publicUrl: urlFirmado } = await uploadFile(
    `firma/orden_servicio_flota/${doc.id}-firmado.pdf`,
    bufferFirmado,
    "application/pdf"
  )

  // 5. Actualizar DocumentoFirmado + OS + solicitud
  await Promise.all([
    prisma.documentoFirmado.update({
      where: { id: doc.id },
      data: {
        estado: "FIRMADO",
        urlFirmado: urlFirmado ?? null,
        checksumOriginal: resultado.checksumOriginal ?? null,
        checksumFirmado: resultado.checksumFirmado ?? null,
        idSolicitudFirmagob: resultado.idSolicitud ?? null,
        firmadoEn: new Date(),
        firmadoPorId: userId,
      },
    }),
    prisma.$transaction([
      prisma.ordenServicioFlota.update({
        where: { solicitudId },
        data: { firmada: true, firmadaPorId: userId, fechaFirma: new Date() },
      }),
      prisma.solicitudVehiculo.update({
        where: { id: solicitudId },
        data: { estado: "APROBADA", aprobadoPorId: userId, fechaAprobacion: new Date() },
      }),
    ]),
  ])

  return NextResponse.json({ ok: true, documentoId: doc.id, urlFirmado: urlFirmado ?? null })
}
