import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"
import { supabaseStorage, BUCKET } from "@/lib/supabase-storage"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA")
  if (!auth.ok) return auth.response

  const { id } = await params
  const vehiculoId = parseInt(id)

  const formData = await req.formData()
  const archivo = formData.get("archivo") as File | null
  const nombre = formData.get("nombre") as string
  const tipo = formData.get("tipo") as string

  if (!archivo || !nombre || !tipo) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 })
  }

  const ext = archivo.name.split(".").pop()?.toLowerCase() ?? "bin"
  const nombreArchivo = `vehiculos/${vehiculoId}/${Date.now()}-${nombre.replace(/[^a-z0-9]/gi, "_")}.${ext}`

  const buffer = Buffer.from(await archivo.arrayBuffer())

  const { error: uploadError } = await supabaseStorage.storage
    .from(BUCKET)
    .upload(nombreArchivo, buffer, {
      contentType: archivo.type,
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: `Error al subir archivo: ${uploadError.message}` }, { status: 500 })
  }

  const { data: { publicUrl } } = supabaseStorage.storage
    .from(BUCKET)
    .getPublicUrl(nombreArchivo)

  const documento = await prisma.documentoVehiculo.create({
    data: {
      vehiculoId,
      nombre,
      tipo,
      url: publicUrl,
      subidoPorId: parseInt(auth.session.user.id),
    },
  })

  return NextResponse.json(documento, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA")
  if (!auth.ok) return auth.response

  const { id } = await params
  const { documentoId } = await req.json()

  const doc = await prisma.documentoVehiculo.findUnique({
    where: { id: parseInt(documentoId) },
  })
  if (!doc) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  // Extraer path del bucket desde la URL pública
  const urlParts = doc.url.split(`/${BUCKET}/`)
  if (urlParts.length === 2) {
    await supabaseStorage.storage.from(BUCKET).remove([urlParts[1]])
  }

  await prisma.documentoVehiculo.delete({ where: { id: parseInt(documentoId) } })
  return NextResponse.json({ ok: true })
}