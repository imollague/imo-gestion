import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"
import { uploadFile, deleteFile, extractStoragePath } from "@/lib/storage"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
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
  const storagePath = `vehiculos/${vehiculoId}/${Date.now()}-${nombre.replace(/[^a-z0-9]/gi, "_")}.${ext}`
  const buffer = Buffer.from(await archivo.arrayBuffer())

  const { publicUrl, error } = await uploadFile(storagePath, buffer, archivo.type)
  if (error) return NextResponse.json({ error: `Error al subir archivo: ${error}` }, { status: 500 })

  const documento = await prisma.documentoVehiculo.create({
    data: {
      vehiculoId,
      nombre,
      tipo,
      url: publicUrl!,
      subidoPorId: parseInt(auth.session.user.id),
    },
  })

  return NextResponse.json(documento, { status: 201 })
}

export async function DELETE(req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { documentoId } = await req.json()

  const doc = await prisma.documentoVehiculo.findUnique({
    where: { id: parseInt(documentoId) },
  })
  if (!doc) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const storagePath = extractStoragePath(doc.url)
  if (storagePath) await deleteFile(storagePath)

  await prisma.documentoVehiculo.delete({ where: { id: parseInt(documentoId) } })
  return NextResponse.json({ ok: true })
}