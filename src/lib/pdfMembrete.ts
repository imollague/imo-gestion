import jsPDF from "jspdf"

// Membrete oficial I. Municipalidad de Ollagüe — assets extraídos de public/Carta.docx
const ASSET_BASE = "/carta"

const WAVE_ASPECT = 2602 / 378
const BAR_ASPECT = 2550 / 83

const dataUrlCache = new Map<string, Promise<string>>()

function loadImageDataUrl(path: string): Promise<string> {
  let promise = dataUrlCache.get(path)
  if (!promise) {
    promise = fetch(path)
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
    dataUrlCache.set(path, promise)
  }
  return promise
}

export interface Membrete {
  doc: jsPDF
  margenX: number
  anchoUtil: number
  yContenido: number
  yPiePagina: number
}

async function cargarAssetsMembrete() {
  const [wave, sello, barra, iconPhone, iconWeb, iconLoc] = await Promise.all([
    loadImageDataUrl(`${ASSET_BASE}/wave-header.png`),
    loadImageDataUrl(`${ASSET_BASE}/sello-municipal.png`),
    loadImageDataUrl(`${ASSET_BASE}/footer-bar.png`),
    loadImageDataUrl(`${ASSET_BASE}/icon-phone.png`),
    loadImageDataUrl(`${ASSET_BASE}/icon-web.png`),
    loadImageDataUrl(`${ASSET_BASE}/icon-location.png`),
  ])
  return { wave, sello, barra, iconPhone, iconWeb, iconLoc }
}

function dibujarMembrete(
  doc: jsPDF,
  assets: Awaited<ReturnType<typeof cargarAssetsMembrete>>,
  margenX: number,
  dependencia: string
): { yContenido: number; yPiePagina: number } {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const { wave, sello, barra, iconPhone, iconWeb, iconLoc } = assets

  // ── Encabezado ──
  const waveH = pageW / WAVE_ASPECT
  doc.addImage(wave, "PNG", 0, 0, pageW, waveH)

  const selloSize = 24
  doc.addImage(sello, "PNG", margenX - 6, 8, selloSize, selloSize)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.setTextColor(30, 30, 30)
  doc.text("I. MUNICIPALIDAD DE OLLAGÜE", margenX + selloSize + 2, 17)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(90, 90, 90)
  doc.text(dependencia, margenX + selloSize + 2, 23)

  // ── Pie de página ──
  const barW = pageW
  const barH = barW / BAR_ASPECT
  const barY = pageH - 24
  doc.addImage(barra, "PNG", 0, barY, barW, barH)

  const iconSize = 5
  const footerTextY = pageH - 11
  const cols: [string, string, number][] = [
    [iconPhone, "+56 9 9088 7141", margenX - 5],
    [iconWeb, "www.municipalidadollague.cl", margenX + 58],
    [iconLoc, "Avenida Los Héroes S/N, Ollagüe", margenX + 122],
  ]
  doc.setFontSize(8)
  doc.setTextColor(70, 70, 70)
  for (const [icon, texto, x] of cols) {
    doc.addImage(icon, "PNG", x, footerTextY - iconSize + 1.5, iconSize, iconSize)
    doc.text(texto, x + iconSize + 2, footerTextY)
  }

  return { yContenido: waveH + selloSize + 4, yPiePagina: barY - 6 }
}

/**
 * Crea un jsPDF tamaño carta con el membrete oficial (encabezado con sello +
 * franja institucional, pie de página con datos de contacto), replicando
 * public/Carta.docx. Devuelve las coordenadas útiles para dibujar el cuerpo.
 */
export async function crearPDFMembretado(dependencia = "OFICINA DE INFORMÁTICA"): Promise<Membrete> {
  const doc = new jsPDF({ format: "letter", unit: "mm", compress: true })
  const pageW = doc.internal.pageSize.getWidth()
  const margenX = 20

  const assets = await cargarAssetsMembrete()
  const { yContenido, yPiePagina } = dibujarMembrete(doc, assets, margenX, dependencia)

  return { doc, margenX, anchoUtil: pageW - margenX * 2, yContenido, yPiePagina }
}

/**
 * Agrega una página nueva con el mismo membrete (encabezado + pie), para
 * contenido que debe continuar en otra hoja (p. ej. la hoja de firmas).
 */
export async function agregarPaginaMembretada(
  doc: jsPDF,
  margenX: number,
  dependencia = "OFICINA DE INFORMÁTICA"
): Promise<{ yContenido: number; yPiePagina: number }> {
  doc.addPage()
  const assets = await cargarAssetsMembrete()
  return dibujarMembrete(doc, assets, margenX, dependencia)
}
