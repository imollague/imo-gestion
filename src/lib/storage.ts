import path from "path"
import fs from "fs/promises"

const IS_LOCAL = process.env.STORAGE_LOCAL === "true"
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads")

export const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15 MB

// Garantiza que el directorio exista
async function ensureDir(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
}

/** Firma de bytes real del archivo (no confía en el Content-Type que manda el navegador). */
export function esImagenValida(buffer: Buffer): boolean {
  if (buffer.length < 12) return false
  const hex = buffer.subarray(0, 12).toString("hex")
  if (hex.startsWith("ffd8ff")) return true // JPEG
  if (hex.startsWith("89504e47")) return true // PNG
  if (hex.startsWith("47494638")) return true // GIF
  if (hex.startsWith("52494646") && buffer.subarray(8, 12).toString("ascii") === "WEBP") return true // WEBP
  return false
}

export function esPdfValido(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-"
}

export async function uploadFile(
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<{ publicUrl: string; error: null } | { publicUrl: null; error: string }> {
  if (buffer.length > MAX_FILE_SIZE) {
    return { publicUrl: null, error: `Archivo demasiado grande (máx. ${MAX_FILE_SIZE / 1024 / 1024} MB)` }
  }

  if (IS_LOCAL) {
    try {
      const absPath = path.join(UPLOADS_DIR, storagePath)
      await ensureDir(absPath)
      await fs.writeFile(absPath, buffer)
      return { publicUrl: `/uploads/${storagePath.replace(/\\/g, "/")}`, error: null }
    } catch (e) {
      console.error("[storage] local write error:", e)
      return { publicUrl: null, error: "Error al guardar archivo" }
    }
  }

  const { supabaseStorage, BUCKET } = await import("./supabase-storage")
  const { error } = await supabaseStorage.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { upsert: true, contentType })

  if (error) {
    console.error("[storage] supabase upload error:", error)
    return { publicUrl: null, error: "Error al subir archivo" }
  }

  const { data: { publicUrl } } = supabaseStorage.storage.from(BUCKET).getPublicUrl(storagePath)
  return { publicUrl, error: null }
}

export async function deleteFile(storagePath: string): Promise<void> {
  if (IS_LOCAL) {
    const absPath = path.join(UPLOADS_DIR, storagePath)
    await fs.unlink(absPath).catch(() => {})
    return
  }

  const { supabaseStorage, BUCKET } = await import("./supabase-storage")
  await supabaseStorage.storage.from(BUCKET).remove([storagePath])
}

export function extractStoragePath(publicUrl: string): string | null {
  if (IS_LOCAL) {
    // /uploads/vehiculos/1/imagen.jpg → vehiculos/1/imagen.jpg
    const match = publicUrl.match(/^\/uploads\/(.+)$/)
    return match ? match[1] : null
  }

  const { BUCKET } = require("./supabase-storage")
  const parts = publicUrl.split(`/${BUCKET}/`)
  return parts.length === 2 ? parts[1] : null
}

/** Genera una URL de acceso temporal (bucket privado) para un storagePath. */
export async function getSignedUrl(storagePath: string, expiresIn = 300): Promise<string | null> {
  if (IS_LOCAL) return `/uploads/${storagePath.replace(/\\/g, "/")}`

  const { supabaseStorage, BUCKET } = await import("./supabase-storage")
  const { data, error } = await supabaseStorage.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn)
  if (error || !data) {
    console.error("[storage] error generando signed URL:", error)
    return null
  }
  return data.signedUrl
}

/**
 * Convierte una URL guardada en la BD (pública o local) en una URL que el
 * cliente puede usar sin exponer el bucket directamente: pasa por
 * /api/files, que exige sesión y genera una signed URL de corta duración.
 */
export function toProxyUrl(storedUrl: string | null | undefined): string | null {
  if (!storedUrl) return null
  if (IS_LOCAL) return storedUrl // ya se sirve same-origin vía /uploads, sin bucket público que proteger

  const path = extractStoragePath(storedUrl)
  return path ? `/api/files?path=${encodeURIComponent(path)}` : storedUrl
}