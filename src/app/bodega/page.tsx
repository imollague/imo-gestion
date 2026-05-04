"use client"

import { useEffect, useState } from "react"
import Layout from "@/components/Layout"
import BotonExportar from "@/components/BotonExportar"

interface Producto {
  id: number
  codigo: string
  nombre: string
  descripcion: string | null
  unidad: string
  stockActual: number
  stockMinimo: number
  activo: boolean
  categoria: { id: number; nombre: string }
}

export default function BodegaPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [filtroCategoria, setFiltroCategoria] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProductos()
  }, [])

  const fetchProductos = async () => {
    setLoading(true)
    const res = await fetch("/api/bodega/productos")
    const data = await res.json()
    setProductos(data)
    setLoading(false)
  }

  // Categorias unicas para el select
  const categorias = Array.from(
    new Map(productos.map((p) => [p.categoria.id, p.categoria])).values()
  ).sort((a, b) => a.nombre.localeCompare(b.nombre))

  const productosFiltrados = productos.filter((p) => {
    const coincideBusqueda =
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.categoria.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const coincideCategoria = filtroCategoria === "" || String(p.categoria.id) === filtroCategoria
    return coincideBusqueda && coincideCategoria
  })

  const productosStockBajo = productos.filter((p) => p.stockActual <= p.stockMinimo)

  return (
    <Layout titulo="Bodega Municipal">
      {productosStockBajo.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="text-red-700 font-semibold mb-2">
            ⚠️ {productosStockBajo.length} producto(s) con stock bajo o agotado
          </h3>
          <ul className="text-red-600 text-sm space-y-1">
            {productosStockBajo.map((p) => (
              <li key={p.id}>
                {p.nombre} — Stock actual: {p.stockActual} {p.unidad} (minimo: {p.stockMinimo})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <a href="/bodega/movimientos/nuevo"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          + Registrar Movimiento
        </a>
        <a href="/bodega/productos/nuevo"
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          + Nuevo Producto
        </a>
        <a href="/bodega/movimientos"
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          Ver Historial
        </a>
        <a href="/bodega/categorias"
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          Categorias
        </a>
        <BotonExportar
          titulo="Inventario Bodega Municipal"
          subtitulo="Municipalidad de Ollagüe"
          nombreArchivo="inventario-bodega"
          filas={productosFiltrados.map((p) => ({
            codigo: p.codigo,
            nombre: p.nombre,
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
          placeholder="Buscar por nombre, codigo o categoria..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        Mostrando {productosFiltrados.length} de {productos.length} productos
      </p>

      {loading ? (
        <p className="text-gray-500 text-sm">Cargando productos...</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Codigo</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Categoria</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Unidad</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Stock Actual</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Stock Minimo</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">Estado</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400">
                    No se encontraron productos
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-600">{p.codigo}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{p.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{p.categoria.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{p.unidad}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      <span className={p.stockActual <= p.stockMinimo ? "text-red-600" : "text-gray-800"}>
                        {p.stockActual}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{p.stockMinimo}</td>
                    <td className="px-4 py-3 text-center">
                      {p.stockActual === 0 ? (
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">Agotado</span>
                      ) : p.stockActual <= p.stockMinimo ? (
                        <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs">Stock bajo</span>
                      ) : (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">OK</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <a href={`/bodega/productos/${p.id}`} className="text-blue-600 hover:underline text-xs">
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