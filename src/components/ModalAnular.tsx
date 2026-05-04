"use client"

import { useState } from "react"

interface ModalAnularProps {
  movimientoId: number
  descripcion: string
  endpoint: string // "/api/bodega/movimientos" o "/api/farmacia/movimientos"
  onAnulado: () => void
  onCerrar: () => void
}

export default function ModalAnular({
  movimientoId,
  descripcion,
  endpoint,
  onAnulado,
  onCerrar,
}: ModalAnularProps) {
  const [motivo, setMotivo] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleAnular = async () => {
    setError("")

    if (!motivo.trim()) {
      setError("El motivo es obligatorio")
      return
    }

    setLoading(true)

    const res = await fetch(`${endpoint}/${movimientoId}/anular`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo: motivo.trim() }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || "Error al anular movimiento")
      setLoading(false)
      return
    }

    setLoading(false)
    onAnulado()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Anular movimiento</h3>
        <p className="text-sm text-gray-500 mb-4">{descripcion}</p>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <p className="text-yellow-700 text-sm">
            Esta accion generara un movimiento inverso automaticamente para corregir el stock.
            El movimiento original quedara marcado como anulado con trazabilidad completa.
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Motivo de anulacion <span className="text-red-500">*</span>
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            autoFocus
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            placeholder="Ej: Se ingreso cantidad incorrecta, error de digitacion..."
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleAnular}
            disabled={loading || !motivo.trim()}
            className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Anulando..." : "Confirmar Anulacion"}
          </button>
          <button
            onClick={onCerrar}
            disabled={loading}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}