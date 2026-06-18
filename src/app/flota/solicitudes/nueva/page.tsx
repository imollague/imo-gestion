"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Layout from "@/components/Layout"

interface Vehiculo {
  id: number
  patente: string
  marca: string
  modelo: string
  tipo: string
  estado: string
  enUso: boolean
  licenciasPermitidas: string[]
}

interface Conductor {
  id: number
  nombre: string
  tipoLicencia: string
}

function ConductorSelector({ onResuelto }: { onResuelto: (c: Conductor | null) => void }) {
  const [query, setQuery] = useState("")
  const [sugerencias, setSugerencias] = useState<Conductor[]>([])
  const [seleccionado, setSeleccionado] = useState<Conductor | null>(null)

  useEffect(() => {
    if (query.length < 2 || seleccionado) { setSugerencias([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/flota/conductores/buscar?q=${encodeURIComponent(query)}`)
      if (res.ok) setSugerencias(await res.json())
    }, 300)
    return () => clearTimeout(t)
  }, [query, seleccionado])

  const elegir = (c: Conductor) => {
    setSeleccionado(c)
    setQuery(c.nombre)
    setSugerencias([])
    onResuelto(c)
  }

  if (seleccionado) {
    return (
      <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
        <div>
          <p className="text-sm font-medium text-gray-800">{seleccionado.nombre}</p>
          <p className="text-xs text-gray-500">Licencia {seleccionado.tipoLicencia}</p>
        </div>
        <button
          onClick={() => { setSeleccionado(null); setQuery(""); onResuelto(null) }}
          className="text-xs text-blue-600 hover:underline"
        >Cambiar</button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nombre o RUT..."
        className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
      {sugerencias.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 overflow-hidden">
          {sugerencias.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); elegir(c) }}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
            >
              <span className="font-medium text-gray-800">{c.nombre}</span>
              <span className="text-gray-400 ml-2 text-xs">Licencia {c.tipoLicencia}</span>
            </button>
          ))}
        </div>
      )}
      {query.length >= 2 && sugerencias.length === 0 && (
        <p className="text-xs text-gray-400 mt-1">Sin coincidencias. Pide al encargado que registre al conductor en "Conductores".</p>
      )}
    </div>
  )
}

export default function NuevaSolicitudPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [conductor, setConductor] = useState<Conductor | null>(null)
  const [sinConductorRegistrado, setSinConductorRegistrado] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    vehiculoId: "", conductorNombre: "", destino: "", proposito: "",
    horaSalidaEst: "", horaRetornoEst: "", folioFedoks: "",
  })

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if (session) fetch("/api/flota/vehiculos").then((r) => r.json()).then(setVehiculos)
  }, [session])

  // Detección automática del conductor vinculado a la cuenta logueada
  useEffect(() => {
    const conductorFlotaId = session?.user?.conductorFlotaId
    if (conductorFlotaId) {
      fetch(`/api/flota/conductores/${conductorFlotaId}`)
        .then((r) => r.json())
        .then((c) => setConductor({ id: c.id, nombre: c.nombre, tipoLicencia: c.tipoLicencia }))
    }
  }, [session])

  useEffect(() => {
    if (conductor) set("conductorNombre", conductor.nombre)
  }, [conductor])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const vehiculosDisponibles = vehiculos.filter((v) => {
    if (v.estado !== "OPERATIVO" || v.enUso) return false
    if (sinConductorRegistrado || !conductor) return true
    return v.licenciasPermitidas.length === 0 || v.licenciasPermitidas.includes(conductor.tipoLicencia)
  })

  const handleSubmit = async () => {
    setError("")
    if (!form.vehiculoId || !form.conductorNombre || !form.destino || !form.proposito || !form.horaSalidaEst) {
      setError("Todos los campos marcados con * son obligatorios.")
      return
    }
    setLoading(true)
    const res = await fetch("/api/flota/solicitudes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, conductorFlotaId: conductor?.id ?? null }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error || "Error al crear solicitud")
      return
    }
    const data = await res.json()
    router.push(`/flota/solicitudes/${data.id}`)
  }

  return (
    <Layout titulo="Nueva Solicitud de Vehículo">
      <div className="max-w-xl">
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Conductor *</label>
            {sinConductorRegistrado ? (
              <div>
                <input
                  value={form.conductorNombre}
                  onChange={(e) => set("conductorNombre", e.target.value)}
                  placeholder="Nombre del conductor"
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  onClick={() => { setSinConductorRegistrado(false); set("conductorNombre", "") }}
                  className="text-xs text-blue-600 hover:underline mt-1"
                >Buscar en el registro de conductores</button>
              </div>
            ) : (
              <div>
                <ConductorSelector onResuelto={setConductor} />
                {!conductor && (
                  <button
                    onClick={() => setSinConductorRegistrado(true)}
                    className="text-xs text-gray-400 hover:text-gray-600 hover:underline mt-1"
                  >No encuentro al conductor, continuar con nombre libre</button>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Vehículo disponible *</label>
            {vehiculosDisponibles.length === 0 ? (
              <p className="text-sm text-gray-400 py-3">
                No hay vehículos disponibles{conductor ? ` para licencia ${conductor.tipoLicencia}` : ""} en este momento.
              </p>
            ) : (
              <select
                value={form.vehiculoId}
                onChange={(e) => set("vehiculoId", e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Seleccionar vehículo...</option>
                {vehiculosDisponibles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.patente} — {v.marca} {v.modelo} ({v.tipo.replace(/_/g, " ").toLowerCase()})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destino *</label>
            <input
              value={form.destino}
              onChange={(e) => set("destino", e.target.value)}
              placeholder="Ej: Calama"
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Propósito del viaje *</label>
            <textarea
              value={form.proposito}
              onChange={(e) => set("proposito", e.target.value)}
              rows={3}
              placeholder="Ej: Retiro de insumos para bodega municipal"
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Orden de Servicio</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora de salida estimada *</label>
                <input type="datetime-local" value={form.horaSalidaEst}
                  onChange={(e) => set("horaSalidaEst", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora de retorno estimada</label>
                <input type="datetime-local" value={form.horaRetornoEst}
                  onChange={(e) => set("horaRetornoEst", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Folio FEDOKS (opcional)</label>
                <input value={form.folioFedoks}
                  onChange={(e) => set("folioFedoks", e.target.value)}
                  placeholder="Ej: EXP-2026-001"
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg text-base font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Enviando..." : "Crear solicitud"}
            </button>
            <button
              onClick={() => router.back()}
              className="px-5 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
