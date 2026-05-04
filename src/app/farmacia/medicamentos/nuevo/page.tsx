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

export default function NuevoMedicamentoPage() {
  const router = useRouter()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { data: session } = useSession()
  const [mostrarModalCategoria, setMostrarModalCategoria] = useState(false)

  const [form, setForm] = useState({
    codigo: "",
    nombreGenerico: "",
    nombreComercial: "",
    formaFarmaceutica: "",
    concentracion: "",
    unidad: "",
    stockMinimo: "0",
    categoriaId: "",
  })

  useEffect(() => {
    fetch("/api/farmacia/categorias")
      .then((r) => r.json())
      .then(setCategorias)
  }, [])

  const handleSubmit = async () => {
    setError("")

    if (!form.codigo || !form.nombreGenerico || !form.formaFarmaceutica || !form.unidad || !form.categoriaId) {
      setError("Código, nombre genérico, forma farmacéutica, unidad y categoría son obligatorios")
      return
    }

    setLoading(true)

    const res = await fetch("/api/farmacia/medicamentos", {
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
      setError(data.error || "Error al crear medicamento")
      setLoading(false)
      return
    }

    router.push("/farmacia")
  }

  const handleCategoriaCreada = (cat: { id: number; nombre: string }) => {
    setCategorias((prev) => [...prev, cat].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setForm((f) => ({ ...f, categoriaId: String(cat.id) }))
    setMostrarModalCategoria(false)
  }

  return (
    <Layout titulo="Nuevo Medicamento — Farmacia">
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Ej: 7891234567890"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unidad <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.unidad}
                onChange={(e) => setForm((f) => ({ ...f, unidad: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Ej: comprimido, frasco"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Genérico <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.nombreGenerico}
              onChange={(e) => setForm((f) => ({ ...f, nombreGenerico: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Ej: Paracetamol"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Comercial <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={form.nombreComercial}
              onChange={(e) => setForm((f) => ({ ...f, nombreComercial: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Ej: Tapsin"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Forma Farmacéutica <span className="text-red-500">*</span>
              </label>
              <select
                value={form.formaFarmaceutica}
                onChange={(e) => setForm((f) => ({ ...f, formaFarmaceutica: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Seleccionar</option>
                <option value="Comprimido">Comprimido</option>
                <option value="Cápsula">Cápsula</option>
                <option value="Jarabe">Jarabe</option>
                <option value="Suspensión">Suspensión</option>
                <option value="Inyectable">Inyectable</option>
                <option value="Crema">Crema</option>
                <option value="Pomada">Pomada</option>
                <option value="Colirio">Colirio</option>
                <option value="Parche">Parche</option>
                <option value="Supositorio">Supositorio</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Concentración <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={form.concentracion}
                onChange={(e) => setForm((f) => ({ ...f, concentracion: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Ej: 500mg, 250mg/5ml"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoría <span className="text-red-500">*</span>
              </label>
              <select
                value={form.categoriaId}
                onChange={(e) => {
                  if(e.target.value === "nueva") {
                    setMostrarModalCategoria(true)
                    return
                  }
                  setForm((f) => ({ ...f, categoriaId: e.target.value }))
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Seleccionar categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
                <option disabled>──────────</option>
                {session?.user?.role === "ADMIN" && (
                  <option id="nueva" value="nueva" className="text-green-600 font-bold">+ Nueva categoria</option>
                )}
              </select>
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
              className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Guardando..." : "Guardar Medicamento"}
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
          endpoint="/api/farmacia/categorias"
          colorFoco="green"
          onCreada={handleCategoriaCreada}
          onCerrar={() => setMostrarModalCategoria(false)}
        />
      )}
    </Layout>
  )
}