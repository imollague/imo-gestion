"use client"

import { useEffect, useState } from "react"
import Layout from "@/components/Layout"
import BotonExportar from "@/components/BotonExportar"

interface Medicamento {
  id: number
  codigo: string
  nombreGenerico: string
  nombreComercial: string | null
  formaFarmaceutica: string
  concentracion: string | null
  unidad: string
  stockActual: number
  stockMinimo: number
  activo: boolean
  categoria: { id: number; nombre: string }
}

export default function FarmaciaPage() {
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [filtroCategoria, setFiltroCategoria] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMedicamentos()
  }, [])

  const fetchMedicamentos = async () => {
    setLoading(true)
    const res = await fetch("/api/farmacia/medicamentos")
    const data = await res.json()
    setMedicamentos(data)
    setLoading(false)
  }

  // Categorias unicas para el select
  const categorias = Array.from(
    new Map(medicamentos.map((m) => [m.categoria.id, m.categoria])).values()
  ).sort((a, b) => a.nombre.localeCompare(b.nombre))

  const medicamentosFiltrados = medicamentos.filter((m) => {
    const coincideBusqueda =
      m.nombreGenerico.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
      (m.nombreComercial?.toLowerCase().includes(busqueda.toLowerCase()) ?? false) ||
      m.categoria.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const coincideCategoria = filtroCategoria === "" || String(m.categoria.id) === filtroCategoria
    return coincideBusqueda && coincideCategoria
  })

  const stockBajo = medicamentos.filter((m) => m.stockActual <= m.stockMinimo)

  return (
    <Layout titulo="Farmacia — Posta Rural">
      {stockBajo.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="text-red-700 font-semibold mb-2">
            ⚠️ {stockBajo.length} medicamento(s) con stock bajo o agotado
          </h3>
          <ul className="text-red-600 text-sm space-y-1">
            {stockBajo.map((m) => (
              <li key={m.id}>
                {m.nombreGenerico} {m.concentracion} — Stock actual: {m.stockActual} {m.unidad} (minimo: {m.stockMinimo})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <a href="/farmacia/movimientos/nuevo"
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
          + Registrar Movimiento
        </a>
        <a href="/farmacia/medicamentos/nuevo"
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          + Nuevo Medicamento
        </a>
        <a href="/farmacia/movimientos"
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          Ver Historial
        </a>
        <a href="/farmacia/categorias"
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          Categorias
        </a>
        <BotonExportar
          titulo="Inventario Farmacia Posta Rural"
          subtitulo="Municipalidad de Ollagüe"
          nombreArchivo="inventario-farmacia"
          filas={medicamentosFiltrados.map((p) => ({
            codigo: p.codigo,
            nombre: p.nombreGenerico,
            categoria: p.categoria.nombre,
            unidad: p.unidad,
            stockActual: p.stockActual,
            stockMinimo: p.stockMinimo,
            estado: p.stockActual === 0 ? "Agotado" : p.stockActual <= p.stockMinimo ? "Stock bajo" : "OK",
          }))}
          columnas={[
            { header: "Codigo", key: "codigo", ancho: 16 },
            { header: "Nombre", key: "nombre", ancho: 35 },
            { header: "Categoria", key: "categoria", ancho: 20 },
            { header: "Unidad", key: "unidad", ancho: 12 },
            { header: "Stock Actual", key: "stockActual", ancho: 14 },
            { header: "Stock Minimo", key: "stockMinimo", ancho: 14 },
            { header: "Estado", key: "estado", ancho: 12 },
          ]}
        />
      </div>

      {/* Buscador y filtro categoria */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre generico, comercial, codigo o categoria..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Todas las categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={String(c.id)}>{c.nombre}</option>
          ))}
        </select>
        {(busqueda || filtroCategoria) && (
          <button
            onClick={() => { setBusqueda(""); setFiltroCategoria("") }}
            className="text-sm text-gray-500 hover:text-gray-700 underline px-2"
          >
            Limpiar
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-3">
        Mostrando {medicamentosFiltrados.length} de {medicamentos.length} medicamentos
      </p>

      {loading ? (
        <p className="text-gray-500 text-sm">Cargando medicamentos...</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Codigo</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Nombre Generico</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Forma / Concentracion</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Categoria</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Stock Actual</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Stock Minimo</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">Estado</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {medicamentosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400">
                    No se encontraron medicamentos
                  </td>
                </tr>
              ) : (
                medicamentosFiltrados.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-600">{m.codigo}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{m.nombreGenerico}</p>
                      {m.nombreComercial && (
                        <p className="text-xs text-gray-400">{m.nombreComercial}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <p>{m.formaFarmaceutica}</p>
                      {m.concentracion && <p className="text-xs text-gray-400">{m.concentracion}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.categoria.nombre}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      <span className={m.stockActual <= m.stockMinimo ? "text-red-600" : "text-gray-800"}>
                        {m.stockActual}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{m.stockMinimo}</td>
                    <td className="px-4 py-3 text-center">
                      {m.stockActual === 0 ? (
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">Agotado</span>
                      ) : m.stockActual <= m.stockMinimo ? (
                        <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs">Stock bajo</span>
                      ) : (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">OK</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <a href={`/farmacia/medicamentos/${m.id}`} className="text-green-600 hover:underline text-xs">
                        Ver detalle
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}