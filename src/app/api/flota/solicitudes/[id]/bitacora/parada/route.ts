import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, denyIfNotOwner } from "@/lib/apiAuth"
import { uploadFile, deleteFile, extractStoragePath, esImagenValida, toProxyUrl } from "@/lib/storage"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("FLOTA")
  if (!auth.ok) return auth.response

  const { id } = await params
  const formData = await req.formData()
  const km = formData.get("km") as string | null
  const descripcion = formData.get("descripcion") as string | null
  const litros = formData.get("litros") as string | null
  const comprobanteRef = formData.get("comprobanteRef") as string | null
  const pasajerosRaw = formData.get("pasajeros") as string | null
  const comprobanteFoto = formData.get("comprobanteFoto") as File | null

  if (km == null || km === "") {
    return NextResponse.json({ error: "Km es obligatorio" }, { status: 400 })
  }

  let pasajeros: { nombre?: string; rut?: string }[] = []
  if (pasajerosRaw) {
    try {
      pasajeros = JSON.parse(pasajerosRaw)
    } catch {
      return NextResponse.json({ error: "Formato de pasajeros inválido" }, { status: 400 })
    }
  }

  const solicitud = await prisma.solicitudVehiculo.findUnique({
    where: { id: parseInt(id) },
    include: { bitacora: true },
  })
  if (!solicitud?.bitacora) return NextResponse.json({ error: "Bitácora no iniciada" }, { status: 404 })

  const denyPost = denyIfNotOwner(auth, solicitud.creadoPorId)
  if (denyPost) return denyPost

  if (solicitud.estado !== "EN_CURSO") {
    return NextResponse.json({ error: "Solicitud no está en curso" }, { status: 400 })
  }

  let comprobanteFotoUrl: string | null = null
  if (comprobanteFoto) {
    const buffer = Buffer.from(await comprobanteFoto.arrayBuffer())
    if (!esImagenValida(buffer)) {
      return NextResponse.json({ error: "La foto del comprobante no es una imagen válida" }, { status: 400 })
    }
    const ext = comprobanteFoto.name.split(".").pop()?.toLowerCase() ?? "jpg"
    const storagePath = `solicitudes/${id}/paradas/${Date.now()}-comprobante.${ext}`
    const { publicUrl, error } = await uploadFile(storagePath, buffer, comprobanteFoto.type)
    if (error) return NextResponse.json({ error }, { status: 500 })
    comprobanteFotoUrl = publicUrl
  }

  const pasajerosData = pasajeros
    .filter((p) => p.nombre?.trim())
    .map((p) => ({ nombre: p.nombre!.trim(), rut: p.rut?.trim() || null }))

  const parada = await prisma.paradaViaje.create({
    data: {
      bitacoraId: solicitud.bitacora.id,
      km: parseInt(km),
      descripcion: descripcion?.trim() || null,
      litros: litros ? parseFloat(litros) : null,
      comprobanteRef: comprobanteRef?.trim() || null,
      comprobanteFotoUrl,
      pasajeros: pasajerosData.length > 0 ? { create: pasajerosData } : undefined,
    },
    include: { pasajeros: { orderBy: { id: "asc" } } },
  })

  return NextResponse.json({ ...parada, comprobanteFotoUrl: toProxyUrl(parada.comprobanteFotoUrl) }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("FLOTA")
  if (!auth.ok) return auth.response

  const { id } = await params
  const { paradaId } = await req.json()

  const solicitudDel = await prisma.solicitudVehiculo.findUnique({ where: { id: parseInt(id) } })
  if (!solicitudDel) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const denyDel = denyIfNotOwner(auth, solicitudDel.creadoPorId)
  if (denyDel) return denyDel

  if (solicitudDel.estado === "CERRADA") {
    return NextResponse.json({ error: "Proceso cerrado, no se puede modificar" }, { status: 400 })
  }

  const parada = await prisma.paradaViaje.findUnique({ where: { id: parseInt(paradaId) } })
  if (parada?.comprobanteFotoUrl) {
    const storagePath = extractStoragePath(parada.comprobanteFotoUrl)
    if (storagePath) await deleteFile(storagePath)
  }

  await prisma.paradaViaje.delete({ where: { id: parseInt(paradaId) } })
  return NextResponse.json({ ok: true })
}