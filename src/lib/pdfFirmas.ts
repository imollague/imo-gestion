import jsPDF from "jspdf"
import { agregarPaginaMembretada } from "./pdfMembrete"

const STAMP_ASSET = "/brand_firma.png"
const STAMP_SIZE = 28 // mm — timbre circular "Documento firmado electrónicamente"
const FILA_ALTO = 46 // mm por fila de firmas (timbre + nombre + rut)
const MAX_POR_FILA = 2 // máximo de timbres uno junto a otro (izquierda/derecha)

export interface Firmante {
  nombre: string
  rut: string
}

let stampDataUrlPromise: Promise<string> | null = null
function cargarSello(): Promise<string> {
  if (!stampDataUrlPromise) {
    stampDataUrlPromise = fetch(STAMP_ASSET)
      .then((res) => res.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
      )
  }
  return stampDataUrlPromise
}

/**
 * Agrega una hoja de firmas separada del contenido (nunca en la misma página):
 * un timbre "Documento firmado electrónicamente" por firmante, con su nombre
 * y RUT debajo. Máximo 2 timbres por fila (izquierda/derecha); el resto se
 * posiciona en filas siguientes y, si no caben, en páginas nuevas.
 */
export async function agregarHojaFirmas(
  doc: jsPDF,
  margenX: number,
  anchoUtil: number,
  firmantes: Firmante[],
  dependencia?: string
): Promise<void> {
  if (firmantes.length === 0) return

  const sello = await cargarSello()
  let { yContenido, yPiePagina } = await agregarPaginaMembretada(doc, margenX, dependencia)
  let y = yContenido + 20

  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.setTextColor(0)
  doc.text("Firmas", margenX, y)
  y += 14

  const colAncho = anchoUtil / MAX_POR_FILA

  for (let i = 0; i < firmantes.length; i += MAX_POR_FILA) {
    if (y + FILA_ALTO > yPiePagina) {
      ;({ yContenido, yPiePagina } = await agregarPaginaMembretada(doc, margenX, dependencia))
      y = yContenido + 20
    }

    const fila = firmantes.slice(i, i + MAX_POR_FILA)
    fila.forEach((f, idx) => {
      const colX = margenX + idx * colAncho
      const centroX = colX + colAncho / 2
      doc.addImage(sello, "PNG", centroX - STAMP_SIZE / 2, y, STAMP_SIZE, STAMP_SIZE)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(11)
      doc.setTextColor(30, 30, 30)
      doc.text(f.nombre, centroX, y + STAMP_SIZE + 7, { align: "center" })
      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      doc.setTextColor(90, 90, 90)
      doc.text(f.rut, centroX, y + STAMP_SIZE + 13, { align: "center" })
    })

    y += FILA_ALTO
  }
}
