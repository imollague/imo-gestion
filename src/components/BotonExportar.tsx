"use client"

import { useState } from "react"
import { exportarExcel, exportarPDF } from "@/lib/useExportar"

interface BotonExportarProps {
  titulo: string
  subtitulo?: string
  columnas: { header: string; key: string; ancho?: number }[]
  filas: Record<string, string | number>[]
  nombreArchivo: string
  disabled?: boolean
}

export default function BotonExportar({
  titulo,
  subtitulo,
  columnas,
  filas,
  nombreArchivo,
  disabled,
}: BotonExportarProps) {
  const [abierto, setAbierto] = useState(false)

  const handleExcel = () => {
    exportarExcel({ titulo, subtitulo, columnas, filas, nombreArchivo })
    setAbierto(false)
  }

  const handlePDF = () => {
    exportarPDF({ titulo, subtitulo, columnas, filas, nombreArchivo })
    setAbierto(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto(!abierto)}
        disabled={disabled || filas.length === 0}
        className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-2"
      >
        ↓ Exportar {filas.length > 0 && `(${filas.length})`}
      </button>

      {abierto && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setAbierto(false)}
          />
          <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
            <button
              onClick={handleExcel}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <span className="text-green-600 font-bold">XLS</span>
              Exportar a Excel
            </button>
            <button
              onClick={handlePDF}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"
            >
              <span className="text-red-600 font-bold">PDF</span>
              Exportar a PDF
            </button>
          </div>
        </>
      )}
    </div>
  )
}