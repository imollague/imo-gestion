import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, denyIfNotOwner } from "@/lib/apiAuth"
import { uploadFile, deleteFile, extractStoragePath } from "@/lib/storage"

const TIPOS_VALIDOS = ["FRONTAL", "LATERAL_IZQ", "LATERAL_DER", "POSTERIOR"]

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("FLOTA")
  if (!auth.ok) return auth.response

  const { id } = await params
  const solicitudId = parseInt(id)

  const solicitud = await prisma.solicitudVehiculo.findUnique({ where: { id: solicitudId } })
  if (!solicitud) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const denyPost = denyIfNotOwner(auth, solicitud.creadoPorId)
  if (denyPost) return denyPost

  if (solicitud.estado === "CERRADA") return NextResponse.json({ error: "Proceso cerrado" }, { status: 400 })

  const formData = await req.formData()
  const archivo = formData.get("archivo") as File | null
  const tipo = formData.get("tipo") as string

  if (!archivo || !tipo) return NextResponse.json({ error: "Archivo y tipo son obligatorios" }, { status: 400 })
  if (!TIPOS_VALIDOS.includes(tipo)) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 })

  // Reemplaza si ya existe una foto de ese tipo
  const existente = await prisma.fotoRevisionVehiculo.findFirst({ where: { solicitudId, tipo } })
  if (existente) {
    const oldPath = extractStoragePath(existente.url)
    if (oldPath) await deleteFile(oldPath)
    await prisma.fotoRevisionVehiculo.delete({ where: { id: existente.id } })
  }

  const ext = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg"
  const storagePath = `solicitudes/${solicitudId}/revision/${tipo.toLowerCase()}.${ext}`
  const buffer = Buffer.from(await archivo.arrayBuffer())

  const { publicUrl, error } = await uploadFile(storagePath, buffer, archivo.type)
  if (error) return NextResponse.json({ error }, { status: 500 })

  const foto = await prisma.fotoRevisionVehiculo.create({
    data: { solicitudId, tipo, url: publicUrl! },
  })

  return NextResponse.json(foto, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("FLOTA")
  if (!auth.ok) return auth.response

  const { id } = await params
  const { fotoId } = await req.json()

  const solicitudDel = await prisma.solicitudVehiculo.findUnique({ where: { id: parseInt(id) } })
  if (!solicitudDel) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const denyDel = denyIfNotOwner(auth, solicitudDel.creadoPorId)
  if (denyDel) return denyDel

  const foto = await prisma.fotoRevisionVehiculo.findUnique({ where: { id: parseInt(fotoId) } })
  if (!foto) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const storagePath = extractStoragePath(foto.url)
  if (storagePath) await deleteFile(storagePath)

  await prisma.fotoRevisionVehiculo.delete({ where: { id: parseInt(fotoId) } })
  return NextResponse.json({ ok: true })
}