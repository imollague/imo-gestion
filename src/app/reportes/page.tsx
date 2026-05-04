"use client"

import { useEffect, useState, useCallback } from "react"
import Layout from "@/components/Layout"
import BotonExportar from "@/components/BotonExportar"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell
} from "recharts"

// ── Tipos Bodega ─────────────────────────────────────
interface ReporteBodega {
  resumen: { totalMovimientos: number; totalEntradas: number; totalSalidas: number; totalAjustes: number; stockCritico: number }
  consumoPorProducto: { id: number; nombre: string; unidad: string; categoria: string; totalSalidas: number; totalEntradas: number; ajustes: number }[]
  evolucionPorDia: { fecha: string; entradas: number; salidas: number; ajustes: number }[]
  porCategoria: { nombre: string; cantidad: number }[]
  entradasVsSalidas: { mes: string; entradas: number; salidas: number }[]
  porUsuario: { nombre: string; entradas: number; salidas: number; ajustes: number; total: number }[]
  stockCritico: { id: number; nombre: string; categoria: string; unidad: string; stockActual: number; stockMinimo: number; agotado: boolean }[]
}

// ── Tipos Farmacia ───────────────────────────────────
interface ReporteFarmacia {
  resumen: { totalMovimientos: number; totalEntradas: number; totalDespachos: number; totalAjustes: number; stockCritico: number; lotesVencidos: number; lotesPorVencer: number }
  consumoPorMedicamento: { id: number; nombre: string; unidad: string; categoria: string; totalDespachos: number; totalEntradas: number; ajustes: number }[]
  evolucionPorDia: { fecha: string; entradas: number; despachos: number; ajustes: number }[]
  porCategoria: { nombre: string; cantidad: number }[]
  entradasVsDespachos: { mes: string; entradas: number; despachos: number }[]
  porUsuario: { nombre: string; entradas: number; despachos: number; ajustes: number; total: number }[]
  stockCritico: { id: number; nombre: string; categoria: string; unidad: string; stockActual: number; stockMinimo: number; agotado: boolean }[]
  lotesVencidos: { id: number; numeroLote: string; medicamento: string; unidad: string; stockActual: number; fechaVencimiento: string | null }[]
  lotesPorVencer: { id: number; numeroLote: string; medicamento: string; unidad: string; stockActual: number; fechaVencimiento: string | null }[]
}

const COLORES_TORTA = ["#2563eb", "#16a34a", "#f97316", "#7c3aed", "#dc2626", "#0891b2", "#ca8a04", "#be185d"]

const getMesActual = () => {
  const hoy = new Date()
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split("T")[0]
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split("T")[0]
  return { desde, hasta }
}

const formatMes = (mes: string) => {
  const [anio, m] = mes.split("-")
  const nombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
  return `${nombres[parseInt(m) - 1]} ${anio}`
}

const formatFecha = (fecha: string) =>
  new Date(fecha + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" })

const formatFechaVenc = (fecha: string) =>
  new Date(fecha).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })

