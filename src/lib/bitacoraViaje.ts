import { crearPDFMembretado, agregarPaginaMembretada } from "@/lib/pdfMembrete"

export interface PasajeroBitacora { nombre: string; rut: string | null }

export interface ParadaBitacora {
  id: number
  km: number
  descripcion: string | null
  litros: number | null
  comprobanteRef: string | null
  comprobanteFotoUrl: string | null
  fecha: string
  pasajeros: PasajeroBitacora[]
}

export interface DatosBitacoraViaje {
  solicitudId: number
  folio: string | null
  estado: string
  conductor: string
  vehiculo: string // "PATENTE — Marca Modelo"
  destino: string
  proposito: string
  horaSalidaEst: string | null
  horaRetornoEst: string | null
  /** Momento en que se registró la salida (no se guarda una hora de salida real aparte) */
  salidaRegistradaEn: string
  kmSalida: number
  kmLlegada: number | null
  horaRetornoReal: string | null
  observacion: string | null
  paradas: ParadaBitacora[]
}

export function fmtFechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export function resumenBitacora(d: DatosBitacoraViaje) {
  const kmRecorridos = d.kmLlegada != null ? d.kmLlegada - d.kmSalida : null
  const litros = d.paradas.reduce((s, p) => s + (p.litros ?? 0), 0)
  let duracion: string | null = null
  if (d.horaRetornoReal) {
    const min = Math.round((new Date(d.horaRetornoReal).getTime() - new Date(d.salidaRegistradaEn).getTime()) / 60000)
    if (min > 0) {
      const dias = Math.floor(min / 1440)
      const horas = Math.floor((min % 1440) / 60)
      const mins = min % 60
      duracion = `${dias > 0 ? `${dias} d ` : ""}${horas} h ${mins} min`
    }
  }
  return { kmRecorridos, litros, duracion, paradas: d.paradas.length }
}

/** PDF de la bitácora de un viaje: salida, paradas (con combustible y pasajeros) y llegada. */
export async function generarPDFBitacora(d: DatosBitacoraViaje) {
  const { doc, margenX, anchoUtil, yContenido, yPiePagina: yPieInicial } = await crearPDFMembretado()
  let y = yContenido
  let yPie = yPieInicial
  const altoLinea = 5.5
  const resumen = resumenBitacora(d)

  const asegurarEspacio = async (alto: number) => {
    if (y + alto > yPie) {
      ;({ yContenido: y, yPiePagina: yPie } = await agregarPaginaMembretada(doc, margenX))
      doc.setTextColor(0)
    }
  }

  // Escribe texto ajustado al ancho desde `x`; cada línea comprueba el fin de página
  const escribir = async (texto: string, x: number, opts: { bold?: boolean; size?: number; color?: number } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal")
    doc.setFontSize(opts.size ?? 10)
    doc.setTextColor(opts.color ?? 0)
    const lineas: string[] = texto.split("\n").flatMap((l) => doc.splitTextToSize(l || " ", margenX + anchoUtil - x))
    for (const l of lineas) {
      await asegurarEspacio(altoLinea)
      doc.text(l, x, y)
      y += altoLinea
    }
  }

  // ── Título ──
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.setTextColor(0)
  doc.text(`Bitácora de viaje${d.folio ? ` — ${d.folio}` : ` — Solicitud N° ${d.solicitudId}`}`, margenX, y)
  y += 6
  doc.setDrawColor(200)
  doc.line(margenX, y, margenX + anchoUtil, y)
  y += 8

  // ── Datos del viaje ──
  const campos: [string, string][] = [
    ["Conductor", d.conductor],
    ["Vehículo", d.vehiculo],
    ["Destino", d.destino],
    ["Propósito", d.proposito],
    ["Salida estimada", d.horaSalidaEst ? fmtFechaHora(d.horaSalidaEst) : "—"],
    ["Retorno estimado", d.horaRetornoEst ? fmtFechaHora(d.horaRetornoEst) : "—"],
  ]
  for (const [label, valor] of campos) {
    const inicio = y
    await escribir(valor, margenX + 40)
    // la etiqueta se dibuja en la primera línea del valor (puede haber saltado de página)
    const yEtiqueta = inicio + altoLinea > yPie ? yContenido : inicio
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.text(`${label}:`, margenX, yEtiqueta)
    y += 1.5
  }

  // ── Resumen ──
  y += 3
  await asegurarEspacio(16)
  doc.setFillColor(243, 244, 246)
  doc.roundedRect(margenX, y - 4, anchoUtil, 13, 2, 2, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(30)
  const partes = [
    resumen.kmRecorridos != null ? `${resumen.kmRecorridos.toLocaleString("es-CL")} km recorridos` : "Viaje en curso",
    `${resumen.paradas} parada${resumen.paradas === 1 ? "" : "s"}`,
    `${resumen.litros.toFixed(1)} L cargados`,
    ...(resumen.duracion ? [`Duración ${resumen.duracion}`] : []),
  ]
  doc.text(partes.join("   ·   "), margenX + 4, y + 3)
  y += 17

  // ── Recorrido ──
  const titulo = async (txt: string) => {
    await asegurarEspacio(altoLinea * 3)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.setTextColor(0)
    doc.text(txt, margenX, y)
    y += 6
  }
  await titulo("Recorrido")

  const hito = async (etiqueta: string, cuando: string | null, km: number | null, detalle: string[]) => {
    await asegurarEspacio(altoLinea * 2)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10.5)
    doc.setTextColor(30)
    doc.text(etiqueta, margenX, y)
    const derecha = [cuando, km != null ? `${km.toLocaleString("es-CL")} km` : null].filter(Boolean).join("   ·   ")
    doc.setFont("helvetica", "normal")
    doc.setTextColor(80)
    doc.text(derecha, margenX + anchoUtil, y, { align: "right" })
    y += altoLinea
    for (const linea of detalle) await escribir(linea, margenX + 6, { color: 60 })
    y += 3
  }

  await hito("SALIDA", fmtFechaHora(d.salidaRegistradaEn), d.kmSalida, [])

  let n = 0
  for (const p of d.paradas) {
    n += 1
    const detalle: string[] = []
    detalle.push(`${(p.km - d.kmSalida).toLocaleString("es-CL")} km desde la salida`)
    if (p.descripcion) detalle.push(p.descripcion)
    if (p.litros) {
      detalle.push(`Combustible: ${p.litros} L${p.comprobanteRef ? ` — comprobante ${p.comprobanteRef}` : ""}${p.comprobanteFotoUrl ? " (foto adjunta en el sistema)" : ""}`)
    }
    if (p.pasajeros.length > 0) {
      detalle.push(`Pasajeros: ${p.pasajeros.map((x) => `${x.nombre}${x.rut ? ` (${x.rut})` : ""}`).join(", ")}`)
    }
    await hito(`PARADA ${n}`, fmtFechaHora(p.fecha), p.km, detalle)
  }

  if (d.kmLlegada != null) {
    await hito("LLEGADA", d.horaRetornoReal ? fmtFechaHora(d.horaRetornoReal) : null, d.kmLlegada, [])
  } else {
    await escribir("Viaje en curso: aún no se registra la llegada.", margenX, { color: 120 })
  }

  if (d.observacion) {
    y += 2
    await titulo("Observación del viaje")
    await escribir(d.observacion, margenX)
  }

  doc.save(`Bitacora-${d.folio ?? `solicitud-${d.solicitudId}`}-${d.vehiculo.split(" ")[0]}.pdf`)
}
