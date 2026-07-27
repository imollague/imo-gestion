import jwt from 'jsonwebtoken'
import crypto from 'crypto'

const API_URL = process.env.FIRMAGOB_ENV === 'test'
  ? process.env.FIRMAGOB_API_URL_TEST!
  : process.env.FIRMAGOB_API_URL!

// FirmaGob espera la expiración en hora local chilena (America/Santiago), sin zona horaria
function expirationChile(offsetMs: number): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Santiago',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(new Date(Date.now() + offsetMs)).replace(' ', 'T')
}

// Limpia RUT: quita puntos, guión y dígito verificador → solo dígitos
function limpiarRut(rut: string): string {
  return rut.replace(/\./g, '').replace(/-[\dkK]$/, '')
}

function generarToken(rut: string, purpose: string): string {
  const payload = {
    entity: process.env.FIRMAGOB_ENTITY,
    run: limpiarRut(rut),
    expiration: expirationChile(25 * 60 * 1000), // 25 min (máximo permitido: 30 min)
    purpose,
  }
  return jwt.sign(payload, process.env.FIRMAGOB_SECRET!, { algorithm: 'HS256' })
}

function checksumBase64(base64: string): string {
  return crypto.createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex')
}

async function llamarApi(
  headers: Record<string, string>,
  body: object
): Promise<FirmaResult> {
  let rawText = ''
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })

    rawText = await response.text()
    const data = JSON.parse(rawText)

    // FirmaGob a veces devuelve 200 con status "error" en el archivo
    if (!response.ok) {
      return { ok: false, error: data.error || `Error HTTP ${response.status}` }
    }

    const archivo = data.files?.[0]
    if (!archivo || archivo.status !== 'OK') {
      return { ok: false, error: archivo?.description || 'FirmaGob no pudo firmar el documento' }
    }

    return {
      ok: true,
      pdfFirmadoBase64: archivo.content,
      checksumOriginal: archivo.checksum_original,
      checksumFirmado: archivo.checksum,
      idSolicitud: String(data.idSolicitud ?? ''),
    }
  } catch (err) {
    console.error('[firmagob] error:', err, 'raw response:', rawText.slice(0, 200))
    return { ok: false, error: String(err) }
  }
}

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface FirmaAtendidaParams {
  rutFirmante: string   // RUT del firmante (con o sin puntos/guión — se limpia internamente)
  otp: string           // código de 6 dígitos del autenticador
  pdfBase64: string     // PDF en base64
  descripcion: string
  layoutXml?: string    // opcional: AgileSignerConfig para firma visual
}

export interface FirmaDesatendidaParams {
  rutFirmante: string
  pdfBase64: string
  descripcion: string
}

export interface FirmaResult {
  ok: boolean
  pdfFirmadoBase64?: string
  checksumOriginal?: string
  checksumFirmado?: string
  idSolicitud?: string
  error?: string
}

// ── API pública ───────────────────────────────────────────────────────────────

/** Firma atendida: requiere OTP del autenticador del firmante */
export async function firmarDocumentoAtendido({
  rutFirmante, otp, pdfBase64, descripcion, layoutXml,
}: FirmaAtendidaParams): Promise<FirmaResult> {
  const token = generarToken(rutFirmante, process.env.FIRMAGOB_PURPOSE ?? 'Propósito General')
  const checksum = checksumBase64(pdfBase64)
  const file: Record<string, string> = {
    'content-type': 'application/pdf',
    content: pdfBase64,
    description: descripcion,
    checksum,
  }
  if (layoutXml) file.layout = layoutXml

  return llamarApi(
    { OTP: otp },
    { token, api_token_key: process.env.FIRMAGOB_API_TOKEN_KEY, files: [file] }
  )
}

/** Firma desatendida: sin intervención humana, no envía header OTP */
export async function firmarDocumentoDesatendido({
  rutFirmante, pdfBase64, descripcion,
}: FirmaDesatendidaParams): Promise<FirmaResult> {
  const token = generarToken(rutFirmante, 'Desatendido')
  const checksum = checksumBase64(pdfBase64)

  return llamarApi(
    {},
    {
      token,
      api_token_key: process.env.FIRMAGOB_API_TOKEN_KEY,
      files: [{ 'content-type': 'application/pdf', content: pdfBase64, description: descripcion, checksum }],
    }
  )
}