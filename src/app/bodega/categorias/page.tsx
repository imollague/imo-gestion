"use client"

import { useEffect, useState } from "react"
import Layout from "@/components/Layout"

interface Categoria {
  id: number
  nombre: string
  _count: { productos: number }
}

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [nuevo, setNuevo] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [editandoNombre, setEditandoNombre] = useState("")

  useEffect(() => {
    fetchCategorias()
  }, [])

  const fetchCategorias = async () => {
    setLoading(true)
    const res = await fetch("/api/bodega/categorias")
    const data = await res.json()
    setCategorias(data)
    setLoading(false)
  }

  const handleCrear = async () => {
    if (!nuevo.trim()) return
    setGuardando(true)
    setError("")

    const res = await fetch("/api/bodega/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nuevo.trim() }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || "Error al crear categoría")
    } else {
      setNuevo("")
      fetchCategorias()
    }

    setGuardando(false)
  }

  const handleEditar = async (id: number) => {
    if (!editandoNombre.trim()) return
    setError("")

    const res = await fetch("/api/bodega/categorias", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, nombre: editandoNombre.trim() }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || "Error al editar categoría")
    } else {
      setEditandoId(null)
      setEditandoNombre("")
      fetchCategorias()
    }
  }

  const handleEliminar = async (id: number, nombre: string) => {
    if (!confirm(`¿Eliminar la categoría "${nombre}"?`)) return
    setError("")

    const res = await fetch("/api/bodega/categorias", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || "Error al eliminar categoría")
    } else {
      fetchCategorias()
    }
  }

  return (
    <Layout titulo="Categorías — Bodega">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Crear nueva categoría */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Nueva categoría</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCrear()}
              placeholder="Nombre de la categoría"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleCrear}
              disabled={guardando || !nuevo.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {guardando ? "..." : "Agregar"}
            </button>
          </div>
          {error && (
            <p className="text-red-600 text-sm mt-2">{error}</p>
          )}
        </div>

        {/* Lista de categorías */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <p className="text-gray-500 text-sm p-4">Cargando categorías...</p>
          ) : categorias.length === 0 ? (
            <p className="text-gray-400 text-sm p-4 text-center">No hay categorías creadas</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {categorias.map((c) => (
                <li key={c.id} className="px-4 py-3 flex items-center gap-3">
                  {editandoId === c.id ? (
                    <>
                      <input
                        type="text"
                        value={editandoNombre}
                        onChange={(e) => setEditandoNombre(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleEditar(c.id)}
                        className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        onClick={() => handleEditar(c.id)}
                        className="text-blue-600 text-sm hover:underline"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditandoId(null)}
                        className="text-gray-400 text-sm hover:underline"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{c.nombre}</p>
                        <p className="text-xs text-gray-400">{c._count.productos} producto(s)</p>
                      </div>
                      <button
                        onClick={() => {
                          setEditandoId(c.id)
                          setEditandoNombre(c.nombre)
                        }}
                        className="text-blue-600 text-sm hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleEliminar(c.id, c.nombre)}
                        className="text-red-500 text-sm hover:underline"
                      >
                        Eliminar
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  )
}
