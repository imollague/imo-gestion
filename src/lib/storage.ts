import path from "path"
import fs from "fs/promises"

const IS_LOCAL = process.env.STORAGE_LOCAL === "true"
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads")

// Garantiza que el directorio exista
async function ensureDir(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
}

export async function uploadFile(
  storagePath: string,
  buffer: Buffer,
  _contentType: string
): Promise<{ publicUrl: string; error: null } | { publicUrl: null; error: string }> {
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
    .upload(storagePath, buffer, { upsert: true })

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