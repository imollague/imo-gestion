import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { transporter, EMAIL_FROM, EMAIL_ADMINS } from "@/lib/mailer"

// Endpoint protegido por CRON_SECRET (se llama desde cron externo o cron interno)
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (EMAIL_ADMINS.length === 0) {
    return NextResponse.json({ mensaje: "No hay destinatarios configurados (ALERT_EMAILS)" })
  }

  const ahora = new Date()
  const en30dias = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000)

  // Paralelo: obtener datos de alerta
  const [
    productosCriticos,
    medicamentosCriticos,
    lotesVencidos,
    lotesPorVencer,
    vencimientosVehiculo,
  ] = await Promise.all([
    prisma.$queryRaw<{ nombre: string; codigo: string; stockActual: number; stockMinimo: number; unidad: string }[]>`
      SELECT nombre, codigo, "stockActual", "stockMinimo", unidad
      FROM "ProductoBodega"
      WHERE activo = true AND "stockActual" <= "stockMinimo"
      ORDER BY "stockActual" ASC
      LIMIT 20
    `,
    prisma.$queryRaw<{ nombreGenerico: string; codigo: string; stockActual: number; stockMinimo: number; unidad: string }[]>`
      SELECT "nombreGenerico", codigo, "stockActual", "stockMinimo", unidad
      FROM "Medicamento"
      WHERE activo = true AND "stockActual" <= "stockMinimo"
      ORDER BY "stockActual" ASC
      LIMIT 20
    `,
    prisma.loteFarmacia.findMany({
      where: {
        retirado: false,
        stockActual: { gt: 0 },
        fechaVencimiento: { lt: ahora },
      },
      select: { numeroLote: true, fechaVencimiento: true, stockActual: true, medicamento: { select: { nombreGenerico: true } } },
      orderBy: { fechaVencimiento: "asc" },
      take: 20,
    }),
    prisma.loteFarmacia.findMany({
      where: {
        retirado: false,
        stockActual: { gt: 0 },
        fechaVencimiento: { gte: ahora, lte: en30dias },
      },
      select: { numeroLote: true, fechaVencimiento: true, stockActual: true, medicamento: { select: { nombreGenerico: true } } },
      orderBy: { fechaVencimiento: "asc" },
      take: 20,
    }),
    prisma.vencimientoDocumentoVehiculo.findMany({
      include: { vehiculo: { select: { patente: true } }, tipoDocumento: true },
    }),
  ])

  const vehiculosVencidos = vencimientosVehiculo
    .filter((ve) => ve.fechaVencimiento < ahora)
    .sort((a, b) => a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime())
  const vehiculosPorVencer = vencimientosVehiculo
    .filter((ve) => {
      if (ve.fechaVencimiento < ahora) return false
      const umbral = ve.diasAlerta ?? ve.tipoDocumento.diasAlertaDefault
      const limite = new Date(ahora.getTime() + umbral * 86400000)
      return ve.fechaVencimiento <= limite
    })
    .sort((a, b) => a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime())

  const hayAlertas =
    productosCriticos.length > 0 ||
    medicamentosCriticos.length > 0 ||
    lotesVencidos.length > 0 ||
    lotesPorVencer.length > 0 ||
    vehiculosVencidos.length > 0 ||
    vehiculosPorVencer.length > 0

  if (!hayAlertas) {
    return NextResponse.json({ mensaje: "Sin alertas activas, no se envió email" })
  }

  const formatFecha = (d: Date) =>
    d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })

  // Construir HTML del email
  const rows = (items: string[]) => items.map((i) => `<tr>${i}</tr>`).join("")

  const seccionProductos = productosCriticos.length > 0 ? `
    <h3 style="color:#1d4ed8;margin-top:20px">⚠️ Bodega: Productos con stock crítico (${productosCriticos.length})</h3>
    <table border="0" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px">
      <thead style="background:#eff6ff"><tr>
        <th align="left" style="border-bottom:1px solid #bfdbfe">Código</th>
        <th align="left" style="border-bottom:1px solid #bfdbfe">Nombre</th>
        <th align="right" style="border-bottom:1px solid #bfdbfe">Stock actual</th>
        <th align="right" style="border-bottom:1px solid #bfdbfe">Stock mínimo</th>
      </tr></thead>
      <tbody>${rows(productosCriticos.map((p) => `
        <td style="border-bottom:1px solid #f1f5f9">${p.codigo}</td>
        <td style="border-bottom:1px solid #f1f5f9">${p.nombre}</td>
        <td align="right" style="border-bottom:1px solid #f1f5f9;color:${p.stockActual === 0 ? "#dc2626" : "#f97316"};font-weight:bold">${p.stockActual} ${p.unidad}</td>
        <td align="right" style="border-bottom:1px solid #f1f5f9">${p.stockMinimo} ${p.unidad}</td>
      `))}
      </tbody>
    </table>
  ` : ""

  const seccionMedicamentos = medicamentosCriticos.length > 0 ? `
    <h3 style="color:#15803d;margin-top:20px">⚠️ Farmacia: Medicamentos con stock crítico (${medicamentosCriticos.length})</h3>
    <table border="0" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px">
      <thead style="background:#f0fdf4"><tr>
        <th align="left" style="border-bottom:1px solid #bbf7d0">Código</th>
        <th align="left" style="border-bottom:1px solid #bbf7d0">Medicamento</th>
        <th align="right" style="border-bottom:1px solid #bbf7d0">Stock actual</th>
        <th align="right" style="border-bottom:1px solid #bbf7d0">Stock mínimo</th>
      </tr></thead>
      <tbody>${rows(medicamentosCriticos.map((m) => `
        <td style="border-bottom:1px solid #f1f5f9">${m.codigo}</td>
        <td style="border-bottom:1px solid #f1f5f9">${m.nombreGenerico}</td>
        <td align="right" style="border-bottom:1px solid #f1f5f9;color:${m.stockActual === 0 ? "#dc2626" : "#f97316"};font-weight:bold">${m.stockActual} ${m.unidad}</td>
        <td align="right" style="border-bottom:1px solid #f1f5f9">${m.stockMinimo} ${m.unidad}</td>
      `))}
      </tbody>
    </table>
  ` : ""

  const seccionLotesVencidos = lotesVencidos.length > 0 ? `
    <h3 style="color:#dc2626;margin-top:20px">🚨 Farmacia: Lotes vencidos con stock (${lotesVencidos.length})</h3>
    <table border="0" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px">
      <thead style="background:#fef2f2"><tr>
        <th align="left" style="border-bottom:1px solid #fecaca">Medicamento</th>
        <th align="left" style="border-bottom:1px solid #fecaca">N° Lote</th>
        <th align="left" style="border-bottom:1px solid #fecaca">Vencimiento</th>
        <th align="right" style="border-bottom:1px solid #fecaca">Stock</th>
      </tr></thead>
      <tbody>${rows(lotesVencidos.map((l) => `
        <td style="border-bottom:1px solid #f1f5f9">${l.medicamento.nombreGenerico}</td>
        <td style="border-bottom:1px solid #f1f5f9;font-family:monospace">${l.numeroLote}</td>
        <td style="border-bottom:1px solid #f1f5f9;color:#dc2626;font-weight:bold">${l.fechaVencimiento ? formatFecha(l.fechaVencimiento) : "—"}</td>
        <td align="right" style="border-bottom:1px solid #f1f5f9">${l.stockActual}</td>
      `))}
      </tbody>
    </table>
  ` : ""

  const seccionLotesPorVencer = lotesPorVencer.length > 0 ? `
    <h3 style="color:#d97706;margin-top:20px">⏰ Farmacia: Lotes próximos a vencer (${lotesPorVencer.length})</h3>
    <table border="0" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px">
      <thead style="background:#fffbeb"><tr>
        <th align="left" style="border-bottom:1px solid #fde68a">Medicamento</th>
        <th align="left" style="border-bottom:1px solid #fde68a">N° Lote</th>
        <th align="left" style="border-bottom:1px solid #fde68a">Vencimiento</th>
        <th align="right" style="border-bottom:1px solid #fde68a">Stock</th>
      </tr></thead>
      <tbody>${rows(lotesPorVencer.map((l) => `
        <td style="border-bottom:1px solid #f1f5f9">${l.medicamento.nombreGenerico}</td>
        <td style="border-bottom:1px solid #f1f5f9;font-family:monospace">${l.numeroLote}</td>
        <td style="border-bottom:1px solid #f1f5f9;color:#d97706;font-weight:bold">${l.fechaVencimiento ? formatFecha(l.fechaVencimiento) : "—"}</td>
        <td align="right" style="border-bottom:1px solid #f1f5f9">${l.stockActual}</td>
      `))}
      </tbody>
    </table>
  ` : ""

  const seccionVehiculosVencidos = vehiculosVencidos.length > 0 ? `
    <h3 style="color:#dc2626;margin-top:20px">🚨 Flota: Documentos vencidos (${vehiculosVencidos.length})</h3>
    <table border="0" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px">
      <thead style="background:#fef2f2"><tr>
        <th align="left" style="border-bottom:1px solid #fecaca">Vehículo</th>
        <th align="left" style="border-bottom:1px solid #fecaca">Documento</th>
        <th align="left" style="border-bottom:1px solid #fecaca">Vencimiento</th>
      </tr></thead>
      <tbody>${rows(vehiculosVencidos.map((v) => `
        <td style="border-bottom:1px solid #f1f5f9;font-family:monospace">${v.vehiculo.patente}</td>
        <td style="border-bottom:1px solid #f1f5f9">${v.tipoDocumento.nombre}</td>
        <td style="border-bottom:1px solid #f1f5f9;color:#dc2626;font-weight:bold">${formatFecha(v.fechaVencimiento)}</td>
      `))}
      </tbody>
    </table>
  ` : ""

  const seccionVehiculosPorVencer = vehiculosPorVencer.length > 0 ? `
    <h3 style="color:#d97706;margin-top:20px">⏰ Flota: Documentos próximos a vencer (${vehiculosPorVencer.length})</h3>
    <table border="0" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px">
      <thead style="background:#fffbeb"><tr>
        <th align="left" style="border-bottom:1px solid #fde68a">Vehículo</th>
        <th align="left" style="border-bottom:1px solid #fde68a">Documento</th>
        <th align="left" style="border-bottom:1px solid #fde68a">Vencimiento</th>
      </tr></thead>
      <tbody>${rows(vehiculosPorVencer.map((v) => `
        <td style="border-bottom:1px solid #f1f5f9;font-family:monospace">${v.vehiculo.patente}</td>
        <td style="border-bottom:1px solid #f1f5f9">${v.tipoDocumento.nombre}</td>
        <td style="border-bottom:1px solid #f1f5f9;color:#d97706;font-weight:bold">${formatFecha(v.fechaVencimiento)}</td>
      `))}
      </tbody>
    </table>
  ` : ""

  const html = `
    <div style="font-family:sans-serif;max-width:650px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 4px">Alerta de inventario — IMO Stock</h2>
      <p style="color:#6b7280;margin:0 0 20px;font-size:13px">Generado el ${formatFecha(ahora)} — Resumen automático de alertas activas</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:16px">
      ${seccionProductos}
      ${seccionMedicamentos}
      ${seccionLotesVencidos}
      ${seccionLotesPorVencer}
      ${seccionVehiculosVencidos}
      ${seccionVehiculosPorVencer}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin-top:24px;margin-bottom:12px">
      <p style="color:#9ca3af;font-size:11px;margin:0">Este mensaje fue generado automáticamente por IMO Stock. No responder este email.</p>
    </div>
  `

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: EMAIL_ADMINS.join(", "),
    subject: `[IMO Stock] Alerta de inventario — ${formatFecha(ahora)}`,
    html,
  })

  return NextResponse.json({
    mensaje: "Email enviado",
    destinatarios: EMAIL_ADMINS,
    alertas: {
      productosCriticos: productosCriticos.length,
      medicamentosCriticos: medicamentosCriticos.length,
      lotesVencidos: lotesVencidos.length,
      lotesPorVencer: lotesPorVencer.length,
      vehiculosVencidos: vehiculosVencidos.length,
      vehiculosPorVencer: vehiculosPorVencer.length,
    },
  })
}
