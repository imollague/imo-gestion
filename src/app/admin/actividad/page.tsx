"use client"

import { useEffect, useState } from "react"
import Layout from "@/components/Layout"

const ROLES: Record<string, string> = {
  ADMIN: "Admin",
  BODEGA: "Bodega",
  FARMACIA: "Farmacia",
  VIEWER: "Visor",
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  BODEGA: "bg-blue-100 text-blue-700",
  FARMACIA: "bg-green-100 text-green-700",
  VIEWER: "bg-gray-100 text-gray-500",
}

interface ActividadUsuario {
  usuario: { id: number; name: string; username: string; role: string }
  bodega: { total: number; entradas: number; salidas: number; ajustes: number; anulados: number; productosUnicos: number }
  farmacia: { total: number; entradas: number; despachos: number; ajustes: number; anulados: number; medicamentosUnicos: number }
  totalMovimientos: number
  ultimoMovimiento: string | null
}

export default function ActividadPage() {
  const [actividad, setActividad] = useState<ActividadUsuario[]>([])
  const [loading, setLoading] = useState(true)
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [periodo, setPeriodo] = useState<{ desde: string; hasta: string } | null>(null)

  // Inicializar con mes actual
  useEffect(() => {
    const hoy = new Date()
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    setDesde(primerDia.toISOString().split("T")[0])
    setHasta(hoy.toISOString().split("T")[0])
  }, [])

  useEffect(() => {
    if (desde && hasta) fetchActividad()
  }, [])

  const fetchActividad = async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (desde) qs.set("desde", desde)
    if (hasta) qs.set("hasta", hasta)
    const res = await fetch(`/api/admin/actividad?${qs}`)
    const data = await res.json()
    setActividad(data.actividad ?? [])
    setPeriodo({ desde: data.desde, hasta: data.hasta })
    setLoading(false)
  }

  const formatFecha = (f: string) =>
    new Date(f).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })

  const formatFechaPeriodo = (f: string) =>
    new Date(f).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })

  const totalGeneral = actividad.reduce((acc, a) => acc + a.totalMovimientos, 0)

  return (
    <Layout titulo="Actividad por Usuario">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button
            onClick={fetchActividad}
            className="bg-purple-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-purple-700 transition-colors"
          >
            Filtrar
          </button>
          <div className="flex gap-2 ml-auto">
            {["mes", "trimestre", "año"].map((p) => (
              <button
                key={p}
                onClick={() => {
                  const hoy = new Date()
                  let d = new Date()
                  if (p === "mes") d = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
                  else if (p === "trimestre") d = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1)
                  else d = new Date(hoy.getFullYear(), 0, 1)
                  setDesde(d.toISOString().split("T")[0])
                  setHasta(hoy.toISOString().split("T")[0])
                  setTimeout(fetchActividad, 0)
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors capitalize"
              >
                Este {p}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-center py-12 text-gray-400 text-sm">Cargando actividad...</p>
        ) : (
          <>
            {/* Encabezado período */}
            {periodo && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Período: <span className="font-medium text-gray-700">{formatFechaPeriodo(periodo.desde)}</span>
                  {" "}al{" "}
                  <span className="font-medium text-gray-700">{formatFechaPeriodo(periodo.hasta)}</span>
                  {" "}— <span className="font-semibold text-gray-800">{totalGeneral} movimientos totales</span>
                </p>
              </div>
            )}

            {/* Tarjetas por usuario */}
            <div className="space-y-4">
              {actividad.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-10 text-center text-gray-400 text-sm">
                  No hay actividad en el período seleccionado
                </div>
              ) : (
                actividad.map((a) => (
                  <div key={a.usuario.id} className="bg-white rounded-lg shadow p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
                          {a.usuario.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{a.usuario.name}</p>
                          <p className="text-xs text-gray-400">@{a.usuario.username}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[a.usuario.role]}`}>
                          {ROLES[a.usuario.role]}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-800">{a.totalMovimientos}</p>
                        <p className="text-xs text-gray-400">movimientos</p>
                      </div>
                    </div>

                    {a.totalMovimientos === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-2">Sin actividad en el período</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {/* Bodega */}
                        {a.bodega.total > 0 && (
                          <div className="bg-blue-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-blue-700 mb-2">Bodega — {a.bodega.total} movimientos</p>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <p className="text-lg font-bold text-green-600">{a.bodega.entradas}</p>
                                <p className="text-xs text-gray-500">Entradas</p>
                              </div>
                              <div>
                                <p className="text-lg font-bold text-red-500">{a.bodega.salidas}</p>
                                <p className="text-xs text-gray-500">Salidas</p>
                              </div>
                              <div>
                                <p className="text-lg font-bold text-yellow-600">{a.bodega.ajustes}</p>
                                <p className="text-xs text-gray-500">Ajustes</p>
                              </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-blue-100 flex justify-between text-xs text-gray-500">
                              <span>{a.bodega.productosUnicos} producto(s) distintos</span>
                              {a.bodega.anulados > 0 && (
                                <span className="text-orange-500">{a.bodega.anulados} anulado(s)</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Farmacia */}
                        {a.farmacia.total > 0 && (
                          <div className="bg-green-50 rounded-lg p-3">
                            <p className="text-xs font-semibold text-green-700 mb-2">Farmacia — {a.farmacia.total} movimientos</p>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <p className="text-lg font-bold text-green-600">{a.farmacia.entradas}</p>
                                <p className="text-xs text-gray-500">Entradas</p>
                              </div>
                              <div>
                                <p className="text-lg font-bold text-red-500">{a.farmacia.despachos}</p>
                                <p className="text-xs text-gray-500">Despachos</p>
                              </div>
                              <div>
                                <p className="text-lg font-bold text-yellow-600">{a.farmacia.ajustes}</p>
                                <p className="text-xs text-gray-500">Ajustes</p>
                              </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-green-100 flex justify-between text-xs text-gray-500">
                              <span>{a.farmacia.medicamentosUnicos} medicamento(s) distintos</span>
                              {a.farmacia.anulados > 0 && (
                                <span className="text-orange-500">{a.farmacia.anulados} anulado(s)</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {a.ultimoMovimiento && (
                      <p className="text-xs text-gray-400 mt-3 text-right">
                        Último movimiento: {formatFecha(a.ultimoMovimiento)}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
