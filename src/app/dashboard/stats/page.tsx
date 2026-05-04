"use client"

import { useEffect, useState } from "react"
import Layout from "@/components/Layout"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts"

interface UltimoMov {
  fecha: string
  tipo: string
  nombre: string
}

interface Stats {
  resumen: {
    totalProductos: number
    totalMedicamentos: number
    productosStockBajo: number
    medicamentosStockBajo: number
    productosAgotados: number
    medicamentosAgotados: number
    lotesVencidos: number
    lotesPorVencer: number
    totalMovimientosBodega: number
    totalMovimientosFarmacia: number
    entradasBodega: number
    salidasBodega: number
    ajustesBodega: number
    entradasFarmacia: number
    despachosFarmacia: number
    ajustesFarmacia: number
    ultimoMovBodega: UltimoMov | null
    ultimoMovFarmacia: UltimoMov | null
  }
  graficoBodega: { fecha: string; entradas: number; salidas: number; ajustes: number }[]
  graficoFarmacia: { fecha: string; entradas: number; salidas: number; ajustes: number }[]
  topProductosBodega: { nombre: string; cantidad: number }[]
  topMedicamentos: { nombre: string; cantidad: number }[]
}

const PERIODOS = [
  { label: "7 dias", value: 7 },
  { label: "30 dias", value: 30 },
  { label: "90 dias", value: 90 },
]

const formatFechaGrafico = (fecha: string) => {
  const d = new Date(fecha + "T12:00:00")
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" })
}

