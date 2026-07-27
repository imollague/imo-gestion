import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/apiAuth"
import { firmarDocumentoAtendido } from "@/lib/firmagob"
import { prisma } from "@/lib/prisma"
import { uploadFile } from "@/lib/storage"

/**
 * POST /api/firmagob/firmar
 *
 * Firma un PDF con FirmaGob (firma atendida, requiere OTP del autenticador).
 * El RUT del firmante se obtiene del perfil del usuario en sesión.
 *
 * Body:
 *   pdfBase64   string   — PDF en base64
 *   descripcion string   — Descripción del documento
 *   origen      string   — Tipo de documento: "ORDEN_SERVICIO_FLOTA" | "ACTA" | "PRUEBA" | etc.
 *   origenId    number?  — ID del documento origen (opcional, para trazabilidad)
 *   otp         string   — Código de 6 dígitos del autenticador FirmaGob
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { rut } = auth.session.user
  if (!rut) {
    return NextResponse.json(
      { error: "Tu usuario no tiene RUT configurado. Solicita al administrador que lo ingrese en tu perfil." },
      { status: 400 }
    )
  }

  const body = await req.json()
  const { pdfBase64, descripcion, origen, origenId, otp } = body

  if (!pdfBase64 || !descripcion || !origen || !otp) {
    return NextResponse.json(
      { error: "Campos requeridos: pdfBase64, descripcion, origen, otp" },
      { status: 400 }
    )
  }

  const userId = parseInt(auth.session.user.id)

  // 1. Crear registro en PENDIENTE
  const doc = await prisma.documentoFirmado.create({
    data: {
      origen,
      origenId: origenId ?? null,
      descripcion,
      estado: "PENDIENTE",
      creadoPorId: userId,
    },
  })

  // 2. Subir PDF original a storage
  const bufferOriginal = Buffer.from(pdfBase64, "base64")
  const { publicUrl: urlOriginal } = await uploadFile(
    `firma/${origen.toLowerCase()}/${doc.id}-original.pdf`,
    bufferOriginal,
    "application/pdf"
  )
  if (urlOriginal) {
    await prisma.documentoFirmado.update({ where: { id: doc.id }, data: { urlOriginal } })
  }

  // 3. Firmar con FirmaGob
  const resultado = await firmarDocumentoAtendido({
    rutFirmante: rut,
    otp,
    pdfBase64,
    descripcion,
  })

  if (!resultado.ok) {
    await prisma.documentoFirmado.update({
      where: { id: doc.id },
      data: { estado: "ERROR", errorMsg: resultado.error },
    })
    return NextResponse.json({ error: resultado.error, documentoId: doc.id }, { status: 400 })
  }

  // 4. Subir PDF firmado a storage
  const bufferFirmado = Buffer.from(resultado.pdfFirmadoBase64!, "base64")
  const { publicUrl: urlFirmado } = await uploadFile(
    `firma/${origen.toLowerCase()}/${doc.id}-firmado.pdf`,
    bufferFirmado,
    "application/pdf"
  )

  // 5. Actualizar registro a FIRMADO
  const docFirmado = await prisma.documentoFirmado.update({
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
  })

  return NextResponse.json({
    ok: true,
    documentoId: docFirmado.id,
    urlFirmado: docFirmado.urlFirmado,
    checksumOriginal: docFirmado.checksumOriginal,
    checksumFirmado: docFirmado.checksumFirmado,
    idSolicitudFirmagob: docFirmado.idSolicitudFirmagob,
  })
}