export default function ReportesPage() {
  const mesActual = getMesActual()
  const [pestana, setPestana] = useState<"bodega" | "farmacia">("bodega")
  const [desde, setDesde] = useState(mesActual.desde)
  const [hasta, setHasta] = useState(mesActual.hasta)
  const [reporteBodega, setReporteBodega] = useState<ReporteBodega | null>(null)
  const [reporteFarmacia, setReporteFarmacia] = useState<ReporteFarmacia | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReporte = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = `desde=${desde}&hasta=${hasta}`
    try {
      if (pestana === "bodega") {
        const res = await fetch(`/api/reportes/bodega?${params}`)
        if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
        setReporteBodega(await res.json())
      } else {
        const res = await fetch(`/api/reportes/farmacia?${params}`)
        if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
        setReporteFarmacia(await res.json())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar el reporte")
    } finally {
      setLoading(false)
    }
  }, [pestana, desde, hasta])

  useEffect(() => {
    fetchReporte()
  }, [fetchReporte])

  const setPeriodoRapido = (meses: number) => {
    const hoy = new Date()
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - (meses - 1), 1)
    setDesde(inicio.toISOString().split("T")[0])
    setHasta(hoy.toISOString().split("T")[0])
  }

  return (
    <Layout titulo="Reportes y Analítica">

      {/* ── Pestañas ── */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button onClick={() => setPestana("bodega")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            pestana === "bodega" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}>
          Bodega Municipal
        </button>
        <button onClick={() => setPestana("farmacia")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            pestana === "farmacia" ? "border-green-600 text-green-600" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}>
          Farmacia Posta Rural
        </button>
      </div>

      {/* ── Filtros de fecha ── */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setDesde(mesActual.desde); setHasta(mesActual.hasta) }}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Mes actual
          </button>
          <button onClick={() => setPeriodoRapido(3)}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            3 meses
          </button>
          <button onClick={() => setPeriodoRapido(12)}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            12 meses
          </button>
        </div>
      </div>

      {loading && <p className="text-gray-500 text-sm mb-4">Cargando reporte...</p>}
      {error && <p className="text-red-600 text-sm mb-4 bg-red-50 border border-red-200 rounded px-4 py-2">{error}</p>}

      {/* ══════════════════════════════════════════════════
          PESTAÑA BODEGA
      ══════════════════════════════════════════════════ */}
      {pestana === "bodega" && reporteBodega && !loading && (
        <div className="space-y-6">

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total movimientos", valor: reporteBodega.resumen.totalMovimientos, color: "text-gray-800" },
              { label: "Unidades ingresadas", valor: reporteBodega.resumen.totalEntradas, color: "text-green-600" },
              { label: "Unidades despachadas", valor: reporteBodega.resumen.totalSalidas, color: "text-red-600" },
              { label: "Ajustes", valor: reporteBodega.resumen.totalAjustes, color: "text-orange-500" },
              { label: "Stock critico", valor: reporteBodega.resumen.stockCritico, color: reporteBodega.resumen.stockCritico > 0 ? "text-red-600" : "text-gray-800" },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-lg shadow p-4 text-center">
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.valor}</p>
                <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Evolución por día */}
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Evolución de salidas por fecha</h3>
            {reporteBodega.evolucionPorDia.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Sin movimientos en este periodo</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={reporteBodega.evolucionPorDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="fecha" tickFormatter={formatFecha} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={(v) => `Fecha: ${formatFecha(v as string)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="entradas" stroke="#16a34a" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="salidas" stroke="#dc2626" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ajustes" stroke="#f97316" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Barras apiladas por mes + Torta categoría */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Entradas vs Salidas por mes</h3>
              {reporteBodega.entradasVsSalidas.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Sin datos</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={reporteBodega.entradasVsSalidas}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(v) => formatMes(v as string)} />
                    <Legend />
                    <Bar dataKey="entradas" stackId="a" fill="#16a34a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="salidas" stackId="a" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribución salidas por categoria</h3>
              {reporteBodega.porCategoria.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Sin datos</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={reporteBodega.porCategoria} dataKey="cantidad" nameKey="nombre"
                      cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) =>
                        `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                      {reporteBodega.porCategoria.map((_, i) => (
                        <Cell key={i} fill={COLORES_TORTA[i % COLORES_TORTA.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top productos más despachados */}
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Productos más despachados</h3>
            {reporteBodega.consumoPorProducto.filter(p => p.totalSalidas > 0).length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Sin despachos en este periodo</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, reporteBodega.consumoPorProducto.filter(p => p.totalSalidas > 0).slice(0, 10).length * 35)}>
                <BarChart data={reporteBodega.consumoPorProducto.filter(p => p.totalSalidas > 0).slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10 }} width={150}
                    tickFormatter={(v) => v.length > 20 ? v.slice(0, 20) + "..." : v} />
                  <Tooltip />
                  <Bar dataKey="totalSalidas" name="Salidas" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Movimientos por usuario */}
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Movimientos por usuario</h3>
            {reporteBodega.porUsuario.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Sin movimientos</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Usuario</th>
                    <th className="text-right px-4 py-2 text-gray-600 font-medium">Entradas</th>
                    <th className="text-right px-4 py-2 text-gray-600 font-medium">Salidas</th>
                    <th className="text-right px-4 py-2 text-gray-600 font-medium">Ajustes</th>
                    <th className="text-right px-4 py-2 text-gray-600 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reporteBodega.porUsuario.map((u, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{u.nombre}</td>
                      <td className="px-4 py-2 text-right text-green-600">{u.entradas}</td>
                      <td className="px-4 py-2 text-right text-red-600">{u.salidas}</td>
                      <td className="px-4 py-2 text-right text-orange-500">{u.ajustes}</td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-800">{u.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Stock crítico */}
          {reporteBodega.stockCritico.length > 0 && (
            <div className="bg-white rounded-lg shadow p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Stock crítico actual</h3>
                <BotonExportar
                  titulo="Stock Critico Bodega"
                  subtitulo="Municipalidad de Ollagüe"
                  nombreArchivo="stock-critico-bodega"
                  filas={reporteBodega.stockCritico.map((p) => ({
                    nombre: p.nombre, categoria: p.categoria, unidad: p.unidad,
                    stockActual: p.stockActual, stockMinimo: p.stockMinimo,
                    estado: p.agotado ? "AGOTADO" : "STOCK BAJO",
                  }))}
                  columnas={[
                    { header: "Nombre", key: "nombre", ancho: 30 },
                    { header: "Categoria", key: "categoria", ancho: 20 },
                    { header: "Unidad", key: "unidad", ancho: 12 },
                    { header: "Stock Actual", key: "stockActual", ancho: 14 },
                    { header: "Stock Minimo", key: "stockMinimo", ancho: 14 },
                    { header: "Estado", key: "estado", ancho: 12 },
                  ]}
                />
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Producto</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Categoria</th>
                    <th className="text-right px-4 py-2 text-gray-600 font-medium">Stock actual</th>
                    <th className="text-right px-4 py-2 text-gray-600 font-medium">Stock minimo</th>
                    <th className="text-center px-4 py-2 text-gray-600 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reporteBodega.stockCritico.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{p.nombre}</td>
                      <td className="px-4 py-2 text-gray-600">{p.categoria}</td>
                      <td className="px-4 py-2 text-right font-semibold text-red-600">{p.stockActual} {p.unidad}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{p.stockMinimo} {p.unidad}</td>
                      <td className="px-4 py-2 text-center">
                        {p.agotado
                          ? <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-semibold">Agotado</span>
                          : <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs">Stock bajo</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Exportar consumo */}
          <div className="flex justify-end">
            <BotonExportar
              titulo={`Reporte Consumo Bodega ${desde} al ${hasta}`}
              subtitulo="Municipalidad de Ollagüe"
              nombreArchivo="reporte-consumo-bodega"
              filas={reporteBodega.consumoPorProducto.map((p) => ({
                nombre: p.nombre, categoria: p.categoria, unidad: p.unidad,
                totalEntradas: p.totalEntradas, totalSalidas: p.totalSalidas, ajustes: p.ajustes,
              }))}
              columnas={[
                { header: "Producto", key: "nombre", ancho: 35 },
                { header: "Categoria", key: "categoria", ancho: 20 },
                { header: "Unidad", key: "unidad", ancho: 12 },
                { header: "Total Entradas", key: "totalEntradas", ancho: 16 },
                { header: "Total Salidas", key: "totalSalidas", ancho: 16 },
                { header: "Ajustes", key: "ajustes", ancho: 12 },
              ]}
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          PESTAÑA FARMACIA
      ══════════════════════════════════════════════════ */}
      {pestana === "farmacia" && reporteFarmacia && !loading && (
        <div className="space-y-6">

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total movimientos", valor: reporteFarmacia.resumen.totalMovimientos, color: "text-gray-800" },
              { label: "Unidades ingresadas", valor: reporteFarmacia.resumen.totalEntradas, color: "text-green-600" },
              { label: "Unidades despachadas", valor: reporteFarmacia.resumen.totalDespachos, color: "text-red-600" },
              { label: "Ajustes", valor: reporteFarmacia.resumen.totalAjustes, color: "text-orange-500" },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-lg shadow p-4 text-center">
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.valor}</p>
                <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Alertas lotes */}
          {(reporteFarmacia.resumen.lotesVencidos > 0 || reporteFarmacia.resumen.lotesPorVencer > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reporteFarmacia.resumen.lotesVencidos > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-700 font-semibold text-sm mb-2">⚠ {reporteFarmacia.resumen.lotesVencidos} lote(s) vencido(s) con stock</p>
                  <div className="space-y-1">
                    {reporteFarmacia.lotesVencidos.map((l) => (
                      <p key={l.id} className="text-xs text-red-600">
                        {l.medicamento} — Lote {l.numeroLote} ({l.stockActual} {l.unidad})
                        {l.fechaVencimiento && ` — Venció: ${formatFechaVenc(l.fechaVencimiento)}`}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {reporteFarmacia.resumen.lotesPorVencer > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-700 font-semibold text-sm mb-2">⏰ {reporteFarmacia.resumen.lotesPorVencer} lote(s) por vencer en 30 dias</p>
                  <div className="space-y-1">
                    {reporteFarmacia.lotesPorVencer.map((l) => (
                      <p key={l.id} className="text-xs text-yellow-700">
                        {l.medicamento} — Lote {l.numeroLote} ({l.stockActual} {l.unidad})
                        {l.fechaVencimiento && ` — Vence: ${formatFechaVenc(l.fechaVencimiento)}`}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Evolución por día */}
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Evolución de despachos por fecha</h3>
            {reporteFarmacia.evolucionPorDia.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Sin movimientos en este periodo</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={reporteFarmacia.evolucionPorDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="fecha" tickFormatter={formatFecha} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={(v) => `Fecha: ${formatFecha(v as string)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="entradas" stroke="#16a34a" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="despachos" stroke="#7c3aed" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ajustes" stroke="#f97316" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Barras apiladas por mes + Torta categoría */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Entradas vs Despachos por mes</h3>
              {reporteFarmacia.entradasVsDespachos.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Sin datos</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={reporteFarmacia.entradasVsDespachos}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(v) => formatMes(v as string)} />
                    <Legend />
                    <Bar dataKey="entradas" stackId="a" fill="#16a34a" />
                    <Bar dataKey="despachos" stackId="a" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribución despachos por categoria</h3>
              {reporteFarmacia.porCategoria.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Sin datos</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={reporteFarmacia.porCategoria} dataKey="cantidad" nameKey="nombre"
                      cx="50%" cy="50%" outerRadius={80}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                      {reporteFarmacia.porCategoria.map((_, i) => (
                        <Cell key={i} fill={COLORES_TORTA[i % COLORES_TORTA.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top medicamentos más despachados */}
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Medicamentos más despachados</h3>
            {reporteFarmacia.consumoPorMedicamento.filter(m => m.totalDespachos > 0).length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Sin despachos en este periodo</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, reporteFarmacia.consumoPorMedicamento.filter(m => m.totalDespachos > 0).slice(0, 10).length * 35)}>
                <BarChart data={reporteFarmacia.consumoPorMedicamento.filter(m => m.totalDespachos > 0).slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10 }} width={150}
                    tickFormatter={(v) => v.length > 20 ? v.slice(0, 20) + "..." : v} />
                  <Tooltip />
                  <Bar dataKey="totalDespachos" name="Despachos" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Movimientos por usuario */}
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Movimientos por usuario</h3>
            {reporteFarmacia.porUsuario.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Sin movimientos</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Usuario</th>
                    <th className="text-right px-4 py-2 text-gray-600 font-medium">Entradas</th>
                    <th className="text-right px-4 py-2 text-gray-600 font-medium">Despachos</th>
                    <th className="text-right px-4 py-2 text-gray-600 font-medium">Ajustes</th>
                    <th className="text-right px-4 py-2 text-gray-600 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reporteFarmacia.porUsuario.map((u, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{u.nombre}</td>
                      <td className="px-4 py-2 text-right text-green-600">{u.entradas}</td>
                      <td className="px-4 py-2 text-right text-purple-600">{u.despachos}</td>
                      <td className="px-4 py-2 text-right text-orange-500">{u.ajustes}</td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-800">{u.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Stock crítico */}
          {reporteFarmacia.stockCritico.length > 0 && (
            <div className="bg-white rounded-lg shadow p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Stock crítico actual</h3>
                <BotonExportar
                  titulo="Stock Critico Farmacia"
                  subtitulo="Posta Rural - Municipalidad de Ollagüe"
                  nombreArchivo="stock-critico-farmacia"
                  filas={reporteFarmacia.stockCritico.map((m) => ({
                    nombre: m.nombre, categoria: m.categoria, unidad: m.unidad,
                    stockActual: m.stockActual, stockMinimo: m.stockMinimo,
                    estado: m.agotado ? "AGOTADO" : "STOCK BAJO",
                  }))}
                  columnas={[
                    { header: "Medicamento", key: "nombre", ancho: 35 },
                    { header: "Categoria", key: "categoria", ancho: 20 },
                    { header: "Unidad", key: "unidad", ancho: 12 },
                    { header: "Stock Actual", key: "stockActual", ancho: 14 },
                    { header: "Stock Minimo", key: "stockMinimo", ancho: 14 },
                    { header: "Estado", key: "estado", ancho: 12 },
                  ]}
                />
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Medicamento</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Categoria</th>
                    <th className="text-right px-4 py-2 text-gray-600 font-medium">Stock actual</th>
                    <th className="text-right px-4 py-2 text-gray-600 font-medium">Stock minimo</th>
                    <th className="text-center px-4 py-2 text-gray-600 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reporteFarmacia.stockCritico.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{m.nombre}</td>
                      <td className="px-4 py-2 text-gray-600">{m.categoria}</td>
                      <td className="px-4 py-2 text-right font-semibold text-red-600">{m.stockActual} {m.unidad}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{m.stockMinimo} {m.unidad}</td>
                      <td className="px-4 py-2 text-center">
                        {m.agotado
                          ? <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-semibold">Agotado</span>
                          : <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs">Stock bajo</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Exportar consumo */}
          <div className="flex justify-end">
            <BotonExportar
              titulo={`Reporte Consumo Farmacia ${desde} al ${hasta}`}
              subtitulo="Posta Rural - Municipalidad de Ollagüe"
              nombreArchivo="reporte-consumo-farmacia"
              filas={reporteFarmacia.consumoPorMedicamento.map((m) => ({
                nombre: m.nombre, categoria: m.categoria, unidad: m.unidad,
                totalEntradas: m.totalEntradas, totalDespachos: m.totalDespachos, ajustes: m.ajustes,
              }))}
              columnas={[
                { header: "Medicamento", key: "nombre", ancho: 35 },
                { header: "Categoria", key: "categoria", ancho: 20 },
                { header: "Unidad", key: "unidad", ancho: 12 },
                { header: "Total Entradas", key: "totalEntradas", ancho: 16 },
                { header: "Total Despachos", key: "totalDespachos", ancho: 16 },
                { header: "Ajustes", key: "ajustes", ancho: 12 },
              ]}
            />
          </div>
        </div>
      )}
    </Layout>
  )
}