"use client"

import { useState } from "react"

interface Props {
  endpoint: string // "/api/bodega/categorias" o "/api/farmacia/categorias"
  colorFoco?: "blue" | "green"
  onCreada: (categoria: { id: number; nombre: string }) => void
  onCerrar: () => void
}

export default function ModalNuevaCategoria({ endpoint, colorFoco = "blue", onCreada, onCerrar }: Props) {
  const [nombre, setNombre] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const ringColor = colorFoco === "green" ? "focus:ring-green-500" : "focus:ring-blue-500"
  const btnColor = colorFoco === "green"
    ? "bg-green-600 hover:bg-green-700"
    : "bg-blue-600 hover:bg-blue-700"

  const handleGuardar = async () => {
    setError("")
    if (!nombre.trim()) {
      setError("El nombre es obligatorio")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Error al crear categoria")
        return
      }
      onCreada(data)
    } catch {
      setError("Error de conexion")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-4">Nueva categoria</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGuardar()}
            autoFocus
            className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${ringColor}`}
            placeholder="Ej: Limpieza, Analgésicos..."
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleGuardar}
            disabled={loading}
            className={`flex-1 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors ${btnColor}`}
          >
            {loading ? "Guardando..." : "Crear categoria"}
          </button>
          <button
            onClick={onCerrar}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}