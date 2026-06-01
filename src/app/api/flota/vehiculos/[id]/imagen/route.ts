import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"
import { supabaseStorage, BUCKET } from "@/lib/supabase-storage"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const vehiculoId = parseInt(id)

  const formData = await req.formData()
  const archivo = formData.get("archivo") as File | null

  if (!archivo) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 })
  }

  const ext = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg"
  const path = `vehiculos/${vehiculoId}/imagen.${ext}`
  const buffer = Buffer.from(await archivo.arrayBuffer())

  // Eliminar imagen anterior si existe
  await supabaseStorage.storage.from(BUCKET).remove([path])

  const { error } = await supabaseStorage.storage.from(BUCKET).upload(path, buffer, {
    contentType: archivo.type,
    upsert: true,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabaseStorage.storage.from(BUCKET).getPublicUrl(path)

  const vehiculo = await prisma.vehiculo.update({
    where: { id: vehiculoId },
    data: { imagenUrl: publicUrl },
  })

  return NextResponse.json({ imagenUrl: vehiculo.imagenUrl })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const vehiculoId = parseInt(id)

  const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } })
  if (vehiculo?.imagenUrl) {
    const urlParts = vehiculo.imagenUrl.split(`/${BUCKET}/`)
    if (urlParts.length === 2) {
      await supabaseStorage.storage.from(BUCKET).remove([urlParts[1]])
    }
  }

  await prisma.vehiculo.update({ where: { id: vehiculoId }, data: { imagenUrl: null } })
  return NextResponse.json({ ok: true })
}