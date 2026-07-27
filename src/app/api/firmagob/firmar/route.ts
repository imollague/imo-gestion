import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/apiAuth"
import { firmarDocumentoAtendido } from "@/lib/firmagob"

/**
 * POST /api/firmagob/firmar
 *
 * Firma un PDF usando FirmaGob (firma atendida con OTP).
 * Body: { pdfBase64, descripcion, otp, rut }
 *   rut: RUT del firmante (puede tener puntos y guión, se limpia internamente)
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { pdfBase64, descripcion, otp, rut } = body

  if (!pdfBase64 || !descripcion || !otp || !rut) {
    return NextResponse.json(
      { error: "Faltan campos requeridos: pdfBase64, descripcion, otp, rut" },
      { status: 400 }
    )
  }

  const resultado = await firmarDocumentoAtendido({ rutFirmante: rut, otp, pdfBase64, descripcion })

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    pdfFirmadoBase64: resultado.pdfFirmadoBase64,
    checksumOriginal: resultado.checksumOriginal,
    checksumFirmado: resultado.checksumFirmado,
    idSolicitud: resultado.idSolicitud,
  })
}
