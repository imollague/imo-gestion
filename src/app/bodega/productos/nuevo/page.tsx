"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Layout from "@/components/Layout"
import ModalNuevaCategoria from "@/components/ModaalNuevaCategoria"

interface Categoria {
  id: number
  nombre: string
}

export default function NuevoProductoPage() {
  const router = useRouter()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const {data: session} = useSession()
  const [mostrarModalCategoria, setMostrarModalCategoria] = useState(false)

  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    descripcion: "",
    unidad: "",
    stockMinimo: "0",
    categoriaId: "",
  })

  useEffect(() => {
    fetch("/api/bodega/categorias")
      .then((r) => r.json())
      .then(setCategorias)
  }, [])

  const handleSubmit = async () => {
    setError("")

    if (!form.codigo || !form.nombre || !form.unidad || !form.categoriaId) {
      setError("Código, nombre, unidad y categoría son obligatorios")
      return
    }

    setLoading(true)

    const res = await fetch("/api/bodega/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        stockMinimo: parseInt(form.stockMinimo) || 0,
        categoriaId: parseInt(form.categoriaId),
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || "Error al crear producto")
      setLoading(false)
      return
    }

    router.push("/bodega")
  }

  const handleCategoriaCreada = (cat: { id: number; nombre: string }) => {
    setCategorias((prev) => [...prev, cat].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setForm((f) => ({ ...f, categoriaId: String(cat.id) }))
    setMostrarModalCategoria(false)
  }

  return (
    <Layout titulo="Nuevo Producto — Bodega">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 space-y-4">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: 7891234567890"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unidad de medida <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.unidad}
                onChange={(e) => setForm((f) => ({ ...f, unidad: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: unidad, kg, litro"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nombre del producto"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Descripción adicional del producto"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={form.categoriaId}
                  onChange={(e) => {
                    if(e.target.value === "nueva") {
                      setMostrarModalCategoria(true)
                      return
                    }
                    setForm((f) => ({ ...f, categoriaId: e.target.value }))
                  }}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar categoria</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                  <option disabled>──────────</option>
                  {session?.user?.role === "ADMIN" && (
                    <option id="nueva" value="nueva" className="text-blue-600 font-bold">+ Nueva categoria</option>
                  )}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock mínimo
              </label>
              <input
                type="number"
                min="0"
                value={form.stockMinimo}
                onChange={(e) => setForm((f) => ({ ...f, stockMinimo: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Guardando..." : "Guardar Producto"}
            </button>
            <button
              onClick={() => router.back()}
              className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
      {mostrarModalCategoria && (
        <ModalNuevaCategoria
          endpoint="/api/bodega/categorias"
          colorFoco="blue"
          onCreada={handleCategoriaCreada}
          onCerrar={() => setMostrarModalCategoria(false)}
        />
      )}
    </Layout>
  )
}