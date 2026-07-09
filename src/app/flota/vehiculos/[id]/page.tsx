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
  vencimientos: { id: number; fechaVencimiento: string; diasAlerta: number | null; tipoDocumento: { nombre: string; diasAlertaDefault: number } }[]
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
  CHECKLIST: "📋",
  OBSERVACION: "⚠️",
}

interface ObservacionNota { id: number; texto: string; fecha: string; autor: { name: string } }
interface ObservacionArchivo { id: number; nombre: string; url: string; fecha: string; subidoPor: { name: string } }
interface Observacion {
  id: number
  origen: string
  descripcion: string
  estado: string
  fecha: string
  creadoPor: { name: string } | null
  cerradoPor: { name: string } | null
  fechaCierre: string | null
  notas: ObservacionNota[]
  archivos: ObservacionArchivo[]
}

function ObservacionCard({ obs, puedeGestionar, onChange }: {
  obs: Observacion
  puedeGestionar: boolean
  onChange: () => void
}) {
  const [notaTexto, setNotaTexto] = useState("")
  const [mostrarForm, setMostrarForm] = useState(false)

  const cambiarEstado = async (estado: string) => {
    await fetch(`/api/flota/observaciones/${obs.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    })
    onChange()
  }

  const agregarNota = async () => {
    if (!notaTexto.trim()) return
    await fetch(`/api/flota/observaciones/${obs.id}/notas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: notaTexto }),
    })
    setNotaTexto("")
    onChange()
  }

  const adjuntarArchivo = async (file: File) => {
    const fd = new FormData()
    fd.append("archivo", file)
    await fetch(`/api/flota/observaciones/${obs.id}/archivos`, { method: "POST", body: fd })
    onChange()
  }

  return (
    <div className={`rounded-lg p-4 border ${obs.estado === "ABIERTA" ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-gray-800">{obs.descripcion}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {fmtFecha(obs.fecha)}{obs.creadoPor ? ` · ${obs.creadoPor.name}` : ""} · {obs.origen === "CHECKLIST" ? "Checklist" : "Manual"}
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${obs.estado === "ABIERTA" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {obs.estado === "ABIERTA" ? "Abierta" : "Cerrada"}
        </span>
      </div>

      {(obs.notas.length > 0 || obs.archivos.length > 0) && (
        <div className="mt-3 space-y-1.5 border-t pt-2">
          {obs.notas.map((n) => (
            <p key={n.id} className="text-xs text-gray-600">📝 {n.texto} <span className="text-gray-400">— {n.autor.name}, {fmtFecha(n.fecha)}</span></p>
          ))}
          {obs.archivos.map((a) => (
            <p key={a.id} className="text-xs">
              📎 <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{a.nombre}</a>
              <span className="text-gray-400"> — {a.subidoPor.name}, {fmtFecha(a.fecha)}</span>
            </p>
          ))}
        </div>
      )}

      {puedeGestionar && (
        <div className="mt-3 border-t pt-3">
          {mostrarForm && (
            <div className="flex gap-2 mb-2">
              <input value={notaTexto} onChange={(e) => setNotaTexto(e.target.value)}
                placeholder="Agregar nota..."
                className="flex-1 border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <button onClick={agregarNota} className="bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-gray-800">Guardar</button>
            </div>
          )}
          <div className="flex gap-3 text-xs">
            <button onClick={() => cambiarEstado(obs.estado === "ABIERTA" ? "CERRADA" : "ABIERTA")}
              className="text-blue-600 hover:underline">
              {obs.estado === "ABIERTA" ? "Cerrar" : "Reabrir"}
            </button>
            <button onClick={() => setMostrarForm((m) => !m)} className="text-gray-500 hover:underline">Adjuntar nota</button>
            <label className="text-gray-500 hover:underline cursor-pointer">
              Adjuntar archivo
              <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) adjuntarArchivo(f); e.target.value = "" }} />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

function ObservacionesPanel({ vehiculoId, puedeGestionar }: { vehiculoId: number; puedeGestionar: boolean }) {
  const [observaciones, setObservaciones] = useState<Observacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [mostrarCerradas, setMostrarCerradas] = useState(false)
  const [nuevaDesc, setNuevaDesc] = useState("")

  const cargar = useCallback(() => {
    fetch(`/api/flota/vehiculos/${vehiculoId}/observaciones`)
      .then((r) => r.json())
      .then((d) => { setObservaciones(d); setCargando(false) })
  }, [vehiculoId])

  useEffect(() => { cargar() }, [cargar])

  const crearManual = async () => {
    if (!nuevaDesc.trim()) return
    await fetch(`/api/flota/vehiculos/${vehiculoId}/observaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descripcion: nuevaDesc }),
    })
    setNuevaDesc("")
    cargar()
  }

  const abiertas = observaciones.filter((o) => o.estado === "ABIERTA")
  const cerradas = observaciones.filter((o) => o.estado === "CERRADA")

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <p className="font-medium text-gray-700 mb-3">Observaciones</p>
      {cargando ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : (
        <>
          {abiertas.length === 0 ? (
            <p className="text-sm text-gray-400 mb-3">Sin observaciones abiertas</p>
          ) : (
            <div className="space-y-2 mb-3">
              {abiertas.map((o) => <ObservacionCard key={o.id} obs={o} puedeGestionar={puedeGestionar} onChange={cargar} />)}
            </div>
          )}

          {cerradas.length > 0 && (
            <div className="mb-3">
              <button onClick={() => setMostrarCerradas((m) => !m)} className="text-xs text-gray-400 hover:underline">
                {mostrarCerradas ? "Ocultar" : "Ver"} {cerradas.length} cerrada{cerradas.length > 1 ? "s" : ""}
              </button>
              {mostrarCerradas && (
                <div className="space-y-2 mt-2">
                  {cerradas.map((o) => <ObservacionCard key={o.id} obs={o} puedeGestionar={puedeGestionar} onChange={cargar} />)}
                </div>
              )}
            </div>
          )}

          {puedeGestionar && (
            <div className="border-t pt-3 flex gap-2">
              <input value={nuevaDesc} onChange={(e) => setNuevaDesc(e.target.value)}
                placeholder="Registrar observación manual..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <button onClick={crearManual} className="bg-gray-700 text-white px-3 py-2 rounded-lg text-sm hover:bg-gray-800">+ Agregar</button>
            </div>
          )}
        </>
      )}
    </div>
  )
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

