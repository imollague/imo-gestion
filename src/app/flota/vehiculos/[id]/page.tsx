"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import Layout from "@/components/Layout"

interface Vehiculo {
  id: number
  patente: string
  marca: string
  modelo: string
  anio: number
  tipo: string
  estado: string
  kmActual: number
  vencimientoSOAP: string | null
  vencimientoRevTecnica: string | null
  vencimientoPermiso: string | null
  observaciones: string | null
  imagenUrl: string | null
  hojaVida: { id: number; tipo: string; descripcion: string; fecha: string; usuario: { name: string } }[]
  documentos: { id: number; nombre: string; tipo: string; url: string; fecha: string; subidoPor: { name: string } }[]
  solicitudes: { id: number; estado: string; destino: string; conductorNombre: string; fechaSolicitud: string }[]
}

const ESTADO_COLOR: Record<string, string> = {
  OPERATIVO: "bg-green-100 text-green-700",
  EN_MANTENCION: "bg-yellow-100 text-yellow-700",
  FUERA_SERVICIO: "bg-red-100 text-red-700",
  DADO_DE_BAJA: "bg-gray-100 text-gray-500",
}

const TIPO_HOJA: Record<string, string> = {
  USO: "🚗",
  MANTENCION: "🔧",
  CORRECCION: "✏️",
  ALERTA: "⚠️",
  DOCUMENTO: "📄",
}

const TIPOS_DOC = [
  { value: "SOAP", label: "SOAP" },
  { value: "PERMISO", label: "Permiso de circulación" },
  { value: "SEGURO", label: "Seguro" },
  { value: "REVISION_TECNICA", label: "Revisión técnica" },
  { value: "OTRO", label: "Otro" },
]

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function SubirDocumento({ vehiculoId, onSubido }: { vehiculoId: number; onSubido: () => void }) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [nombre, setNombre] = useState("")
  const [tipo, setTipo] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubir = async () => {
    if (!archivo || !nombre || !tipo) { setError("Completa todos los campos"); return }
    setError("")
    setLoading(true)
    const fd = new FormData()
    fd.append("archivo", archivo)
    fd.append("nombre", nombre)
    fd.append("tipo", tipo)
    const res = await fetch(`/api/flota/vehiculos/${vehiculoId}/documentos`, {
      method: "POST",
      body: fd,
    })
    setLoading(false)
    if (!res.ok) { const d = await res.json(); setError(d.error || "Error al subir"); return }
    setArchivo(null); setNombre(""); setTipo("")
    onSubido()
  }

  return (
    <div className="border-t pt-4 mt-4 space-y-3">
      <p className="text-sm font-medium text-gray-600">Adjuntar documento</p>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Tipo</label>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
          <option value="">Seleccionar...</option>
          {TIPOS_DOC.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Nombre descriptivo</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: SOAP 2026"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Archivo (PDF, imagen)</label>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <button onClick={handleSubir} disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {loading ? "Subiendo..." : "Subir documento"}
      </button>
    </div>
  )
}

function DocVencimiento({ label, fecha }: { label: string; fecha: string | null }) {
  if (!fecha) return <div className="text-sm text-gray-400">{label}: no registrado</div>
  const dias = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
  const color = dias < 0 ? "text-red-600 font-semibold" : dias <= 15 ? "text-red-500" : dias <= 30 ? "text-yellow-600" : "text-green-600"
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={color}>
        {fmtFecha(fecha)} {dias < 0 ? "(VENCIDO)" : dias <= 30 ? `(${dias} días)` : "✓"}
      </span>
    </div>
  )
}

