"use client"

import { useEffect, useState, useCallback } from "react"
import Layout from "@/components/Layout"
import BotonExportar from "@/components/BotonExportar"
import ModalAnular from "@/components/ModalAnular"
import Paginador from "@/components/Paginador"
import { TipoMovimiento } from "@/lib/types"

interface Movimiento {
  id: number
  tipo: TipoMovimiento
  cantidad: number
  lote: string | null
  fechaVencimiento: string | null
  proveedor: string | null
  rutPaciente: string | null
  observacion: string | null
  fecha: string
  anulado: boolean
  anulacionDeId: number | null
  medicamento: {
    id: number
    codigo: string
    nombreGenerico: string
    nombreComercial: string | null
    unidad: string
    concentracion: string | null
    formaFarmaceutica: string
  }
  usuario: {
    id: number
    name: string
    username: string
  }
}

const badgeTipo = (m: Movimiento) => {
  if (m.anulacionDeId) return "bg-gray-100 text-gray-500"
  if (m.tipo === TipoMovimiento.ENTRADA) return "bg-green-100 text-green-700"
  if (m.tipo === TipoMovimiento.SALIDA) return "bg-red-100 text-red-700"
  if (m.tipo === TipoMovimiento.AJUSTE) return "bg-orange-100 text-orange-600"
  return "bg-gray-100 text-gray-500"
}

const labelTipo = (m: Movimiento) => {
  if (m.anulacionDeId) return "ANULACION"
  if (m.tipo === TipoMovimiento.SALIDA) return "DESPACHO"
  return m.tipo
}

const labelCantidad = (m: Movimiento) => {
  if (m.tipo === TipoMovimiento.ENTRADA) return `+${m.cantidad}`
  if (m.tipo === TipoMovimiento.SALIDA) return `-${m.cantidad}`
  return `±${m.cantidad}`
}

const colorCantidad = (m: Movimiento) => {
  if (m.tipo === TipoMovimiento.ENTRADA) return "text-green-600"
  if (m.tipo === TipoMovimiento.SALIDA) return "text-red-600"
  return "text-orange-600"
}

const LIMITE = 50

export default function HistorialMovimientosFarmaciaPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [total, setTotal] = useState(0)
  const [totalVigentes, setTotalVigentes] = useState(0)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState("")
  const [filtroDesde, setFiltroDesde] = useState("")
  const [filtroHasta, setFiltroHasta] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [busquedaInput, setBusquedaInput] = useState("")
  const [movimientoAAnular, setMovimientoAAnular] = useState<{ id: number; descripcion: string } | null>(null)

  const fetchMovimientos = useCallback(async (paginaActual: number) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtroTipo) params.append("tipo", filtroTipo)
    if (filtroDesde) params.append("desde", filtroDesde)
    if (filtroHasta) params.append("hasta", filtroHasta)
    if (busqueda) params.append("busqueda", busqueda)
    params.append("pagina", String(paginaActual))
    params.append("limite", String(LIMITE))

    const res = await fetch(`/api/farmacia/movimientos?${params.toString()}`)
    const data = await res.json()
    setMovimientos(data.movimientos)
    setTotal(data.total)
    setTotalVigentes(data.totalVigentes)
    setTotalPaginas(data.totalPaginas)
    setLoading(false)
  }, [filtroTipo, filtroDesde, filtroHasta, busqueda])

  useEffect(() => {
    setPagina(1)
    fetchMovimientos(1)
  }, [filtroTipo, filtroDesde, filtroHasta, busqueda])

  const handleCambiarPagina = (nuevaPagina: number) => {
    setPagina(nuevaPagina)
    fetchMovimientos(nuevaPagina)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleBuscar = () => setBusqueda(busquedaInput)

  const formatFecha = (fecha: string) =>
    new Date(fecha).toLocaleString("es-CL", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })

  const formatFechaVenc = (fecha: string) =>
    new Date(fecha).toLocaleDateString("es-CL", {
      day: "2-digit", month: "2-digit", year: "numeric",
    })

  const esPorVencer = (fecha: string) => {
    const diff = new Date(fecha).getTime() - Date.now()
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
  }

  const estaVencido = (fecha: string) => new Date(fecha).getTime() < Date.now()

  return (
    <Layout titulo="Historial de Movimientos — Farmacia">

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">Todos</option>
            <option value={TipoMovimiento.ENTRADA}>Entradas</option>
            <option value={TipoMovimiento.SALIDA}>Despachos</option>
            <option value={TipoMovimiento.AJUSTE}>Ajustes</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
          <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
          <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-gray-600 mb-1">Buscar</label>
          <div className="flex gap-2">
            <input type="text" placeholder="Medicamento, RUT paciente, proveedor..."
              value={busquedaInput} onChange={(e) => setBusquedaInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
              className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <button onClick={handleBuscar}
              className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 transition-colors">
              Buscar
            </button>
          </div>
        </div>
        <button onClick={() => { setFiltroTipo(""); setFiltroDesde(""); setFiltroHasta(""); setBusqueda(""); setBusquedaInput("") }}
          className="text-sm text-gray-500 hover:text-gray-700 underline">
          Limpiar
        </button>
        <BotonExportar
          titulo="Historial de Movimientos - Farmacia"
          subtitulo="Posta Rural - Municipalidad de Ollagüe"
          nombreArchivo="historial-farmacia"
          filas={movimientos.map((m) => ({
            fecha: formatFecha(m.fecha),
            tipo: labelTipo(m),
            medicamento: m.medicamento.nombreGenerico,
            codigo: m.medicamento.codigo,
            cantidad: `${labelCantidad(m)} ${m.medicamento.unidad}`,
            lote: m.lote ?? "",
            vencimiento: m.fechaVencimiento ? formatFechaVenc(m.fechaVencimiento) : "",
            proveedorPaciente: m.tipo === TipoMovimiento.ENTRADA ? (m.proveedor ?? "") : (m.rutPaciente ?? ""),
            estado: m.anulado ? "ANULADO" : m.anulacionDeId ? "ANULACION" : "VIGENTE",
            usuario: m.usuario.name,
          }))}
          columnas={[
            { header: "Fecha", key: "fecha", ancho: 18 },
            { header: "Tipo", key: "tipo", ancho: 12 },
            { header: "Medicamento", key: "medicamento", ancho: 30 },
            { header: "Codigo", key: "codigo", ancho: 18 },
            { header: "Cantidad", key: "cantidad", ancho: 14 },
            { header: "Lote", key: "lote", ancho: 14 },
            { header: "Vencimiento", key: "vencimiento", ancho: 14 },
            { header: "Proveedor/Paciente", key: "proveedorPaciente", ancho: 25 },
            { header: "Estado", key: "estado", ancho: 12 },
            { header: "Usuario", key: "usuario", ancho: 18 },
          ]}
        />
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">{total}</p>
          <p className="text-sm text-gray-500">Total registros</p>
          <p className="text-xs text-gray-400 mt-1">{totalVigentes} vigentes</p>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4 text-center">
          <p className="text-2xl font-bold text-green-700">
            {movimientos.filter((m) => m.tipo === TipoMovimiento.ENTRADA && !m.anulado && !m.anulacionDeId).length}
          </p>
          <p className="text-sm text-green-600">Entradas en pagina</p>
        </div>
        <div className="bg-red-50 rounded-lg shadow p-4 text-center">
          <p className="text-2xl font-bold text-red-700">
            {movimientos.filter((m) => m.tipo === TipoMovimiento.SALIDA && !m.anulado && !m.anulacionDeId).length}
          </p>
          <p className="text-sm text-red-600">Despachos en pagina</p>
        </div>
        <div className="bg-orange-50 rounded-lg shadow p-4 text-center">
          <p className="text-2xl font-bold text-orange-600">
            {movimientos.filter((m) => m.tipo === TipoMovimiento.AJUSTE && !m.anulado && !m.anulacionDeId).length}
          </p>
          <p className="text-sm text-orange-500">Ajustes en pagina</p>
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <p className="text-gray-500 text-sm">Cargando movimientos...</p>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Medicamento</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-medium">Cantidad</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Lote / Vencimiento</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Proveedor / Paciente</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Usuario</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium">Estado</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-gray-400">No se encontraron movimientos</td>
                  </tr>
                ) : (
                  movimientos.map((m) => (
                    <tr key={m.id} className={`hover:bg-gray-50 ${m.anulado ? "opacity-50 bg-gray-50" : ""}`}>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatFecha(m.fecha)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeTipo(m)}`}>
                          {labelTipo(m)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{m.medicamento.nombreGenerico}</p>
                        <p className="text-xs text-gray-400">
                          {m.medicamento.formaFarmaceutica}
                          {m.medicamento.concentracion && ` - ${m.medicamento.concentracion}`}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        <span className={colorCantidad(m)}>
                          {labelCantidad(m)} {m.medicamento.unidad}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {m.lote && <p>Lote: {m.lote}</p>}
                        {m.fechaVencimiento && (
                          <p className={`text-xs ${
                            estaVencido(m.fechaVencimiento) ? "text-red-600 font-semibold"
                            : esPorVencer(m.fechaVencimiento) ? "text-yellow-600 font-semibold"
                            : "text-gray-400"
                          }`}>
                            Vence: {formatFechaVenc(m.fechaVencimiento)}
                            {estaVencido(m.fechaVencimiento) && " VENCIDO"}
                            {!estaVencido(m.fechaVencimiento) && esPorVencer(m.fechaVencimiento) && " Por vencer"}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {m.tipo === TipoMovimiento.ENTRADA && m.proveedor}
                        {m.tipo === TipoMovimiento.SALIDA && m.rutPaciente && `RUT: ${m.rutPaciente}`}
                        {m.observacion && <p className="text-xs text-gray-400 italic">{m.observacion}</p>}
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
                              descripcion: `${labelTipo(m)} de ${m.cantidad} ${m.medicamento.unidad} - ${m.medicamento.nombreGenerico} (${formatFecha(m.fecha)})`
                            })}
                            className="text-red-500 text-xs hover:underline">
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
          <Paginador pagina={pagina} totalPaginas={totalPaginas} total={total} limite={LIMITE} onChange={handleCambiarPagina} />
        </>
      )}

      {movimientoAAnular && (
        <ModalAnular
          movimientoId={movimientoAAnular.id}
          descripcion={movimientoAAnular.descripcion}
          endpoint="/api/farmacia/movimientos"
          onAnulado={() => { setMovimientoAAnular(null); fetchMovimientos(pagina) }}
          onCerrar={() => setMovimientoAAnular(null)}
        />
      )}
    </Layout>
  )
}