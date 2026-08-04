import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"
import { firmarDocumentoDesatendido } from "@/lib/firmagob"
import { uploadFile } from "@/lib/storage"

export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN", "BODEGA")
  if (!auth.ok) return auth.response

  const { rut } = auth.session.user
  if (!rut) {
    return NextResponse.json(
      { error: "Tu usuario no tiene RUT configurado. Solicita al administrador que lo ingrese en tu perfil." },
      { status: 400 }
    )
  }

  const body = await req.json()
  const { pdfBase64 } = body
  if (!pdfBase64) {
    return NextResponse.json({ error: "Campo requerido: pdfBase64" }, { status: 400 })
  }

  const userId = parseInt(auth.session.user.id)
  const fechaStr = new Date().toLocaleDateString("es-CL")
  const descripcion = `Acta de Inventario Bodega Municipal — ${fechaStr}`

  const doc = await prisma.documentoFirmado.create({
    data: {
      origen: "ACTA_INVENTARIO_BODEGA",
      descripcion,
      estado: "PENDIENTE",
      creadoPorId: userId,
    },
  })

  const bufferOriginal = Buffer.from(pdfBase64, "base64")
  const { publicUrl: urlOriginal } = await uploadFile(
    `firma/acta_inventario_bodega/${doc.id}-original.pdf`,
    bufferOriginal,
    "application/pdf"
  )
  if (urlOriginal) {
    await prisma.documentoFirmado.update({ where: { id: doc.id }, data: { urlOriginal } })
  }

  const resultado = await firmarDocumentoDesatendido({ rutFirmante: rut, pdfBase64, descripcion })

  if (!resultado.ok) {
    await prisma.documentoFirmado.update({
      where: { id: doc.id },
      data: { estado: "ERROR", errorMsg: resultado.error },
    })
    return NextResponse.json({ error: resultado.error }, { status: 400 })
  }

  const bufferFirmado = Buffer.from(resultado.pdfFirmadoBase64!, "base64")
  const { publicUrl: urlFirmado } = await uploadFile(
    `firma/acta_inventario_bodega/${doc.id}-firmado.pdf`,
    bufferFirmado,
    "application/pdf"
  )

  await prisma.documentoFirmado.update({
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

  return NextResponse.json({ ok: true, documentoId: doc.id, urlFirmado: urlFirmado ?? null })
}
