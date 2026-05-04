"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Layout from "@/components/Layout"
import { useSession } from "next-auth/react"
import ModalAnular from "@/components/ModalAnular"

interface Categoria {
  id: number
  nombre: string
}

interface Movimiento {
  id: number
  tipo: "ENTRADA" | "SALIDA" | "AJUSTE"
  cantidad: number
  documento: string
  numeroDocumento: string | null
  proveedor: string | null
  destinatario: string | null
  area: string | null
  observacion: string | null
  fecha: string
  usuario: { id: number; name: string }
  anulado: boolean
  anulacionDeId: number | null
}

interface Producto {
  id: number
  codigo: string
  nombre: string
  descripcion: string | null
  unidad: string
  stockActual: number
  stockMinimo: number
  activo: boolean
  categoria: Categoria
  movimientos: Movimiento[]
}

interface KardexRow {
  id: number
  fecha: string
  tipo: "ENTRADA" | "SALIDA" | "AJUSTE"
  documento: string | null
  numeroDocumento: string | null
  proveedor: string | null
  destinatario: string | null
  area: string | null
  observacion: string | null
  usuario: string
  entradas: number | null
  salidas: number | null
  ajuste: number | null
  saldo: number
}

const TIPOS_DOCUMENTO: Record<string, string> = {
  ORDEN_COMPRA: "Orden de Compra",
  FACTURA: "Factura",
  GUIA_DESPACHO: "Guía de Despacho",
  NOTA_DEBITO: "Nota de Débito",
  NOTA_CREDITO: "Nota de Crédito",
  ACTA_DONACION: "Acta de Donación",
  SIN_DOCUMENTO: "Sin Documento",
  OTRO: "Otro",
}

