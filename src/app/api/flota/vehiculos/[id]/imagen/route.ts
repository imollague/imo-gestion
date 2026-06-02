import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"
import { uploadFile, deleteFile, extractStoragePath } from "@/lib/storage"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const vehiculoId = parseInt(id)

  const formData = await req.formData()
  const archivo = formData.get("archivo") as File | null
  if (!archivo) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 })

  const ext = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg"
  const storagePath = `vehiculos/${vehiculoId}/imagen.${ext}`
  const buffer = Buffer.from(await archivo.arrayBuffer())

  // Eliminar imagen anterior si existe
  const vehiculoActual = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } })
  if (vehiculoActual?.imagenUrl) {
    const oldPath = extractStoragePath(vehiculoActual.imagenUrl)
    if (oldPath) await deleteFile(oldPath)
  }

  const { publicUrl, error } = await uploadFile(storagePath, buffer, archivo.type)
  if (error) return NextResponse.json({ error }, { status: 500 })

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
    const storagePath = extractStoragePath(vehiculo.imagenUrl)
    if (storagePath) await deleteFile(storagePath)
  }

  await prisma.vehiculo.update({ where: { id: vehiculoId }, data: { imagenUrl: null } })
  return NextResponse.json({ ok: true })
}