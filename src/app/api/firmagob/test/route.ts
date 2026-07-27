import { NextResponse } from "next/server"
import { requireRole } from "@/lib/apiAuth"
import { firmarDocumentoAtendido, firmarDocumentoDesatendido } from "@/lib/firmagob"

// ── Credenciales sandbox según documentación FirmaGob v2 ─────────────────────
const SANDBOX_RUT_ATENDIDA = "11111111"   // propósito: "Propósito General"
const SANDBOX_RUT_DESATENDIDA = "22222222" // propósito: "Desatendido"

/**
 * Genera un PDF mínimo válido para pruebas, calculando offsets xref correctamente.
 * No requiere dependencias externas.
 */
function buildTestPdf(): string {
  const objs = [
    `1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n`,
    `2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n`,
    `3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>\nendobj\n`,
    `4 0 obj\n<</Length 60>>\nstream\nBT /F1 12 Tf 72 720 Td (Documento de prueba FirmaGob) Tj ET\nendstream\nendobj\n`,
    `5 0 obj\n<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>\nendobj\n`,
  ]

  const header = "%PDF-1.4\n"
  let body = header
  const offsets: number[] = []

  for (const obj of objs) {
    offsets.push(body.length)
    body += obj
  }

  const xrefStart = body.length
  const xrefLines = [
    "xref",
    `0 ${objs.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n `),
    `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>`,
    `startxref\n${xrefStart}`,
    "%%EOF",
  ]

  return Buffer.from(body + xrefLines.join("\n")).toString("base64")
}

/**
 * GET /api/firmagob/test?modo=desatendida|atendida
 *
 * Prueba la integración con el sandbox de FirmaGob.
 *
 * Modos:
 *   desatendida (default) — no requiere OTP, usa run=22222222
 *   atendida — requiere parámetro ?otp=XXXXXX, usa run=11111111
 *     (el OTP lo genera el autenticador escaneando el QR del Anexo A del manual)
 *
 * Solo accesible por ADMIN.
 */
export async function GET(req: Request) {
  const auth = await requireRole("ADMIN")
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const modo = searchParams.get("modo") ?? "desatendida"
  const otp = searchParams.get("otp") ?? ""

  if (modo === "atendida" && !otp) {
    return NextResponse.json(
      { error: "Para modo=atendida debes pasar ?otp=XXXXXX (6 dígitos del autenticador FirmaGob test)" },
      { status: 400 }
    )
  }

  const pdfBase64 = buildTestPdf()
  const descripcion = `Prueba FirmaGob sandbox — ${new Date().toISOString()}`

  const resultado =
    modo === "atendida"
      ? await firmarDocumentoAtendido({
          rutFirmante: SANDBOX_RUT_ATENDIDA,
          otp,
          pdfBase64,
          descripcion,
        })
      : await firmarDocumentoDesatendido({
          rutFirmante: SANDBOX_RUT_DESATENDIDA,
          pdfBase64,
          descripcion,
        })

  if (!resultado.ok) {
    return NextResponse.json({ ok: false, modo, error: resultado.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    modo,
    env: process.env.FIRMAGOB_ENV ?? "production",
    idSolicitud: resultado.idSolicitud,
    checksumOriginal: resultado.checksumOriginal,
    checksumFirmado: resultado.checksumFirmado,
    // El PDF firmado en base64 — decodificable con cualquier visor
    pdfFirmadoBase64: resultado.pdfFirmadoBase64,
  })
}
