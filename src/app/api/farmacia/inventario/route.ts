import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireRole } from "@/lib/apiAuth"
import { firmarDocumentoDesatendido } from "@/lib/firmagob"
import { uploadFile } from "@/lib/storage"

// GET — actas pendientes de firma del jefe
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const userId = parseInt(auth.session.user.id)
  const role = auth.session.user.role

  const where =
    role === "ADMIN"
      ? { modulo: "FARMACIA", estado: "PENDIENTE_JEFE" }
      : { modulo: "FARMACIA", estado: "PENDIENTE_JEFE", jefeId: userId }

  const actas = await prisma.actaInventario.findMany({
    where,
    include: {
      creadoPor: { select: { name: true } },
      items: {
        where: { diferencia: { not: 0 } },
        select: { nombre: true, stockSistema: true, stockContado: true, diferencia: true },
        orderBy: { id: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(actas)
}

// POST — crear nueva acta de inventario y firmar como responsable
export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN", "FARMACIA")
  if (!auth.ok) return auth.response

  const { rut } = auth.session.user
  if (!rut) {
    return NextResponse.json(
      { error: "Tu usuario no tiene RUT configurado. Solicita al administrador que lo ingrese en tu perfil." },
      { status: 400 }
    )
  }

  const body = await req.json()
  const { items, jefeId, observaciones, pdfBase64 } = body

  if (!pdfBase64 || !items?.length) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
  }

  const userId = parseInt(auth.session.user.id)
  const tieneDiferencias = items.some(
    (i: { stockSistema: number; stockContado: number }) => i.stockContado !== i.stockSistema
  )

  if (tieneDiferencias && !jefeId) {
    return NextResponse.json(
      { error: "Hay diferencias detectadas. Selecciona un jefe para autorizar los ajustes." },
      { status: 400 }
    )
  }

  const fechaStr = new Date().toLocaleDateString("es-CL")
  const descripcion = `Acta de Inventario Farmacia — ${fechaStr}`

  const acta = await prisma.actaInventario.create({
    data: {
      modulo: "FARMACIA",
      estado: tieneDiferencias ? "PENDIENTE_JEFE" : "FIRMADA",
      descripcion,
      tieneDiferencias,
      observaciones: observaciones ?? null,
      jefeId: tieneDiferencias ? jefeId : null,
      creadoPorId: userId,
      items: {
        create: items.map((i: {
          medicamentoId: number; nombre: string; codigo: string; unidad: string;
          stockSistema: number; stockContado: number;
        }) => ({
          nombre: i.nombre,
          codigo: i.codigo,
          unidad: i.unidad,
          stockSistema: i.stockSistema,
          stockContado: i.stockContado,
          diferencia: i.stockContado - i.stockSistema,
          medicamentoId: i.medicamentoId,
        })),
      },
    },
  })

  const resultado = await firmarDocumentoDesatendido({ rutFirmante: rut, pdfBase64, descripcion })

  if (!resultado.ok) {
    await prisma.actaInventario.update({
      where: { id: acta.id },
      data: { estado: "ERROR", errorMsg: resultado.error },
    })
    return NextResponse.json({ error: resultado.error }, { status: 400 })
  }

  const bufferFirmado = Buffer.from(resultado.pdfFirmadoBase64!, "base64")
  const { publicUrl: urlFirmadoResponsable } = await uploadFile(
    `firma/acta_inventario_farmacia/${acta.id}-responsable.pdf`,
    bufferFirmado,
    "application/pdf"
  )

  const updateData: {
    urlFirmadoResponsable: string | null;
    urlFirmadoFinal?: string | null;
  } = { urlFirmadoResponsable: urlFirmadoResponsable ?? null }

  if (!tieneDiferencias) {
    updateData.urlFirmadoFinal = urlFirmadoResponsable ?? null
  }

  await prisma.actaInventario.update({ where: { id: acta.id }, data: updateData })

  await prisma.documentoFirmado.create({
    data: {
      origen: "ACTA_INVENTARIO_FARMACIA",
      origenId: acta.id,
      descripcion,
      estado: "FIRMADO",
      urlFirmado: urlFirmadoResponsable ?? null,
      checksumOriginal: resultado.checksumOriginal ?? null,
      checksumFirmado: resultado.checksumFirmado ?? null,
      idSolicitudFirmagob: resultado.idSolicitud ?? null,
      firmadoEn: new Date(),
      creadoPorId: userId,
      firmadoPorId: userId,
    },
  })

  return NextResponse.json({
    ok: true,
    actaId: acta.id,
    estado: tieneDiferencias ? "PENDIENTE_JEFE" : "FIRMADA",
    tieneDiferencias,
    urlFirmadoResponsable: urlFirmadoResponsable ?? null,
  })
}