function DocVencimiento({ label, fecha, umbral }: { label: string; fecha: string; umbral: number }) {
  const dias = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
  const color = dias < 0 ? "text-red-600 font-semibold" : dias <= umbral ? "text-yellow-600" : "text-green-600"
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={color}>
        {fmtFecha(fecha)} {dias < 0 ? "(VENCIDO)" : dias <= umbral ? `(${dias} días)` : "✓"}
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
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((d) => { setVehiculo(d); setCargando(false) })
      .catch(() => { setCargando(false) })
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
                    const res = await fetch(`/api/flota/vehiculos/${vehiculo.id}/imagen`, { method: "POST", body: fd })
                    if (res.ok) cargarVehiculo()
                    e.target.value = ""
                  }}
                  className="w-full text-xs text-gray-600 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {vehiculo.imagenUrl && (
                  <button
                    onClick={async () => {
                      if (!confirm("¿Eliminar la imagen del vehículo?")) return
                      const res = await fetch(`/api/flota/vehiculos/${vehiculo.id}/imagen`, { method: "DELETE" })
                      if (res.ok) cargarVehiculo()
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
            {vehiculo.vencimientos.length === 0 ? (
              <p className="text-sm text-gray-400">Sin vencimientos registrados</p>
            ) : (
              <div className="space-y-2">
                {vehiculo.vencimientos.map((ve) => (
                  <DocVencimiento
                    key={ve.id}
                    label={ve.tipoDocumento.nombre}
                    fecha={ve.fechaVencimiento}
                    umbral={ve.diasAlerta ?? ve.tipoDocumento.diasAlertaDefault}
                  />
                ))}
              </div>
            )}
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

          {/* Observaciones */}
          <ObservacionesPanel vehiculoId={vehiculo.id} puedeGestionar={role === "ADMIN" || role === "ENCARGADO"} />

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