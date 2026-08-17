import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"
import { firmarDocumentoDesatendido } from "@/lib/firmagob"
import { uploadFile } from "@/lib/storage"
import { TipoMovimiento, TipoDocumento } from "@/generated/prisma/client"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN")
  if (!auth.ok) return auth.response

  const { rut, id: userId } = auth.session.user
  if (!rut) {
    return NextResponse.json(
      { error: "Tu usuario no tiene RUT configurado. Solicita al administrador que lo ingrese en tu perfil." },
      { status: 400 }
    )
  }

  const { id } = await params
  const actaId = parseInt(id)

  const acta = await prisma.actaRetiroSanitario.findUnique({
    where: { id: actaId },
    include: { items: true },
  })

  if (!acta) return NextResponse.json({ error: "Acta no encontrada" }, { status: 404 })
  if (acta.modulo !== "BODEGA") return NextResponse.json({ error: "Módulo incorrecto" }, { status: 400 })
  if (acta.estado !== "PENDIENTE_JEFE") {
    return NextResponse.json({ error: "El acta no está pendiente de firma del jefe" }, { status: 409 })
  }
  if (!acta.urlFirmadoResponsable) {
    return NextResponse.json({ error: "No hay PDF firmado por el responsable" }, { status: 400 })
  }

  const pdfResp = await fetch(acta.urlFirmadoResponsable)
  if (!pdfResp.ok) {
    return NextResponse.json({ error: "No se pudo obtener el PDF del responsable" }, { status: 500 })
  }
  const pdfBase64 = Buffer.from(await pdfResp.arrayBuffer()).toString("base64")

  const descripcion = `${acta.descripcion} — Autorizado por jefe`
  const resultado = await firmarDocumentoDesatendido({ rutFirmante: rut, pdfBase64, descripcion })

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 400 })
  }

  const bufferFinal = Buffer.from(resultado.pdfFirmadoBase64!, "base64")
  const { publicUrl: urlFirmadoFinal } = await uploadFile(
    `firma/acta_retiro_bodega/${actaId}-final.pdf`, bufferFinal, "application/pdf"
  )

  const userIdInt = parseInt(userId)
  const itemsConProducto = acta.items.filter(i => i.productoId)

  await prisma.$transaction(async (tx) => {
    await tx.actaRetiroSanitario.update({
      where: { id: actaId },
      data: {
        estado: "FIRMADA", urlFirmadoFinal: urlFirmadoFinal ?? null,
        firmadoJefeId: userIdInt, fechaFirmaJefe: new Date(),
      },
    })

    for (const item of itemsConProducto) {
      const producto = await tx.productoBodega.findUnique({ where: { id: item.productoId! } })
      if (!producto) continue
      const nuevoStock = Math.max(0, producto.stockActual - item.cantidad)

      await tx.movimientoBodega.create({
        data: {
          tipo: TipoMovimiento.RETIRO_SANITARIO,
          cantidad: item.cantidad,
          documento: TipoDocumento.ACTA_RETIRO_SANITARIO,
          observacion: `[RETIRO SANITARIO #${actaId}] Causa: ${acta.causa}. Destino: ${acta.destino}${item.lote ? `. Lote: ${item.lote}` : ""}. Stock antes: ${producto.stockActual} → después: ${nuevoStock}. Autorizado por: ${auth.session.user.name}`,
          productoId: item.productoId!,
          usuarioId: userIdInt,
        },
      })
      await tx.productoBodega.update({
        where: { id: item.productoId! },
        data: { stockActual: nuevoStock },
      })
    }
  })

  await prisma.documentoFirmado.create({
    data: {
      origen: "ACTA_RETIRO_SANITARIO_BODEGA", origenId: actaId, descripcion,
      estado: "FIRMADO", urlFirmado: urlFirmadoFinal ?? null,
      checksumOriginal: resultado.checksumOriginal ?? null,
      checksumFirmado: resultado.checksumFirmado ?? null,
      idSolicitudFirmagob: resultado.idSolicitud ?? null,
      firmadoEn: new Date(), creadoPorId: userIdInt, firmadoPorId: userIdInt,
    },
  })

  return NextResponse.json({
    ok: true, urlFirmadoFinal: urlFirmadoFinal ?? null,
    retiradosAplicados: itemsConProducto.length,
  })
}
