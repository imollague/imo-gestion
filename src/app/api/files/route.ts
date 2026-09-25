import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiAuth"
import { getSignedUrl } from "@/lib/storage"

/**
 * Sirve archivos del bucket privado de Storage. Requiere sesión activa —
 * reemplaza el acceso directo por URL pública, que no pedía login.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const path = req.nextUrl.searchParams.get("path")
  if (!path) return NextResponse.json({ error: "Falta el parámetro path" }, { status: 400 })

  // Evita path traversal fuera del storagePath esperado
  if (path.includes("..")) return NextResponse.json({ error: "Ruta inválida" }, { status: 400 })

  const url = await getSignedUrl(path)
  if (!url) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 })

  return NextResponse.redirect(url)
}
