import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"
import { uploadFile, deleteFile, extractStoragePath } from "@/lib/storage"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const observacionId = parseInt(id)

  const formData = await req.formData()
  const archivo = formData.get("archivo") as File | null
  if (!archivo) return NextResponse.json({ error: "Archivo obligatorio" }, { status: 400 })

  const ext = archivo.name.split(".").pop()?.toLowerCase() ?? "bin"
  const storagePath = `observaciones/${observacionId}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await archivo.arrayBuffer())

  const { publicUrl, error } = await uploadFile(storagePath, buffer, archivo.type)
  if (error) return NextResponse.json({ error }, { status: 500 })

  const adjunto = await prisma.observacionArchivo.create({
    data: {
      observacionId,
      nombre: archivo.name,
      url: publicUrl!,
      subidoPorId: parseInt(auth.session.user.id),
    },
    include: { subidoPor: { select: { name: true } } },
  })

  return NextResponse.json(adjunto, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { archivoId } = await req.json()
  const archivo = await prisma.observacionArchivo.findUnique({ where: { id: parseInt(archivoId) } })
  if (!archivo) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const storagePath = extractStoragePath(archivo.url)
  if (storagePath) await deleteFile(storagePath)

  await prisma.observacionArchivo.delete({ where: { id: parseInt(archivoId) } })
  return NextResponse.json({ ok: true })
}