export default function VehiculoDetallePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const cargarVehiculo = useCallback(() => {
    if (!session) return
    fetch(`/api/flota/vehiculos/${id}`)
      .then((r) => r.json())
      .then((d) => { setVehiculo(d); setCargando(false) })
  }, [session, id])

  useEffect(() => { cargarVehiculo() }, [cargarVehiculo])

  const role = session?.user?.role

  if (cargando) return <Layout titulo="Vehículo"><div className="text-gray-400 p-8">Cargando...</div></Layout>
  if (!vehiculo) return <Layout titulo="Vehículo"><div className="text-gray-400 p-8">No encontrado</div></Layout>

  return (
    <Layout titulo={`${vehiculo.patente} — ${vehiculo.marca} ${vehiculo.modelo}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Columna izquierda: ficha + documentos */}
        <div className="lg:col-span-1 space-y-4">

          {/* Ficha del vehículo */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {vehiculo.imagenUrl && (
              <img src={vehiculo.imagenUrl} alt={vehiculo.patente}
                className="w-full h-40 object-cover" />
            )}
            <div className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-2xl font-mono font-bold text-gray-800">{vehiculo.patente}</p>
                <p className="text-gray-600">{vehiculo.marca} {vehiculo.modelo} {vehiculo.anio}</p>
                <p className="text-gray-400 text-sm capitalize">{vehiculo.tipo.replace(/_/g, " ").toLowerCase()}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${ESTADO_COLOR[vehiculo.estado]}`}>
                {vehiculo.estado.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              <span className="font-medium">Kilometraje:</span> {vehiculo.kmActual.toLocaleString()} km
            </p>
            {vehiculo.observaciones && (
              <p className="text-sm text-gray-500 italic">{vehiculo.observaciones}</p>
            )}
            {(role === "ADMIN" || role === "FLOTA" || role === "ENCARGADO") && (
              <a
                href={`/flota/vehiculos/${vehiculo.id}/editar`}
                className="mt-4 block text-center text-sm text-blue-600 hover:underline"
              >
                Editar vehículo
              </a>
            )}
            {(role === "ADMIN" || role === "ENCARGADO") && (
              <div className="mt-3 border-t pt-3">
                <p className="text-xs text-gray-500 mb-1">Imagen del vehículo</p>
                <input type="file" accept=".jpg,.jpeg,.png,.webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const fd = new FormData()
                    fd.append("archivo", file)
                    await fetch(`/api/flota/vehiculos/${vehiculo.id}/imagen`, { method: "POST", body: fd })
                    cargarVehiculo()
                    e.target.value = ""
                  }}
                  className="w-full text-xs text-gray-600 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {vehiculo.imagenUrl && (
                  <button
                    onClick={async () => {
                      if (!confirm("¿Eliminar la imagen del vehículo?")) return
                      await fetch(`/api/flota/vehiculos/${vehiculo.id}/imagen`, { method: "DELETE" })
                      cargarVehiculo()
                    }}
                    className="mt-1 text-xs text-red-400 hover:text-red-600"
                  >Eliminar imagen</button>
                )}
              </div>
            )}
            {role === "ADMIN" && (
              <button
                onClick={async () => {
                  if (!confirm(`¿Desactivar el vehículo ${vehiculo.patente}? Quedará oculto del listado pero sus registros se conservan.`)) return
                  const res = await fetch(`/api/flota/vehiculos/${vehiculo.id}`, { method: "DELETE" })
                  if (res.ok) router.push("/flota")
                }}
                className="mt-2 w-full text-center text-sm text-red-500 hover:text-red-700 hover:underline"
              >
                Desactivar vehículo
              </button>
            )}
            </div>
          </div>

          {/* Documentación */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="font-medium text-gray-700 mb-3">Documentación</p>
            <div className="space-y-2">
              <DocVencimiento label="SOAP" fecha={vehiculo.vencimientoSOAP} />
              <DocVencimiento label="Revisión técnica" fecha={vehiculo.vencimientoRevTecnica} />
              <DocVencimiento label="Permiso circulación" fecha={vehiculo.vencimientoPermiso} />
            </div>
          </div>

          {/* Archivos adjuntos */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="font-medium text-gray-700 mb-3">Archivos adjuntos</p>
            {vehiculo.documentos.length === 0 ? (
              <p className="text-sm text-gray-400">Sin archivos adjuntos</p>
            ) : (
              <ul className="space-y-2">
                {vehiculo.documentos.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{d.nombre}</p>
                      <p className="text-xs text-gray-400">
                        {TIPOS_DOC.find((t) => t.value === d.tipo)?.label ?? d.tipo} · {fmtFecha(d.fecha)}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <a href={d.url} target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 text-xs hover:underline">
                        Ver
                      </a>
                      {(role === "ADMIN" || role === "FLOTA") && (
                        <button
                          onClick={async () => {
                            if (!confirm("¿Eliminar este documento?")) return
                            await fetch(`/api/flota/vehiculos/${vehiculo.id}/documentos`, {
                              method: "DELETE",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ documentoId: d.id }),
                            })
                            cargarVehiculo()
                          }}
                          className="text-red-400 text-xs hover:text-red-600"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {(role === "ADMIN" || role === "FLOTA") && (
              <SubirDocumento vehiculoId={vehiculo.id} onSubido={cargarVehiculo} />
            )}
          </div>
        </div>

        {/* Columna derecha: hoja de vida + solicitudes recientes */}
        <div className="lg:col-span-2 space-y-4">

          {/* Últimas solicitudes */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="font-medium text-gray-700 mb-3">Últimos usos</p>
            {vehiculo.solicitudes.length === 0 ? (
              <p className="text-sm text-gray-400">Sin solicitudes registradas</p>
            ) : (
              <div className="space-y-2">
                {vehiculo.solicitudes.map((s) => (
                  <div key={s.id}
                    onClick={() => router.push(`/flota/solicitudes/${s.id}`)}
                    className="cursor-pointer hover:bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-700 truncate">{s.destino}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0">{s.estado}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                      <span>{fmtFecha(s.fechaSolicitud)}</span>
                      <span>·</span>
                      <span className="truncate">{s.conductorNombre}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Hoja de vida */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="font-medium text-gray-700 mb-4">Hoja de vida</p>
            {vehiculo.hojaVida.length === 0 ? (
              <p className="text-sm text-gray-400">Sin registros en hoja de vida</p>
            ) : (
              <ol className="relative border-l border-gray-200 ml-3 space-y-4">
                {vehiculo.hojaVida.map((h) => (
                  <li key={h.id} className="ml-4">
                    <span className="absolute -left-2.5 flex h-5 w-5 items-center justify-center text-sm">
                      {TIPO_HOJA[h.tipo] ?? "•"}
                    </span>
                    <p className="text-sm text-gray-800">{h.descripcion}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {fmtFecha(h.fecha)} · {h.usuario.name}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:underline">
          ← Volver
        </button>
      </div>
    </Layout>
  )
}