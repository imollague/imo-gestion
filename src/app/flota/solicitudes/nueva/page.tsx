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
}

export default function NuevaSolicitudPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    vehiculoId: "", conductorNombre: "", destino: "", proposito: "",
  })

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetch("/api/flota/vehiculos")
        .then((r) => r.json())
        .then((d) => setVehiculos(d.filter((v: Vehiculo) => v.estado === "OPERATIVO" && !v.enUso)))
    }
  }, [session])

  // Pre-llenar nombre del conductor con el usuario logueado
  useEffect(() => {
    if (session?.user?.name && !form.conductorNombre) {
      setForm((f) => ({ ...f, conductorNombre: session.user.name ?? "" }))
    }
  }, [session])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    setError("")
    if (!form.vehiculoId || !form.conductorNombre || !form.destino || !form.proposito) {
      setError("Todos los campos son obligatorios.")
      return
    }
    setLoading(true)
    const res = await fetch("/api/flota/solicitudes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vehículo disponible *
            </label>
            {vehiculos.length === 0 ? (
              <p className="text-sm text-gray-400 py-3">No hay vehículos disponibles en este momento.</p>
            ) : (
              <div className="space-y-2">
                {vehiculos.map((v) => (
                  <label key={v.id} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${form.vehiculoId === String(v.id) ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <input
                      type="radio"
                      name="vehiculo"
                      value={v.id}
                      checked={form.vehiculoId === String(v.id)}
                      onChange={() => set("vehiculoId", String(v.id))}
                      className="accent-blue-600"
                    />
                    <div>
                      <span className="font-mono font-bold text-gray-800">{v.patente}</span>
                      <span className="text-gray-600 ml-2">{v.marca} {v.modelo}</span>
                      <span className="text-gray-400 text-xs ml-2 capitalize">
                        {v.tipo.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conductor *</label>
            <input
              value={form.conductorNombre}
              onChange={(e) => set("conductorNombre", e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
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

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={loading || vehiculos.length === 0}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg text-base font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Enviando..." : "Solicitar vehículo"}
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