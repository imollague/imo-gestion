"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
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
  const { data: session, status } = useSession()
  const router = useRouter()
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [filtroCategoria, setFiltroCategoria] = useState("")
  const [loading, setLoading] = useState(true)
  const [actasPendientes, setActasPendientes] = useState<{ id: number; descripcion: string; creadoPor: { name: string }; createdAt: string; items: { nombre: string; diferencia: number }[] }[]>([])
  const [firmandoActa, setFirmandoActa] = useState<number | null>(null)
  const [actaMsg, setActaMsg] = useState<{ id: number; tipo: "ok" | "error"; texto: string } | null>(null)
  const [mermasPendientes, setMermasPendientes] = useState<{ id: number; descripcion: string; motivo: string; creadoPor: { name: string }; createdAt: string; items: { nombre: string; cantidad: number; unidad: string }[] }[]>([])
  const [firmandoMerma, setFirmandoMerma] = useState<number | null>(null)
  const [mermaMsg, setMermaMsg] = useState<{ id: number; tipo: "ok" | "error"; texto: string } | null>(null)
  const [retirosPendientes, setRetirosPendientes] = useState<{ id: number; descripcion: string; causa: string; destino: string; creadoPor: { name: string }; createdAt: string; items: { nombre: string; cantidad: number; unidad: string; lote: string | null }[] }[]>([])
  const [firmandoRetiro, setFirmandoRetiro] = useState<number | null>(null)
  const [retiroMsg, setRetiroMsg] = useState<{ id: number; tipo: "ok" | "error"; texto: string } | null>(null)

  useEffect(() => {
    fetchMedicamentos()
    fetchActasPendientes()
    fetchMermasPendientes()
    fetchRetirosPendientes()
  }, [])

  const fetchMedicamentos = async () => {
    setLoading(true)
    const res = await fetch("/api/farmacia/medicamentos")
    const data = await res.json()
    setMedicamentos(data)
    setLoading(false)
  }

  const fetchActasPendientes = async () => {
    const res = await fetch("/api/farmacia/inventario")
    if (res.ok) setActasPendientes(await res.json())
  }

  const fetchMermasPendientes = async () => {
    const res = await fetch("/api/farmacia/merma")
    if (res.ok) setMermasPendientes(await res.json())
  }

  const fetchRetirosPendientes = async () => {
    const res = await fetch("/api/farmacia/retiro-sanitario")
    if (res.ok) setRetirosPendientes(await res.json())
  }

  const firmarRetiroComoJefe = async (actaId: number) => {
    setFirmandoRetiro(actaId)
    setRetiroMsg(null)
    const res = await fetch(`/api/farmacia/retiro-sanitario/${actaId}/jefe`, { method: "POST" })
    const data = await res.json()
    setFirmandoRetiro(null)
    if (res.ok) {
      setRetiroMsg({ id: actaId, tipo: "ok", texto: `Retiro autorizado. ${data.retiradosAplicados} medicamento(s) retirado(s) del stock.` })
      fetchRetirosPendientes()
      fetchMedicamentos()
    } else {
      setRetiroMsg({ id: actaId, tipo: "error", texto: data.error || "Error al firmar" })
    }
  }

  const firmarMermaComoJefe = async (actaId: number) => {
    setFirmandoMerma(actaId)
    setMermaMsg(null)
    const res = await fetch(`/api/farmacia/merma/${actaId}/jefe`, { method: "POST" })
    const data = await res.json()
    setFirmandoMerma(null)
    if (res.ok) {
      setMermaMsg({ id: actaId, tipo: "ok", texto: `Merma autorizada. ${data.bajaAplicada} medicamento(s) dados de baja.` })
      fetchMermasPendientes()
      fetchMedicamentos()
    } else {
      setMermaMsg({ id: actaId, tipo: "error", texto: data.error || "Error al firmar" })
    }
  }

  const firmarComoJefe = async (actaId: number) => {
    setFirmandoActa(actaId)
    setActaMsg(null)
    const res = await fetch(`/api/farmacia/inventario/${actaId}/jefe`, { method: "POST" })
    const data = await res.json()
    setFirmandoActa(null)
    if (res.ok) {
      setActaMsg({ id: actaId, tipo: "ok", texto: `Acta firmada. ${data.ajustesAplicados} ajuste(s) de stock aplicados.` })
      fetchActasPendientes()
    } else {
      setActaMsg({ id: actaId, tipo: "error", texto: data.error || "Error al firmar" })
    }
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

  const role = session?.user?.role
  const puedeInventario = role === "ADMIN" || role === "FARMACIA"
  const esJefe = role === "ADMIN"

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
        {puedeInventario && (
          <a href="/farmacia/inventario/nuevo"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            Toma de Inventario
          </a>
        )}
        {puedeInventario && (
          <a href="/farmacia/merma/nueva"
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
            Registrar Merma
          </a>
        )}
        {puedeInventario && (
          <a href="/farmacia/retiro-sanitario/nueva"
            className="bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-800 transition-colors">
            Retiro Sanitario
          </a>
        )}
      </div>

      {/* Panel actas pendientes de firma del jefe */}
      {esJefe && actasPendientes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <h3 className="text-amber-800 font-semibold mb-3">
            Actas de inventario pendientes de tu firma ({actasPendientes.length})
          </h3>
          <div className="space-y-3">
            {actasPendientes.map((acta) => (
              <div key={acta.id} className="bg-white border border-amber-100 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{acta.descripcion}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Realizado por: {acta.creadoPor.name} — {new Date(acta.createdAt).toLocaleDateString("es-CL")}
                    </p>
                    {acta.items.length > 0 && (
                      <ul className="mt-2 text-xs text-gray-600 space-y-0.5">
                        {acta.items.map((item, i) => (
                          <li key={i}>
                            {item.nombre}: diferencia de {item.diferencia > 0 ? "+" : ""}{item.diferencia} unidades
                          </li>
                        ))}
                      </ul>
                    )}
                    {actaMsg?.id === acta.id && (
                      <p className={`text-xs mt-2 ${actaMsg.tipo === "ok" ? "text-green-700" : "text-red-600"}`}>
                        {actaMsg.texto}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => firmarComoJefe(acta.id)}
                    disabled={firmandoActa === acta.id}
                    className="shrink-0 bg-amber-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
                  >
                    {firmandoActa === acta.id ? "Firmando..." : "Firmar y aplicar ajustes"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panel mermas pendientes de autorización */}
      {esJefe && mermasPendientes.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="text-red-800 font-semibold mb-3">
            Actas de merma pendientes de tu autorización ({mermasPendientes.length})
          </h3>
          <div className="space-y-3">
            {mermasPendientes.map((acta) => (
              <div key={acta.id} className="bg-white border border-red-100 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{acta.descripcion}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Registrado por: {acta.creadoPor.name} — {new Date(acta.createdAt).toLocaleDateString("es-CL")}
                    </p>
                    {acta.items.length > 0 && (
                      <ul className="mt-2 text-xs text-gray-600 space-y-0.5">
                        {acta.items.map((item, i) => (
                          <li key={i}>
                            {item.nombre}: -{item.cantidad} {item.unidad}
                          </li>
                        ))}
                      </ul>
                    )}
                    {mermaMsg?.id === acta.id && (
                      <p className={`text-xs mt-2 ${mermaMsg.tipo === "ok" ? "text-green-700" : "text-red-600"}`}>
                        {mermaMsg.texto}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => firmarMermaComoJefe(acta.id)}
                    disabled={firmandoMerma === acta.id}
                    className="shrink-0 bg-red-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {firmandoMerma === acta.id ? "Firmando..." : "Autorizar y aplicar baja"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panel retiros sanitarios pendientes de autorización */}
      {esJefe && retirosPendientes.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <h3 className="text-orange-800 font-semibold mb-3">
            Actas de retiro sanitario pendientes de tu autorización ({retirosPendientes.length})
          </h3>
          <div className="space-y-3">
            {retirosPendientes.map((acta) => (
              <div key={acta.id} className="bg-white border border-orange-100 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{acta.descripcion}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Registrado por: {acta.creadoPor.name} — {new Date(acta.createdAt).toLocaleDateString("es-CL")}
                    </p>
                    {acta.items.length > 0 && (
                      <ul className="mt-2 text-xs text-gray-600 space-y-0.5">
                        {acta.items.map((item, i) => (
                          <li key={i}>
                            {item.nombre}{item.lote ? ` (Lote ${item.lote})` : ""}: -{item.cantidad} {item.unidad}
                          </li>
                        ))}
                      </ul>
                    )}
                    {retiroMsg?.id === acta.id && (
                      <p className={`text-xs mt-2 ${retiroMsg.tipo === "ok" ? "text-green-700" : "text-red-600"}`}>
                        {retiroMsg.texto}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => firmarRetiroComoJefe(acta.id)}
                    disabled={firmandoRetiro === acta.id}
                    className="shrink-0 bg-orange-700 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-orange-800 disabled:opacity-50 transition-colors"
                  >
                    {firmandoRetiro === acta.id ? "Firmando..." : "Autorizar retiro sanitario"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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