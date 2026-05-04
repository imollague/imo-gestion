import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface OpcionesExportar {
  titulo: string
  subtitulo?: string
  columnas: { header: string; key: string; ancho?: number }[]
  filas: Record<string, string | number>[]
  nombreArchivo: string
}

export function exportarExcel({
  titulo,
  columnas,
  filas,
  nombreArchivo,
}: OpcionesExportar) {
  const datos = filas.map((fila) =>
    columnas.reduce((obj, col) => {
      obj[col.header] = fila[col.key] ?? ""
      return obj
    }, {} as Record<string, string | number>)
  )

  const ws = XLSX.utils.json_to_sheet(datos)

  // Ancho de columnas
  ws["!cols"] = columnas.map((col) => ({ wch: col.ancho ?? 20 }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, titulo.slice(0, 31))
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`)
}

export function exportarPDF({
  titulo,
  subtitulo,
  columnas,
  filas,
  nombreArchivo,
}: OpcionesExportar) {
  const doc = new jsPDF({ orientation: "landscape" })

  // Encabezado
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(titulo, 14, 16)

  if (subtitulo) {
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(subtitulo, 14, 23)
  }

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(
    `Generado el ${new Date().toLocaleString("es-CL")}`,
    14,
    subtitulo ? 29 : 23
  )

  autoTable(doc, {
    startY: subtitulo ? 34 : 28,
    head: [columnas.map((c) => c.header)],
    body: filas.map((fila) => columnas.map((col) => fila[col.key] ?? "")),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: columnas.reduce((obj, col, idx) => {
      if (col.ancho) obj[idx] = { cellWidth: col.ancho }
      return obj
    }, {} as Record<number, { cellWidth: number }>),
  })

  doc.save(`${nombreArchivo}.pdf`)
}