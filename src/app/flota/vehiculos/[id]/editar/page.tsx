"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import Layout from "@/components/Layout"
import { TIPOS_LICENCIA } from "@/lib/licencias"
import { MAQUINARIA_TIPOS } from "@/lib/vehiculoUtils"

const TIPOS_VEHICULO = [
  { group: "Livianos", items: [
    { value: "AUTOMOVIL", label: "Automóvil" },
    { value: "STATION_WAGON", label: "Station Wagon" },
    { value: "TODO_TERRENO", label: "Todo Terreno / SUV" },
    { value: "CAMIONETA", label: "Camioneta" },
    { value: "FURGON", label: "Furgón" },
    { value: "MOTOCICLETA", label: "Motocicleta" },
  ]},
  { group: "Pesados", items: [
    { value: "MINIBUS", label: "Minibus" },
    { value: "BUS", label: "Bus" },
    { value: "CAMION", label: "Camión" },
  ]},
  { group: "Maquinaria / Remolques", items: [
    { value: "MAQUINARIA", label: "Maquinaria" },
    { value: "CARRO_ARRASTRE", label: "Carro de Arrastre" },
    { value: "OTRO", label: "Otro" },
  ]},
]

const USOS_MUNICIPALES = [
  { value: "AMBULANCIA", label: "Ambulancia" },
  { value: "ALJIBE", label: "Aljibe" },
  { value: "RECOLECTOR_RESIDUOS", label: "Recolector de residuos" },
  { value: "TRANSPORTE_PERSONAL", label: "Transporte de personal" },
  { value: "OPERATIVO_TERRENO", label: "Operativo en terreno" },
  { value: "EMERGENCIA", label: "Emergencia" },
  { value: "ADMINISTRATIVO", label: "Administrativo" },
  { value: "OBRAS", label: "Obras" },
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
    patente: "", numeroInterno: "", marca: "", modelo: "", anio: "", tipo: "",
    estado: "", usoMunicipal: "", unidadMedidaUso: "KILOMETROS",
    kmActual: "", horasUso: "", observaciones: "",
  })

  const role = session?.user?.role

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  if (role && role !== "ADMIN" && role !== "ENCARGADO") {
    return <Layout titulo="Editar Vehículo"><p className="text-gray-400 p-8">Sin permisos.</p></Layout>
  }

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
            numeroInterno: v.numeroInterno ?? "",
            marca: v.marca ?? "",
            modelo: v.modelo ?? "",
            anio: String(v.anio ?? ""),
            tipo: v.tipo ?? "",
            estado: v.estado ?? "",
            usoMunicipal: v.usoMunicipal ?? "",
            unidadMedidaUso: v.unidadMedidaUso ?? "KILOMETROS",
            kmActual: String(v.kmActual ?? 0),
            horasUso: String(v.horasUso ?? 0),
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

  const setTipo = (v: string) => {
    const isMaq = MAQUINARIA_TIPOS.includes(v)
    setForm((f) => ({ ...f, tipo: v, unidadMedidaUso: isMaq ? "HORAS" : f.unidadMedidaUso }))
  }

  const toggleLicencia = (v: string) =>
    setLicencias((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]))

  const esMaquinaria = MAQUINARIA_TIPOS.includes(form.tipo)
  const usaHoras = form.unidadMedidaUso === "HORAS"

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
        patente: form.patente || null,
        numeroInterno: form.numeroInterno || null,
        usoMunicipal: form.usoMunicipal || null,
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Seleccionar...</option>
                {TIPOS_VEHICULO.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.items.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </optgroup>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Copia el tipo tal como aparece en el certificado de inscripción (padrón)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select
                value={form.estado}
                onChange={(e) => set("estado", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {esMaquinaria ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número interno</label>
                <input
                  value={form.numeroInterno}
                  onChange={(e) => set("numeroInterno", e.target.value.toUpperCase())}
                  placeholder="MAQ-001"
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patente</label>
                <input
                  value={form.patente}
                  onChange={(e) => set("patente", e.target.value.toUpperCase())}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Uso municipal</label>
              <select
                value={form.usoMunicipal}
                onChange={(e) => set("usoMunicipal", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Sin clasificar</option>
                {USOS_MUNICIPALES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <input
                value={form.marca}
                onChange={(e) => set("marca", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
              <input
                value={form.modelo}
                onChange={(e) => set("modelo", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
              <input
                type="number"
                value={form.anio}
                onChange={(e) => set("anio", e.target.value)}
                inputMode="numeric"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {usaHoras ? "Horas de uso" : "Km actual"}
              </label>
              <input
                type="number"
                value={usaHoras ? form.horasUso : form.kmActual}
                onChange={(e) => set(usaHoras ? "horasUso" : "kmActual", e.target.value)}
                inputMode="numeric"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de medida</label>
              <select
                value={form.unidadMedidaUso}
                onChange={(e) => set("unidadMedidaUso", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="KILOMETROS">Kilómetros</option>
                <option value="HORAS">Horas</option>
              </select>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Vencimientos documentales</p>
            <div className="grid grid-cols-3 gap-4">
              {tiposDocumento.map((td) => (
                <div key={td.id}>
                  <label className="block text-xs text-gray-500 mb-1">{td.nombre}</label>
                  <input
                    type="date"
                    value={vencimientos[td.id] ?? ""}
                    onChange={(e) => setVencimientos((v) => ({ ...v, [td.id]: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
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
            <textarea
              value={form.observaciones}
              onChange={(e) => set("observaciones", e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              onClick={() => router.back()}
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
