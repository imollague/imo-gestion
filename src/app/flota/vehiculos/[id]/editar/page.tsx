"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import Layout from "@/components/Layout"
import { TIPOS_LICENCIA } from "@/lib/licencias"

const TIPOS = [
  { value: "CAMIONETA", label: "Camioneta" },
  { value: "SEDAN", label: "Sedán" },
  { value: "CAMION_LIVIANO", label: "Camión liviano" },
  { value: "CAMION_PESADO", label: "Camión pesado" },
  { value: "MAQUINARIA", label: "Maquinaria" },
  { value: "BUS", label: "Bus / Minibus" },
  { value: "OTRO", label: "Otro" },
]

const ESTADOS = [
  { value: "OPERATIVO", label: "Operativo" },
  { value: "EN_MANTENCION", label: "En mantención" },
  { value: "FUERA_SERVICIO", label: "Fuera de servicio" },
  { value: "DADO_DE_BAJA", label: "Dado de baja" },
]

interface TipoDocumento { id: number; nombre: string; diasAlertaDefault: number }

function toDateInput(iso: string | null) {
  if (!iso) return ""
  return iso.split("T")[0]
}

export default function EditarVehiculoPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([])
  const [vencimientos, setVencimientos] = useState<Record<number, string>>({})
  const [licencias, setLicencias] = useState<string[]>([])
  const [form, setForm] = useState({
    patente: "", marca: "", modelo: "", anio: "", tipo: "", estado: "", kmActual: "",
    observaciones: "",
  })

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    fetch("/api/flota/tipos-documento").then((r) => r.json()).then(setTiposDocumento)
  }, [])

  useEffect(() => {
    if (session) {
      fetch(`/api/flota/vehiculos/${id}`)
        .then((r) => r.json())
        .then((v) => {
          setForm({
            patente: v.patente ?? "",
            marca: v.marca ?? "",
            modelo: v.modelo ?? "",
            anio: String(v.anio ?? ""),
            tipo: v.tipo ?? "",
            estado: v.estado ?? "",
            kmActual: String(v.kmActual ?? 0),
            observaciones: v.observaciones ?? "",
          })
          setLicencias(v.licenciasPermitidas ?? [])
          const vencMap: Record<number, string> = {}
          for (const ve of v.vencimientos ?? []) vencMap[ve.tipoDocumentoId] = toDateInput(ve.fechaVencimiento)
          setVencimientos(vencMap)
        })
    }
  }, [session, id])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const toggleLicencia = (v: string) =>
    setLicencias((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]))

  const handleSubmit = async () => {
    setError("")
    setLoading(true)
    const vencimientosAEnviar = tiposDocumento.map((td) => ({
      tipoDocumentoId: td.id,
      fechaVencimiento: vencimientos[td.id] || null,
    }))
    const res = await fetch(`/api/flota/vehiculos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        observaciones: form.observaciones || null,
        licenciasPermitidas: licencias,
        vencimientos: vencimientosAEnviar,
      }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error || "Error al actualizar")
      return
    }
    router.push(`/flota/vehiculos/${id}`)
  }

  return (
    <Layout titulo="Editar Vehículo">
      <div className="max-w-2xl">
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patente</label>
              <input
                value={form.patente}
                onChange={(e) => set("patente", e.target.value.toUpperCase())}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={form.tipo} onChange={(e) => set("tipo", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <input value={form.marca} onChange={(e) => set("marca", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
              <input value={form.modelo} onChange={(e) => set("modelo", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
              <input type="number" value={form.anio} onChange={(e) => set("anio", e.target.value)}
                inputMode="numeric"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Km actual</label>
              <input type="number" value={form.kmActual} onChange={(e) => set("kmActual", e.target.value)}
                inputMode="numeric"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select value={form.estado} onChange={(e) => set("estado", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Vencimientos documentales</p>
            <div className="grid grid-cols-3 gap-4">
              {tiposDocumento.map((td) => (
                <div key={td.id}>
                  <label className="block text-xs text-gray-500 mb-1">{td.nombre}</label>
                  <input type="date" value={vencimientos[td.id] ?? ""}
                    onChange={(e) => setVencimientos((v) => ({ ...v, [td.id]: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-1">Licencias permitidas</p>
            <p className="text-xs text-gray-400 mb-3">Sin selección = cualquier conductor puede solicitarlo</p>
            <div className="flex flex-wrap gap-2">
              {TIPOS_LICENCIA.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => toggleLicencia(t.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-colors ${
                    licencias.includes(t.value)
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"
                  }`}
                >
                  {t.value}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea value={form.observaciones} onChange={(e) => set("observaciones", e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={handleSubmit} disabled={loading}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? "Guardando..." : "Guardar cambios"}
            </button>
            <button onClick={() => router.back()}
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}