export default function DetalleProductoPage() {
  const router = useRouter()
  const params = useParams()
  const { data: session } = useSession()
  const id = params.id as string

  const [producto, setProducto] = useState<Producto | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const [exito, setExito] = useState("")
  const [movimientoAAnular, setMovimientoAAnular] = useState<{ id: number; descripcion: string } | null>(null)
  const [tab, setTab] = useState<"movimientos" | "kardex">("movimientos")

  // Kardex state
  const [kardex, setKardex] = useState<KardexRow[]>([])
  const [saldoInicial, setSaldoInicial] = useState(0)
  const [kardexDesde, setKardexDesde] = useState("")
  const [kardexHasta, setKardexHasta] = useState("")
  const [kardexLoading, setKardexLoading] = useState(false)

  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    descripcion: "",
    unidad: "",
    stockMinimo: "0",
    categoriaId: "",
  })

  useEffect(() => {
    fetchProducto()
    fetch("/api/bodega/categorias")
      .then((r) => r.json())
      .then(setCategorias)
  }, [id])

  useEffect(() => {
    if (tab === "kardex") fetchKardex()
  }, [tab])

  const fetchProducto = async () => {
    setLoading(true)
    const res = await fetch(`/api/bodega/productos/${id}`)
    const data = await res.json()
    setProducto(data)
    setForm({
      codigo: data.codigo,
      nombre: data.nombre,
      descripcion: data.descripcion || "",
      unidad: data.unidad,
      stockMinimo: String(data.stockMinimo),
      categoriaId: String(data.categoria.id),
    })
    setLoading(false)
  }

  const fetchKardex = async () => {
    setKardexLoading(true)
    const qs = new URLSearchParams()
    if (kardexDesde) qs.set("desde", kardexDesde)
    if (kardexHasta) qs.set("hasta", kardexHasta)
    const res = await fetch(`/api/bodega/productos/${id}/kardex?${qs}`)
    const data = await res.json()
    setKardex(data.kardex ?? [])
    setSaldoInicial(data.saldoInicial ?? 0)
    setKardexLoading(false)
  }

  const handleGuardar = async () => {
    setError("")
    setGuardando(true)

    const res = await fetch(`/api/bodega/productos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        stockMinimo: parseInt(form.stockMinimo) || 0,
        categoriaId: parseInt(form.categoriaId),
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || "Error al guardar")
      setGuardando(false)
      return
    }

    setExito("Producto actualizado correctamente")
    setEditando(false)
    fetchProducto()
    setGuardando(false)
    setTimeout(() => setExito(""), 3000)
  }

  const handleDesactivar = async () => {
    if (!confirm(`¿Desactivar el producto "${producto?.nombre}"? Ya no aparecerá en el inventario activo.`)) return

    const res = await fetch(`/api/bodega/productos/${id}`, { method: "DELETE" })

    if (res.ok) {
      router.push("/bodega")
    }
  }

  const formatFecha = (fecha: string) =>
    new Date(fecha).toLocaleString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "BODEGA"

  if (loading) return <Layout titulo="Detalle de Producto"><p className="text-gray-500 text-sm">Cargando...</p></Layout>
  if (!producto) return <Layout titulo="Detalle de Producto"><p className="text-gray-500 text-sm">Producto no encontrado</p></Layout>

  return (
    <Layout titulo={`Producto: ${producto.nombre}`}>
      <div className="max-w-fit mx-auto space-y-6">

        {exito && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">{exito}</div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
        )}

        {/* Ficha del producto */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{producto.nombre}</h3>
              <p className="text-sm text-gray-400 font-mono">{producto.codigo}</p>
            </div>
            <div className="flex gap-2">
              {canEdit && !editando && (
                <button
                  onClick={() => setEditando(true)}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  Editar
                </button>
              )}
              {session?.user.role === "ADMIN" && (
                <button
                  onClick={handleDesactivar}
                  className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-sm hover:bg-red-100 transition-colors"
                >
                  Desactivar
                </button>
              )}
            </div>
          </div>

          {editando ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                  <input
                    type="text"
                    value={form.codigo}
                    onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                  <input
                    type="text"
                    value={form.unidad}
                    onChange={(e) => setForm((f) => ({ ...f, unidad: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select
                    value={form.categoriaId}
                    onChange={(e) => setForm((f) => ({ ...f, categoriaId: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock mínimo</label>
                  <input
                    type="number"
                    min="0"
                    value={form.stockMinimo}
                    onChange={(e) => setForm((f) => ({ ...f, stockMinimo: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleGuardar}
                  disabled={guardando}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
                <button
                  onClick={() => setEditando(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <span className="text-gray-500">Categoría:</span>{" "}
                <span className="text-gray-800 font-medium">{producto.categoria.nombre}</span>
              </div>
              <div>
                <span className="text-gray-500">Unidad:</span>{" "}
                <span className="text-gray-800 font-medium">{producto.unidad}</span>
              </div>
              <div>
                <span className="text-gray-500">Stock actual:</span>{" "}
                <span className={`font-bold ${producto.stockActual <= producto.stockMinimo ? "text-red-600" : "text-green-600"}`}>
                  {producto.stockActual} {producto.unidad}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Stock mínimo:</span>{" "}
                <span className="text-gray-800 font-medium">{producto.stockMinimo} {producto.unidad}</span>
              </div>
              {producto.descripcion && (
                <div className="col-span-2">
                  <span className="text-gray-500">Descripción:</span>{" "}
                  <span className="text-gray-800">{producto.descripcion}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setTab("movimientos")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  tab === "movimientos" ? "bg-white shadow text-gray-800" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Movimientos
              </button>
              <button
                onClick={() => setTab("kardex")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  tab === "kardex" ? "bg-white shadow text-gray-800" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Kardex
              </button>
            </div>
            {tab === "movimientos" && (
              <a
                href={`/bodega/movimientos/nuevo?productoId=${producto.id}`}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors"
              >
                + Registrar movimiento
              </a>
            )}
          </div>

          {/* Tab: Movimientos */}
          {tab === "movimientos" && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Fecha</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Tipo</th>
                    <th className="text-right px-4 py-3 text-gray-600 font-medium">Cantidad</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Documento</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Proveedor / Destinatario</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Usuario</th>
                    <th className="text-center px-4 py-3 text-gray-600 font-medium">Estado</th>
                    <th className="text-center px-4 py-3 text-gray-600 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {producto.movimientos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-gray-400">
                        Sin movimientos registrados
                      </td>
                    </tr>
                  ) : (
                    producto.movimientos.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatFecha(m.fecha)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            m.tipo === "ENTRADA" ? "bg-green-100 text-green-700" :
                            m.tipo === "SALIDA" ? "bg-red-100 text-red-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>
                            {m.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          <span className={
                            m.tipo === "ENTRADA" ? "text-green-600" :
                            m.tipo === "SALIDA" ? "text-red-600" :
                            "text-yellow-600"
                          }>
                            {m.tipo === "ENTRADA" ? "+" : m.tipo === "SALIDA" ? "-" : "~"}{m.cantidad} {producto.unidad}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          <p>{TIPOS_DOCUMENTO[m.documento] ?? m.documento}</p>
                          {m.numeroDocumento && <p className="text-xs text-gray-400">N° {m.numeroDocumento}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {m.tipo === "ENTRADA" ? m.proveedor : m.destinatario}
                          {m.area && <span className="text-xs text-gray-400 ml-1">({m.area})</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{m.usuario.name}</td>
                        <td className="px-4 py-3 text-center">
                          {m.anulado ? (
                            <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-xs">Anulado</span>
                          ) : m.anulacionDeId ? (
                            <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-xs">Anulacion</span>
                          ) : (
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">Vigente</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {!m.anulado && !m.anulacionDeId ? (
                            <button
                              onClick={() => setMovimientoAAnular({
                                id: m.id,
                                descripcion: `${m.tipo} de ${m.cantidad} ${producto.unidad} (${formatFecha(m.fecha)})`
                              })}
                              className="text-red-500 text-xs hover:underline"
                            >
                              Anular
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab: Kardex */}
          {tab === "kardex" && (
            <div className="space-y-3">
              {/* Filtros */}
              <div className="bg-white rounded-lg shadow p-4 flex gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
                  <input
                    type="date"
                    value={kardexDesde}
                    onChange={(e) => setKardexDesde(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
                  <input
                    type="date"
                    value={kardexHasta}
                    onChange={(e) => setKardexHasta(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={fetchKardex}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  Filtrar
                </button>
                {(kardexDesde || kardexHasta) && (
                  <button
                    onClick={() => { setKardexDesde(""); setKardexHasta(""); setTimeout(fetchKardex, 0) }}
                    className="text-gray-500 text-sm hover:underline"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {/* Tabla */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                {kardexLoading ? (
                  <p className="text-center py-8 text-gray-400 text-sm">Cargando kardex...</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Fecha</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Tipo</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Detalle</th>
                        <th className="text-right px-4 py-3 text-green-700 font-medium">Entradas</th>
                        <th className="text-right px-4 py-3 text-red-600 font-medium">Salidas</th>
                        <th className="text-right px-4 py-3 text-yellow-700 font-medium">Ajuste</th>
                        <th className="text-right px-4 py-3 text-blue-700 font-medium">Saldo</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Usuario</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {kardexDesde && (
                        <tr className="bg-blue-50">
                          <td colSpan={6} className="px-4 py-2 text-xs text-blue-600 font-medium">
                            Saldo inicial al {new Date(kardexDesde + "T12:00:00").toLocaleDateString("es-CL")}
                          </td>
                          <td className="px-4 py-2 text-right font-bold text-blue-700">{saldoInicial}</td>
                          <td></td>
                        </tr>
                      )}
                      {kardex.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-gray-400">
                            Sin movimientos en el período
                          </td>
                        </tr>
                      ) : (
                        kardex.map((row) => (
                          <tr key={row.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatFecha(row.fecha)}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                row.tipo === "ENTRADA" ? "bg-green-100 text-green-700" :
                                row.tipo === "SALIDA" ? "bg-red-100 text-red-700" :
                                "bg-yellow-100 text-yellow-700"
                              }`}>
                                {row.tipo}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 max-w-xs">
                              {row.documento && <p className="text-xs">{TIPOS_DOCUMENTO[row.documento] ?? row.documento}{row.numeroDocumento ? ` N°${row.numeroDocumento}` : ""}</p>}
                              {row.proveedor && <p className="text-xs text-gray-400">Prov: {row.proveedor}</p>}
                              {row.destinatario && <p className="text-xs text-gray-400">Dest: {row.destinatario}{row.area ? ` (${row.area})` : ""}</p>}
                              {row.observacion && <p className="text-xs text-gray-400 truncate max-w-[200px]" title={row.observacion}>{row.observacion}</p>}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-green-600">
                              {row.entradas != null ? `+${row.entradas}` : ""}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-red-600">
                              {row.salidas != null ? `-${row.salidas}` : ""}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-yellow-700">
                              {row.ajuste != null ? (row.ajuste > 0 ? `+${row.ajuste}` : row.ajuste) : ""}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-blue-700">{row.saldo}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{row.usuario}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {movimientoAAnular && (
        <ModalAnular
          movimientoId={movimientoAAnular.id}
          descripcion={movimientoAAnular.descripcion}
          endpoint="/api/bodega/movimientos"
          onAnulado={() => { setMovimientoAAnular(null); fetchProducto() }}
          onCerrar={() => setMovimientoAAnular(null)}
        />
      )}
    </Layout>
  )
}
