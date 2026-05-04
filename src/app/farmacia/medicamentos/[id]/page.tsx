"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Layout from "@/components/Layout"
import { useSession } from "next-auth/react"
import ModalAnular from "@/components/ModalAnular"
import { TipoMovimiento } from "@/lib/types"

interface Categoria {
  id: number
  nombre: string
}

interface Movimiento {
  id: number
  tipo: string
  cantidad: number
  lote: string | null
  fechaVencimiento: string | null
  proveedor: string | null
  rutPaciente: string | null
  observacion: string | null
  fecha: string
  usuario: { id: number; name: string }
  anulado: boolean
  anulacionDeId: number | null
}

interface Lote {
  id: number
  numeroLote: string
  fechaVencimiento: string | null
  stockInicial: number
  stockActual: number
  fechaIngreso: string
  proveedor: string | null
  retirado: boolean
  motivoRetiro: string | null
  fechaRetiro: string | null
}

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
  categoria: Categoria
  movimientos: Movimiento[]
}

interface KardexRow {
  id: number
  fecha: string
  tipo: "ENTRADA" | "SALIDA" | "AJUSTE"
  lote: string | null
  fechaVencimiento: string | null
  proveedor: string | null
  rutPaciente: string | null
  observacion: string | null
  usuario: string
  entradas: number | null
  salidas: number | null
  ajuste: number | null
  saldo: number
}

const FORMAS_FARMACEUTICAS = [
  "Comprimido", "Cápsula", "Jarabe", "Suspensión", "Inyectable",
  "Crema", "Pomada", "Colirio", "Parche", "Supositorio", "Otro"
]