const formatFechaCorta = (fecha: string) =>
  new Date(fecha).toLocaleString("es-CL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })

export default function DashboardStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState(30)

  useEffect(() => {
    fetchStats()
  }, [periodo])

  const fetchStats = async () => {
    setLoading(true)
    const res = await fetch(`/api/dashboard/stats?dias=${periodo}`)
    const data = await res.json()
    setStats(data)
    setLoading(false)
  }

  if (loading) return <Layout titulo="Dashboard"><p className="text-gray-500 text-sm">Cargando estadisticas...</p></Layout>
  if (!stats) return null

  const { resumen } = stats

  return (
    <Layout titulo="Estadisticas Generales">
      <div className="flex gap-2 mb-6">
        {PERIODOS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriodo(p.value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              periodo === p.value
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Alertas críticas */}
      {(resumen.lotesVencidos > 0 || resumen.productosAgotados > 0 || resumen.medicamentosAgotados > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {resumen.lotesVencidos > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-3 flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-red-700 font-semibold text-sm">{resumen.lotesVencidos} lote(s) vencido(s)</p>
                <p className="text-red-500 text-xs">con stock disponible en farmacia</p>
              </div>
            </div>
          )}
          {resumen.productosAgotados > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-3 flex items-center gap-3">
              <span className="text-2xl">📦</span>
              <div>
                <p className="text-red-700 font-semibold text-sm">{resumen.productosAgotados} producto(s) agotado(s)</p>
                <p className="text-red-500 text-xs">en bodega municipal</p>
              </div>
            </div>
          )}
          {resumen.medicamentosAgotados > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-3 flex items-center gap-3">
              <span className="text-2xl">💊</span>
              <div>
                <p className="text-red-700 font-semibold text-sm">{resumen.medicamentosAgotados} medicamento(s) agotado(s)</p>
                <p className="text-red-500 text-xs">en farmacia posta rural</p>
              </div>
            </div>
          )}
        </div>
      )}
 
      {/* ── KPIs fila 1: Inventario ── */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Inventario</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 mb-1">Productos bodega</p>
          <p className="text-2xl font-bold text-gray-800">{resumen.totalProductos}</p>
          <div className="mt-1 space-y-0.5">
            {resumen.productosStockBajo > 0 && (
              <p className="text-xs text-yellow-600">⚠ {resumen.productosStockBajo} con stock bajo</p>
            )}
            {resumen.productosAgotados > 0 && (
              <p className="text-xs text-red-500">✕ {resumen.productosAgotados} agotados</p>
            )}
            {resumen.productosStockBajo === 0 && resumen.productosAgotados === 0 && (
              <p className="text-xs text-green-600">✓ Todo en orden</p>
            )}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 mb-1">Medicamentos farmacia</p>
          <p className="text-2xl font-bold text-gray-800">{resumen.totalMedicamentos}</p>
          <div className="mt-1 space-y-0.5">
            {resumen.medicamentosStockBajo > 0 && (
              <p className="text-xs text-yellow-600">⚠ {resumen.medicamentosStockBajo} con stock bajo</p>
            )}
            {resumen.medicamentosAgotados > 0 && (
              <p className="text-xs text-red-500">✕ {resumen.medicamentosAgotados} agotados</p>
            )}
            {resumen.medicamentosStockBajo === 0 && resumen.medicamentosAgotados === 0 && (
              <p className="text-xs text-green-600">✓ Todo en orden</p>
            )}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 mb-1">Lotes por vencer</p>
          <p className={`text-2xl font-bold ${resumen.lotesPorVencer > 0 ? "text-yellow-600" : "text-gray-800"}`}>
            {resumen.lotesPorVencer}
          </p>
          <p className="text-xs text-gray-400 mt-1">proximos 30 dias</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 mb-1">Lotes vencidos</p>
          <p className={`text-2xl font-bold ${resumen.lotesVencidos > 0 ? "text-red-600" : "text-gray-800"}`}>
            {resumen.lotesVencidos}
          </p>
          <p className="text-xs text-gray-400 mt-1">con stock disponible</p>
        </div>
      </div>
 
      {/* ── KPIs fila 2: Movimientos del período ── */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Movimientos — últimos {periodo} dias
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 rounded-lg shadow p-4">
          <p className="text-xs text-blue-500 mb-1">Bodega — total</p>
          <p className="text-2xl font-bold text-blue-700">{resumen.totalMovimientosBodega}</p>
          <div className="mt-2 space-y-0.5 text-xs text-blue-600">
            <p>↑ {resumen.entradasBodega} entradas</p>
            <p>↓ {resumen.salidasBodega} salidas</p>
            {resumen.ajustesBodega > 0 && <p>± {resumen.ajustesBodega} ajustes</p>}
          </div>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4">
          <p className="text-xs text-green-500 mb-1">Farmacia — total</p>
          <p className="text-2xl font-bold text-green-700">{resumen.totalMovimientosFarmacia}</p>
          <div className="mt-2 space-y-0.5 text-xs text-green-600">
            <p>↑ {resumen.entradasFarmacia} entradas</p>
            <p>↓ {resumen.despachosFarmacia} despachos</p>
            {resumen.ajustesFarmacia > 0 && <p>± {resumen.ajustesFarmacia} ajustes</p>}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 mb-1">Ultimo mov. bodega</p>
          {resumen.ultimoMovBodega ? (
            <>
              <p className="text-sm font-semibold text-gray-800 mt-1 leading-tight">{resumen.ultimoMovBodega.nombre}</p>
              <p className="text-xs text-gray-500 mt-1">{resumen.ultimoMovBodega.tipo}</p>
              <p className="text-xs text-gray-400">{formatFechaCorta(resumen.ultimoMovBodega.fecha)}</p>
            </>
          ) : (
            <p className="text-xs text-gray-400 mt-2">Sin movimientos</p>
          )}
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 mb-1">Ultimo mov. farmacia</p>
          {resumen.ultimoMovFarmacia ? (
            <>
              <p className="text-sm font-semibold text-gray-800 mt-1 leading-tight">{resumen.ultimoMovFarmacia.nombre}</p>
              <p className="text-xs text-gray-500 mt-1">{resumen.ultimoMovFarmacia.tipo}</p>
              <p className="text-xs text-gray-400">{formatFechaCorta(resumen.ultimoMovFarmacia.fecha)}</p>
            </>
          ) : (
            <p className="text-xs text-gray-400 mt-2">Sin movimientos</p>
          )}
        </div>
      </div>
 
      {/* ── Gráficos de área ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Movimientos Bodega Municipal</h3>
          {stats.graficoBodega.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Sin movimientos en este periodo</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats.graficoBodega}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="fecha" tickFormatter={formatFechaGrafico} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(v) => `Fecha: ${formatFechaGrafico(v as string)}`} />
                <Legend />
                <Area type="monotone" dataKey="entradas" stroke="#16a34a" fill="#dcfce7" strokeWidth={2} />
                <Area type="monotone" dataKey="salidas" stroke="#dc2626" fill="#fee2e2" strokeWidth={2} />
                <Area type="monotone" dataKey="ajustes" stroke="#f97316" fill="#ffedd5" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
 
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Movimientos Farmacia Posta Rural</h3>
          {stats.graficoFarmacia.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Sin movimientos en este periodo</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats.graficoFarmacia}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="fecha" tickFormatter={formatFechaGrafico} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(v) => `Fecha: ${formatFechaGrafico(v as string)}`} />
                <Legend />
                <Area type="monotone" dataKey="entradas" stroke="#2563eb" fill="#dbeafe" strokeWidth={2} />
                <Area type="monotone" dataKey="salidas" stroke="#7c3aed" fill="#ede9fe" strokeWidth={2} />
                <Area type="monotone" dataKey="ajustes" stroke="#f97316" fill="#ffedd5" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
 
      {/* ── Top 5 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 5 productos más movidos — Bodega</h3>
          {stats.topProductosBodega.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Sin datos en este periodo</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.topProductosBodega} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10 }} width={120}
                  tickFormatter={(v) => v.length > 16 ? v.slice(0, 16) + "..." : v} />
                <Tooltip />
                <Bar dataKey="cantidad" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
 
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 5 medicamentos más despachados — Farmacia</h3>
          {stats.topMedicamentos.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Sin datos en este periodo</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.topMedicamentos} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10 }} width={120}
                  tickFormatter={(v) => v.length > 16 ? v.slice(0, 16) + "..." : v} />
                <Tooltip />
                <Bar dataKey="cantidad" fill="#16a34a" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Layout>
  )
}