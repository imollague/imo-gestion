interface OpcionesCompresion {
  maxAncho?: number
  maxAlto?: number
  calidad?: number
}

/**
 * Redimensiona y recomprime una foto a JPEG en el navegador antes de subirla,
 * para evitar timeouts/errores al subir fotos de celular (varios MB) con
 * internet lento o inestable. Si no hay ganancia o el navegador no soporta
 * canvas/createImageBitmap, devuelve el archivo original.
 */
export async function comprimirImagen(file: File, opciones: OpcionesCompresion = {}): Promise<File> {
  const { maxAncho = 1600, maxAlto = 1600, calidad = 0.75 } = opciones

  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    const ratio = Math.min(1, maxAncho / bitmap.width, maxAlto / bitmap.height)
    const width = Math.round(bitmap.width * ratio)
    const height = Math.round(bitmap.height * ratio)

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", calidad))
    if (!blob || blob.size >= file.size) return file

    const nombre = file.name.replace(/\.[^.]+$/, "") + ".jpg"
    return new File([blob], nombre, { type: "image/jpeg" })
  } catch {
    return file
  }
}
