import { NextResponse } from "next/server"
import { requireRole } from "@/lib/apiAuth"
import crypto from "crypto"

function signJwtHs256(payload: object, secret: string): string {
  const b64url = (s: string) =>
    Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body = b64url(JSON.stringify(payload))
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
  return `${header}.${body}.${sig}`
}

function limpiarRut(rut: string): string {
  return rut.replace(/\./g, "").replace(/-[\dkK]$/, "")
}

function expirationChile(offsetMs: number): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Santiago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(new Date(Date.now() + offsetMs)).replace(" ", "T")
}

// PDF mínimo válido
function buildTestPdf(): string {
  const objs = [
    `1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n`,
    `2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n`,
    `3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>\nendobj\n`,
    `4 0 obj\n<</Length 60>>\nstream\nBT /F1 12 Tf 72 720 Td (Diagnostico FirmaGob IMO) Tj ET\nendstream\nendobj\n`,
    `5 0 obj\n<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>\nendobj\n`,
  ]
  const header = "%PDF-1.4\n"
  let body = header
  const offsets: number[] = []
  for (const obj of objs) { offsets.push(body.length); body += obj }
  const xrefStart = body.length
  const xrefLines = [
    "xref", `0 ${objs.length + 1}`, "0000000000 65535 f ",
    ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n `),
    `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>`,
    `startxref\n${xrefStart}`, "%%EOF",
  ]
  return Buffer.from(body + xrefLines.join("\n")).toString("base64")
}

/**
 * GET /api/firmagob/diagnostico
 * Solo ADMIN. Prueba FirmaGob desatendida con el RUT del usuario en sesión
 * y devuelve la respuesta cruda para diagnóstico.
 */
export async function GET() {
  const auth = await requireRole("ADMIN")
  if (!auth.ok) return auth.response

  const rut = auth.session.user.rut
  if (!rut) return NextResponse.json({ error: "El usuario admin no tiene RUT configurado" }, { status: 400 })

  const env = process.env.FIRMAGOB_ENV ?? "production"
  const apiUrl = env === "test"
    ? process.env.FIRMAGOB_API_URL_TEST!
    : process.env.FIRMAGOB_API_URL!

  const rutLimpio = limpiarRut(rut)
  const entity = process.env.FIRMAGOB_ENTITY
  const secret = process.env.FIRMAGOB_SECRET!
  const apiTokenKey = process.env.FIRMAGOB_API_TOKEN_KEY

  const payload = {
    entity,
    run: rutLimpio,
    expiration: expirationChile(25 * 60 * 1000),
    purpose: "Desatendido",
  }
  const token = signJwtHs256(payload, secret)
  const pdfBase64 = buildTestPdf()
  const checksum = crypto.createHash("sha256").update(Buffer.from(pdfBase64, "base64")).digest("hex")

  let rawText = ""
  let rawData: unknown = null
  let httpStatus = 0

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        api_token_key: apiTokenKey,
        files: [{ "content-type": "application/pdf", content: pdfBase64, description: "Test diagnóstico IMO", checksum }],
      }),
    })
    httpStatus = response.status
    rawText = await response.text()
    rawData = JSON.parse(rawText)
  } catch (err) {
    rawData = { parseError: String(err), rawText }
  }

  return NextResponse.json({
    config: {
      env,
      apiUrl,
      entity,
      rutOriginal: rut,
      rutLimpio,
      apiTokenKey: apiTokenKey ? `${apiTokenKey.slice(0, 6)}...` : null,
    },
    tokenPayload: payload,
    httpStatus,
    firmagobResponse: rawData,
  })
}
