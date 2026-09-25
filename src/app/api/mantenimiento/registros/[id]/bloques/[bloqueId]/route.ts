import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"
import { uploadFile, toProxyUrl, esImagenValida } from "@/lib/storage"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; bloqueId: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO", "MANTENIMIENTO")
  if (!auth.ok) return auth.response

  const { bloqueId } = await params
  const id = parseInt(bloqueId)

  const bloque = await prisma.bloqueMantenimiento.findUnique({
    where: { id },
    include: { respuestas: { include: { campo: true } } },
  })
  if (!bloque) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const userId = parseInt(auth.session.user.id)
  const role = auth.session.user.role
  if (role === "MANTENIMIENTO" && bloque.creadoPorId !== userId) {
    return NextResponse.json({ error: "Solo puedes editar tus propios registros" }, { status: 403 })
  }

  const formData = await req.formData()
  const observaciones = formData.get("observaciones") as string | null
  const respuestasRaw = formData.get("respuestas") as string | null
  if (!respuestasRaw) return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })

  let respuestas: { campoId: number; valor: string }[]
  try {
    respuestas = JSON.parse(respuestasRaw)
  } catch {
    return NextResponse.json({ error: "Formato de respuestas inválido" }, { status: 400 })
  }

  for (const r of bloque.respuestas) {
    const nueva = respuestas.find((x) => x.campoId === r.campoId)
    if (!nueva || !nueva.valor?.trim()) {
      return NextResponse.json({ error: `Falta completar: ${r.campo.descripcion}` }, { status: 400 })
    }
    if (r.campo.tipo === "NUMERO" && isNaN(Number(nueva.valor))) {
      return NextResponse.json({ error: `${r.campo.descripcion} debe ser un número` }, { status: 400 })
    }
    const imagenCampo = formData.get(`imagen_${r.campoId}`)
    if (imagenCampo instanceof File && !esImagenValida(Buffer.from(await imagenCampo.arrayBuffer()))) {
      return NextResponse.json({ error: `La foto de "${r.campo.descripcion}" no es una imagen válida` }, { status: 400 })
    }
  }

  // Snapshot del estado actual antes de aplicar los cambios
  await prisma.bloqueMantenimientoVersion.create({
    data: {
      bloqueId: id,
      editadoPorId: userId,
      datos: {
        observaciones: bloque.observaciones,
        respuestas: bloque.respuestas.map((r) => ({
          campoId: r.campoId,
          descripcion: r.campo.descripcion,
          valor: r.valor,
          imagenUrl: r.imagenUrl,
        })),
      },
    },
  })

  for (const r of respuestas) {
    const archivo = formData.get(`imagen_${r.campoId}`) as File | null
    const datos: { valor: string; imagenUrl?: string } = { valor: r.valor }

    if (archivo) {
      const ext = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg"
      const buffer = Buffer.from(await archivo.arrayBuffer())
      const storagePath = `mantenimiento/${bloque.registroId}/bloque_${id}/campo_${r.campoId}.${ext}`
      const { publicUrl, error } = await uploadFile(storagePath, buffer, archivo.type)
      if (!error) datos.imagenUrl = publicUrl!
    }

    await prisma.respuestaMantenimiento.update({
      where: { bloqueId_campoId: { bloqueId: id, campoId: r.campoId } },
      data: datos,
    })
  }

  await prisma.bloqueMantenimiento.update({
    where: { id },
    data: {
      observaciones: observaciones?.trim() || null,
      editadoPorId: userId,
      fechaEdicion: new Date(),
    },
  })

  const bloqueActualizado = await prisma.bloqueMantenimiento.findUnique({
    where: { id },
    include: {
      actividad: { select: { nombre: true } },
      creadoPor: { select: { name: true } },
      editadoPor: { select: { name: true } },
      respuestas: { include: { campo: true }, orderBy: { campo: { orden: "asc" } } },
      hallazgos: true,
    },
  })

  return NextResponse.json(
    bloqueActualizado && {
      ...bloqueActualizado,
      respuestas: bloqueActualizado.respuestas.map((r) => ({ ...r, imagenUrl: toProxyUrl(r.imagenUrl) })),
    }
  )
}
