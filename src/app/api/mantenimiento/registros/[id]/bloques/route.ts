import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"
import { uploadFile, toProxyUrl, esImagenValida } from "@/lib/storage"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO", "MANTENIMIENTO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const registroId = parseInt(id)

  const registro = await prisma.registroMantenimiento.findUnique({ where: { id: registroId } })
  if (!registro) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 })

  const formData = await req.formData()
  const actividadId = parseInt(String(formData.get("actividadId")))
  const observaciones = formData.get("observaciones") as string | null
  const hallazgo = formData.get("hallazgo") as string | null
  const respuestasRaw = formData.get("respuestas") as string | null

  if (!actividadId || !respuestasRaw) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
  }

  const yaExiste = await prisma.bloqueMantenimiento.findUnique({
    where: { registroId_actividadId: { registroId, actividadId } },
  })
  if (yaExiste) {
    return NextResponse.json({ error: "Esta actividad ya fue registrada en este registro" }, { status: 409 })
  }

  let respuestas: { campoId: number; valor: string }[]
  try {
    respuestas = JSON.parse(respuestasRaw)
  } catch {
    return NextResponse.json({ error: "Formato de respuestas inválido" }, { status: 400 })
  }

  const actividad = await prisma.actividadMantenimiento.findUnique({
    where: { id: actividadId },
    include: { campos: { where: { activo: true } } },
  })
  if (!actividad) return NextResponse.json({ error: "Actividad no encontrada" }, { status: 404 })

  for (const campo of actividad.campos) {
    const respuesta = respuestas.find((resp) => resp.campoId === campo.id)
    if (!respuesta || !respuesta.valor?.trim()) {
      return NextResponse.json({ error: `Falta completar: ${campo.descripcion}` }, { status: 400 })
    }
    if (campo.tipo === "NUMERO" && isNaN(Number(respuesta.valor))) {
      return NextResponse.json({ error: `${campo.descripcion} debe ser un número` }, { status: 400 })
    }
    if (campo.requiereImagen) {
      const imagenCampo = formData.get(`imagen_${campo.id}`)
      if (!(imagenCampo instanceof File)) {
        return NextResponse.json({ error: `Falta la foto de: ${campo.descripcion}` }, { status: 400 })
      }
      if (!esImagenValida(Buffer.from(await imagenCampo.arrayBuffer()))) {
        return NextResponse.json({ error: `La foto de "${campo.descripcion}" no es una imagen válida` }, { status: 400 })
      }
    }
  }

  const userId = parseInt(auth.session.user.id)

  const bloque = await prisma.bloqueMantenimiento.create({
    data: { registroId, actividadId, creadoPorId: userId, observaciones: observaciones?.trim() || null },
  })

  for (const r of respuestas) {
    const archivo = formData.get(`imagen_${r.campoId}`) as File | null
    let imagenUrl: string | null = null

    if (archivo) {
      const ext = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg"
      const buffer = Buffer.from(await archivo.arrayBuffer())
      const storagePath = `mantenimiento/${registroId}/bloque_${bloque.id}/campo_${r.campoId}.${ext}`
      const { publicUrl, error } = await uploadFile(storagePath, buffer, archivo.type)
      if (error) {
        console.error("[mantenimiento/bloques] error subiendo imagen:", error)
      } else {
        imagenUrl = publicUrl
      }
    }

    await prisma.respuestaMantenimiento.create({
      data: { bloqueId: bloque.id, campoId: r.campoId, valor: r.valor, imagenUrl },
    })
  }

  if (hallazgo?.trim()) {
    await prisma.hallazgoMantenimiento.create({
      data: { bloqueId: bloque.id, descripcion: hallazgo.trim(), creadoPorId: userId },
    })
  }

  // Un bloque nuevo "pone al día" la actividad: si vuelve a quedar atrasada, que pueda alertar de nuevo
  await prisma.actividadMantenimiento.update({
    where: { id: actividadId },
    data: { ultimaAlertaEnviada: null },
  })

  const bloqueCompleto = await prisma.bloqueMantenimiento.findUnique({
    where: { id: bloque.id },
    include: {
      actividad: { select: { nombre: true } },
      creadoPor: { select: { name: true } },
      respuestas: { include: { campo: true }, orderBy: { campo: { orden: "asc" } } },
      hallazgos: true,
    },
  })

  return NextResponse.json(
    bloqueCompleto && {
      ...bloqueCompleto,
      respuestas: bloqueCompleto.respuestas.map((r) => ({ ...r, imagenUrl: toProxyUrl(r.imagenUrl) })),
    },
    { status: 201 }
  )
}