export default function DetalleMedicamentoPage() {
  const router = useRouter()
  const params = useParams()
  const { data: session } = useSession()
  const id = params.id as string

  const [medicamento, setMedicamento] = useState<Medicamento | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loadingLotes, setLoadingLotes] = useState(false)
  const [mostrarRetirados, setMostrarRetirados] = useState(false)
  const [loteARetirar, setLoteARetirar] = useState<Lote | null>(null)
  const [motivoRetiro, setMotivoRetiro] = useState("")
  const [retirando, setRetirando] = useState(false)
  const [errorRetiro, setErrorRetiro] = useState("")
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
    nombreGenerico: "",
    nombreComercial: "",
    formaFarmaceutica: "",
    concentracion: "",
    unidad: "",
    stockMinimo: "0",
    categoriaId: "",
  })

  useEffect(() => {
    fetchMedicamento()
    fetch("/api/farmacia/categorias").then((r) => r.json()).then(setCategorias)
  }, [id])

  useEffect(() => {
    if (id) fetchLotes()
  }, [id, mostrarRetirados])

  useEffect(() => {
    if (tab === "kardex") fetchKardex()
  }, [tab])

  const fetchMedicamento = async () => {
    setLoading(true)
    const res = await fetch(`/api/farmacia/medicamentos/${id}`)
    const data = await res.json()
    setMedicamento(data)
    setForm({
      codigo: data.codigo,
      nombreGenerico: data.nombreGenerico,
      nombreComercial: data.nombreComercial || "",
      formaFarmaceutica: data.formaFarmaceutica,
      concentracion: data.concentracion || "",
      unidad: data.unidad,
      stockMinimo: String(data.stockMinimo),
      categoriaId: String(data.categoria.id),
    })
    setLoading(false)
  }

  const fetchLotes = async () => {
    setLoadingLotes(true)
    const res = await fetch(`/api/farmacia/lotes?medicamentoId=${id}&soloActivos=${!mostrarRetirados}`)
    const data = await res.json()
    setLotes(data)
    setLoadingLotes(false)
  }

  const fetchKardex = async () => {
    setKardexLoading(true)
    const qs = new URLSearchParams()
    if (kardexDesde) qs.set("desde", kardexDesde)
    if (kardexHasta) qs.set("hasta", kardexHasta)
    const res = await fetch(`/api/farmacia/medicamentos/${id}/kardex?${qs}`)
    const data = await res.json()
    setKardex(data.kardex ?? [])
    setSaldoInicial(data.saldoInicial ?? 0)
    setKardexLoading(false)
  }

  const handleGuardar = async () => {
    setError("")
    setGuardando(true)
    const res = await fetch(`/api/farmacia/medicamentos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, stockMinimo: parseInt(form.stockMinimo) || 0, categoriaId: parseInt(form.categoriaId) }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || "Error al guardar"); setGuardando(false); return }
    setExito("Medicamento actualizado correctamente")
    setEditando(false)
    fetchMedicamento()
    setGuardando(false)
    setTimeout(() => setExito(""), 3000)
  }

  const handleDesactivar = async () => {
    if (!confirm(`¿Desactivar el medicamento "${medicamento?.nombreGenerico}"?`)) return
    const res = await fetch(`/api/farmacia/medicamentos/${id}`, { method: "DELETE" })
    if (res.ok) router.push("/farmacia")
  }

  const handleRetirarLote = async () => {
    if (!loteARetirar) return
    setErrorRetiro("")
    if (!motivoRetiro.trim()) { setErrorRetiro("El motivo es obligatorio"); return }
    setRetirando(true)
    const res = await fetch(`/api/farmacia/lotes/${loteARetirar.id}/retirar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo: motivoRetiro.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setErrorRetiro(data.error || "Error al retirar lote"); setRetirando(false); return }
    setLoteARetirar(null)
    setMotivoRetiro("")
    setRetirando(false)
    fetchMedicamento()
    fetchLotes()
    setExito(`Lote ${loteARetirar.numeroLote} retirado. Se descontaron ${loteARetirar.stockActual} unidades del stock.`)
    setTimeout(() => setExito(""), 5000)
  }

  const formatFecha = (fecha: string) =>
    new Date(fecha).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })

  const formatFechaVenc = (fecha: string) =>
    new Date(fecha).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })

  const esPorVencer = (fecha: string) => {
    const diff = new Date(fecha).getTime() - Date.now()
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
  }

  const estaVencido = (fecha: string) => new Date(fecha).getTime() < Date.now()

  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "FARMACIA"

  const lotesVencidos = lotes.filter((l) => !l.retirado && l.fechaVencimiento && estaVencido(l.fechaVencimiento) && l.stockActual > 0)

  if (loading) return <Layout titulo="Detalle de Medicamento"><p className="text-gray-500 text-sm">Cargando...</p></Layout>
  if (!medicamento) return <Layout titulo="Detalle de Medicamento"><p className="text-gray-500 text-sm">Medicamento no encontrado</p></Layout>

  return (
    <Layout titulo={`Medicamento: ${medicamento.nombreGenerico}`}>
      <div className="max-w-4xl mx-auto space-y-6">

        {exito && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">{exito}</div>}
        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>}

        {/* Alerta lotes vencidos */}
        {lotesVencidos.length > 0 && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex items-start gap-3">
            <span className="text-red-500 text-lg">⚠️</span>
            <div>
              <p className="text-red-700 font-semibold text-sm">Hay {lotesVencidos.length} lote(s) vencido(s) con stock disponible</p>
              <p className="text-red-600 text-xs mt-0.5">Revisa la sección de lotes y considera retirarlos.</p>
            </div>
          </div>
        )}

        {/* Ficha del medicamento */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{medicamento.nombreGenerico}</h3>
              {medicamento.nombreComercial && <p className="text-sm text-gray-500">{medicamento.nombreComercial}</p>}
              <p className="text-sm text-gray-400 font-mono">{medicamento.codigo}</p>
            </div>
            <div className="flex gap-2">
              {canEdit && !editando && (
                <button onClick={() => setEditando(true)} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700 transition-colors">Editar</button>
              )}
              {session?.user.role === "ADMIN" && (
                <button onClick={handleDesactivar} className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-sm hover:bg-red-100 transition-colors">Desactivar</button>
              )}
            </div>
          </div>

          {editando ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                  <input type="text" value={form.codigo} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                  <input type="text" value={form.unidad} onChange={(e) => setForm((f) => ({ ...f, unidad: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Genérico</label>
                <input type="text" value={form.nombreGenerico} onChange={(e) => setForm((f) => ({ ...f, nombreGenerico: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Comercial</label>
                <input type="text" value={form.nombreComercial} onChange={(e) => setForm((f) => ({ ...f, nombreComercial: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Forma Farmacéutica</label>
                  <select value={form.formaFarmaceutica} onChange={(e) => setForm((f) => ({ ...f, formaFarmaceutica: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    {FORMAS_FARMACEUTICAS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Concentración</label>
                  <input type="text" value={form.concentracion} onChange={(e) => setForm((f) => ({ ...f, concentracion: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Ej: 500mg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select value={form.categoriaId} onChange={(e) => setForm((f) => ({ ...f, categoriaId: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock mínimo</label>
                  <input type="number" min="0" value={form.stockMinimo} onChange={(e) => setForm((f) => ({ ...f, stockMinimo: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleGuardar} disabled={guardando}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                  {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
                <button onClick={() => setEditando(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div><span className="text-gray-500">Categoría:</span> <span className="text-gray-800 font-medium">{medicamento.categoria.nombre}</span></div>
              <div><span className="text-gray-500">Forma farmacéutica:</span> <span className="text-gray-800 font-medium">{medicamento.formaFarmaceutica}</span></div>
              <div><span className="text-gray-500">Concentración:</span> <span className="text-gray-800 font-medium">{medicamento.concentracion || "—"}</span></div>
              <div><span className="text-gray-500">Unidad:</span> <span className="text-gray-800 font-medium">{medicamento.unidad}</span></div>
              <div>
                <span className="text-gray-500">Stock actual:</span>{" "}
                <span className={`font-bold ${medicamento.stockActual <= medicamento.stockMinimo ? "text-red-600" : "text-green-600"}`}>
                  {medicamento.stockActual} {medicamento.unidad}
                </span>
              </div>
              <div><span className="text-gray-500">Stock mínimo:</span> <span className="text-gray-800 font-medium">{medicamento.stockMinimo} {medicamento.unidad}</span></div>
            </div>
          )}
        </div>

        {/* ── SECCIÓN LOTES ── */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-semibold text-gray-700">Lotes en stock</h3>
            <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
              <input type="checkbox" checked={mostrarRetirados} onChange={(e) => setMostrarRetirados(e.target.checked)}
                className="rounded border-gray-300" />
              Mostrar retirados
            </label>
          </div>

          {loadingLotes ? (
            <p className="text-gray-400 text-sm">Cargando lotes...</p>
          ) : lotes.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-400 text-sm">
              No hay lotes registrados para este medicamento
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">N° Lote</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Vencimiento</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Proveedor</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Ingreso</th>
                    <th className="text-right px-4 py-3 text-gray-600 font-medium">Stock inicial</th>
                    <th className="text-right px-4 py-3 text-gray-600 font-medium">Stock actual</th>
                    <th className="text-center px-4 py-3 text-gray-600 font-medium">Estado</th>
                    {canEdit && <th className="text-center px-4 py-3 text-gray-600 font-medium">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lotes.map((lote) => (
                    <tr key={lote.id} className={`hover:bg-gray-50 ${lote.retirado ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3 font-mono text-gray-700 font-medium">{lote.numeroLote}</td>
                      <td className="px-4 py-3">
                        {lote.fechaVencimiento ? (
                          <span className={`text-sm ${
                            estaVencido(lote.fechaVencimiento) ? "text-red-600 font-semibold"
                            : esPorVencer(lote.fechaVencimiento) ? "text-yellow-600 font-semibold"
                            : "text-gray-600"
                          }`}>
                            {formatFechaVenc(lote.fechaVencimiento)}
                            {estaVencido(lote.fechaVencimiento) && " ⚠️"}
                            {!estaVencido(lote.fechaVencimiento) && esPorVencer(lote.fechaVencimiento) && " ⏰"}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{lote.proveedor || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatFechaVenc(lote.fechaIngreso)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{lote.stockInicial} {medicamento.unidad}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        <span className={lote.stockActual === 0 ? "text-gray-400" : "text-gray-800"}>
                          {lote.stockActual} {medicamento.unidad}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {lote.retirado ? (
                          <div>
                            <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs font-semibold">Retirado</span>
                            {lote.motivoRetiro && <p className="text-xs text-gray-400 mt-0.5 max-w-32">{lote.motivoRetiro}</p>}
                          </div>
                        ) : lote.stockActual === 0 ? (
                          <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-xs">Agotado</span>
                        ) : lote.fechaVencimiento && estaVencido(lote.fechaVencimiento) ? (
                          <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs font-semibold">Vencido</span>
                        ) : lote.fechaVencimiento && esPorVencer(lote.fechaVencimiento) ? (
                          <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs">Por vencer</span>
                        ) : (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">Vigente</span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-center">
                          {!lote.retirado && lote.stockActual > 0 ? (
                            <button onClick={() => { setLoteARetirar(lote); setMotivoRetiro(""); setErrorRetiro("") }}
                              className="text-red-500 text-xs hover:underline">
                              Retirar
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── TABS: Movimientos / Kardex ── */}
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
              <a href={`/farmacia/movimientos/nuevo?medicamentoId=${medicamento.id}`}
                className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700 transition-colors">
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
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Lote / Vencimiento</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Proveedor / Paciente</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Usuario</th>
                    <th className="text-center px-4 py-3 text-gray-600 font-medium">Estado</th>
                    <th className="text-center px-4 py-3 text-gray-600 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {medicamento.movimientos.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-400">Sin movimientos registrados</td></tr>
                  ) : (
                    medicamento.movimientos.map((m) => (
                      <tr key={m.id} className={`hover:bg-gray-50 ${m.anulado ? "opacity-50 bg-gray-50" : ""}`}>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatFecha(m.fecha)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            m.anulacionDeId ? "bg-gray-100 text-gray-500"
                            : m.tipo === TipoMovimiento.ENTRADA ? "bg-green-100 text-green-700"
                            : m.tipo === TipoMovimiento.AJUSTE ? "bg-orange-100 text-orange-600"
                            : "bg-red-100 text-red-700"
                          }`}>
                            {m.anulacionDeId ? "ANULACION" : m.tipo === TipoMovimiento.SALIDA ? "DESPACHO" : m.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          <span className={
                            m.tipo === TipoMovimiento.ENTRADA ? "text-green-600"
                            : m.tipo === TipoMovimiento.AJUSTE ? "text-orange-600"
                            : "text-red-600"
                          }>
                            {m.tipo === TipoMovimiento.ENTRADA ? "+" : m.tipo === TipoMovimiento.AJUSTE ? "±" : "-"}{m.cantidad} {medicamento.unidad}
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
                              {estaVencido(m.fechaVencimiento) && " ⚠️ VENCIDO"}
                              {!estaVencido(m.fechaVencimiento) && esPorVencer(m.fechaVencimiento) && " ⚠️ Por vencer"}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {m.tipo === TipoMovimiento.ENTRADA ? m.proveedor : m.rutPaciente && `RUT: ${m.rutPaciente}`}
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
                            <button onClick={() => setMovimientoAAnular({
                              id: m.id,
                              descripcion: `${m.tipo} de ${m.cantidad} ${medicamento.unidad} (${formatFecha(m.fecha)})`
                            })} className="text-red-500 text-xs hover:underline">
                              Anular
                            </button>
                          ) : <span className="text-gray-300 text-xs">—</span>}
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
              <div className="bg-white rounded-lg shadow p-4 flex gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
                  <input
                    type="date"
                    value={kardexDesde}
                    onChange={(e) => setKardexDesde(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
                  <input
                    type="date"
                    value={kardexHasta}
                    onChange={(e) => setKardexHasta(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <button
                  onClick={fetchKardex}
                  className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-green-700 transition-colors"
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
                          <td colSpan={8} className="text-center py-8 text-gray-400">Sin movimientos en el período</td>
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
                                {row.tipo === "SALIDA" ? "DESPACHO" : row.tipo}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 max-w-xs">
                              {row.lote && <p className="text-xs">Lote: {row.lote}</p>}
                              {row.proveedor && <p className="text-xs text-gray-400">Prov: {row.proveedor}</p>}
                              {row.rutPaciente && <p className="text-xs text-gray-400">RUT: {row.rutPaciente}</p>}
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

      {/* Modal retirar lote */}
      {loteARetirar && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-800">Retirar lote</h3>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm space-y-1">
              <p className="font-medium text-red-700">Lote: {loteARetirar.numeroLote}</p>
              <p className="text-red-600">Stock a retirar: <span className="font-semibold">{loteARetirar.stockActual} {medicamento.unidad}</span></p>
              {loteARetirar.fechaVencimiento && (
                <p className="text-red-600">Vencimiento: {formatFechaVenc(loteARetirar.fechaVencimiento)}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo del retiro <span className="text-red-500">*</span>
              </label>
              <textarea
                value={motivoRetiro}
                onChange={(e) => setMotivoRetiro(e.target.value)}
                autoFocus
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                placeholder="Ej: Alerta sanitaria MINSAL circular N°123, lote dañado, vencimiento..."
              />
              {errorRetiro && <p className="text-red-500 text-xs mt-1">{errorRetiro}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={handleRetirarLote} disabled={retirando}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
                {retirando ? "Retirando..." : "Confirmar retiro"}
              </button>
              <button onClick={() => setLoteARetirar(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {movimientoAAnular && (
        <ModalAnular
          movimientoId={movimientoAAnular.id}
          descripcion={movimientoAAnular.descripcion}
          endpoint="/api/farmacia/movimientos"
          onAnulado={() => { setMovimientoAAnular(null); fetchMedicamento(); fetchLotes() }}
          onCerrar={() => setMovimientoAAnular(null)}
        />
      )}
    </Layout>
  )
}
