"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import Layout from "@/components/Layout"
import jsPDF from "jspdf"

interface ChecklistItem { id: number; categoria: string; descripcion: string; orden: number }
interface ChecklistRespuesta { itemId: number; valor: string; observacion: string }
interface ParadaViaje { id: number; km: number; descripcion: string | null; litros: number | null; comprobanteRef: string | null; fecha: string }
interface FotoRevision { id: number; tipo: string; url: string }

interface Solicitud {
  id: number
  conductorNombre: string
  destino: string
  proposito: string
  estado: string
  fechaSolicitud: string
  fechaCierre: string | null
  motivoRechazo: string | null
  vehiculo: { id: number; patente: string; marca: string; modelo: string; tipo: string; imagenUrl: string | null }
  creadoPor: { id: number; name: string }
  aprobadoPor: { name: string } | null
  cerradoPor: { name: string } | null
  checklist: { id: number; respuestas: { item: ChecklistItem; valor: string; observacion: string | null }[] } | null
  ordenServicio: { id: number; horaSalidaEst: string; horaRetornoEst: string | null; folioFedoks: string | null; firmada: boolean; firmadaPor: { name: string } | null; fechaFirma: string | null } | null
  bitacora: { id: number; kmSalida: number; kmLlegada: number | null; horaRetornoReal: string | null; observacion: string | null; paradas: ParadaViaje[] } | null
  hojaVida: { id: number; tipo: string; descripcion: string; fecha: string; usuario: { name: string } }[]
  fotosRevision: FotoRevision[]
}

// Nuevo flujo: checklist + OS disponibles desde PENDIENTE, encargado autoriza OS
function getPaso(s: Solicitud): number {
  if (s.estado === "RECHAZADA") return 0
  if (s.estado === "PENDIENTE") {
    if (!s.checklist) return 1          // conductor: completar checklist
    if (!s.ordenServicio) return 2      // conductor: generar OS
    if (!s.ordenServicio.firmada) return 3  // encargado: autorizar OS
    return 3
  }
  if (s.estado === "APROBADA") return 4   // conductor: registrar km salida
  if (s.estado === "EN_CURSO") return 5   // conductor: paradas + llegada
  if (s.estado === "CERRADA") return 6
  return 0
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL")
}

function generarPDFOrden(s: Solicitud) {
  const doc = new jsPDF()
  const margen = 20
  let y = margen

  // Encabezado
  doc.setFontSize(11)
  doc.setTextColor(100)
  doc.text("Municipalidad de Ollagüe — Sistema IMO", margen, y)
  y += 8
  doc.setFontSize(16)
  doc.setTextColor(0)
  doc.setFont("helvetica", "bold")
  doc.text(`Orden de Servicio N° ${s.id}`, margen, y)
  y += 6
  doc.setDrawColor(200)
  doc.line(margen, y, 210 - margen, y)
  y += 10

  // Datos
  const campos: [string, string][] = [
    ["Conductor", s.conductorNombre],
    ["Vehículo", `${s.vehiculo.patente} — ${s.vehiculo.marca} ${s.vehiculo.modelo}`],
    ["Destino", s.destino],
    ["Propósito", s.proposito],
    ["Salida estimada", s.ordenServicio?.horaSalidaEst ? fmt(s.ordenServicio.horaSalidaEst) : "—"],
    ["Retorno estimado", s.ordenServicio?.horaRetornoEst ? fmt(s.ordenServicio.horaRetornoEst) : "—"],
    ["Fecha solicitud", fmtFecha(s.fechaSolicitud)],
    ...(s.ordenServicio?.folioFedoks ? [["Folio FEDOKS", s.ordenServicio.folioFedoks] as [string, string]] : []),
  ]

  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  for (const [label, valor] of campos) {
    doc.setFont("helvetica", "bold")
    doc.text(`${label}:`, margen, y)
    doc.setFont("helvetica", "normal")
    doc.text(valor, margen + 55, y)
    y += 8
  }

  // Firma
  y += 16
  doc.line(margen, y, margen + 70, y)
  y += 6
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text("Firma Autorizante", margen, y)
  doc.text("(Administrador / Alcalde / Subrogante)", margen, y + 5)

  doc.line(210 - margen - 70, y - 6, 210 - margen, y - 6)
  doc.text("Firma Conductor", 210 - margen - 70, y)

  doc.save(`OS-${s.id}-${s.vehiculo.patente}.pdf`)
}

// ─── Componentes de cada paso ────────────────────────

const FOTO_TIPOS = [
  { value: "FRONTAL", label: "Frontal", icon: "⬆️" },
  { value: "LATERAL_IZQ", label: "Lateral Izq.", icon: "⬅️" },
  { value: "LATERAL_DER", label: "Lateral Der.", icon: "➡️" },
  { value: "POSTERIOR", label: "Posterior", icon: "⬇️" },
]

function FotosChecklist({ solicitudId, fotosIniciales }: {
  solicitudId: number
  fotosIniciales: FotoRevision[]
}) {
  const [fotos, setFotos] = useState<FotoRevision[]>(fotosIniciales)
  const [subiendo, setSubiendo] = useState<string | null>(null)

  const subirFoto = async (tipo: string, file: File) => {
    setSubiendo(tipo)
    const fd = new FormData()
    fd.append("archivo", file)
    fd.append("tipo", tipo)
    const res = await fetch(`/api/flota/solicitudes/${solicitudId}/checklist/fotos`, { method: "POST", body: fd })
    setSubiendo(null)
    if (res.ok) {
      const nueva = await res.json()
      setFotos((prev) => [...prev.filter((f) => f.tipo !== tipo), nueva])
    }
  }

  const eliminarFoto = async (fotoId: number, tipo: string) => {
    const res = await fetch(`/api/flota/solicitudes/${solicitudId}/checklist/fotos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fotoId }),
    })
    if (res.ok) setFotos((prev) => prev.filter((f) => f.id !== fotoId))
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-3">📷 Fotografías del vehículo <span className="text-gray-400 font-normal">(opcional)</span></p>
      <div className="grid grid-cols-2 gap-3">
        {FOTO_TIPOS.map(({ value, label, icon }) => {
          const foto = fotos.find((f) => f.tipo === value)
          return (
            <div key={value} className="relative rounded-xl overflow-hidden border-2 border-dashed border-gray-200 bg-gray-50">
              {foto ? (
                <div>
                  <img src={foto.url} alt={label} className="w-full h-24 object-cover" />
                  <div className="flex items-center justify-between px-2 py-1 bg-white">
                    <span className="text-xs text-green-700 font-medium">{icon} {label} ✓</span>
                    <button onClick={() => eliminarFoto(foto.id, value)}
                      className="text-xs text-red-400 hover:text-red-600">✕</button>
                  </div>
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center h-28 cursor-pointer ${subiendo === value ? "opacity-50" : "hover:bg-gray-100"} transition-colors`}>
                  {subiendo === value ? (
                    <span className="text-xs text-gray-400">Subiendo...</span>
                  ) : (
                    <>
                      <span className="text-xl mb-1">{icon}</span>
                      <span className="text-xs font-medium text-gray-600">{label}</span>
                      <span className="text-xs text-gray-400 mt-0.5">Tomar / adjuntar</span>
                    </>
                  )}
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    disabled={!!subiendo}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) subirFoto(value, file)
                      e.target.value = ""
                    }}
                  />
                </label>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PasoChecklist({ solicitudId, vehiculo, fotosIniciales, onDone }: {
  solicitudId: number
  vehiculo: Solicitud["vehiculo"]
  fotosIniciales: FotoRevision[]
  onDone: () => void
}) {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [respuestas, setRespuestas] = useState<Record<number, ChecklistRespuesta>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/flota/checklist-items")
      .then((r) => r.json())
      .then((d) => {
        setItems(d)
        const init: Record<number, ChecklistRespuesta> = {}
        d.forEach((i: ChecklistItem) => { init[i.id] = { itemId: i.id, valor: "", observacion: "" } })
        setRespuestas(init)
      })
  }, [])

  const categorias = [...new Set(items.map((i) => i.categoria))]

  const setValor = (itemId: number, valor: string) =>
    setRespuestas((r) => ({ ...r, [itemId]: { ...r[itemId], valor } }))
  const setObs = (itemId: number, obs: string) =>
    setRespuestas((r) => ({ ...r, [itemId]: { ...r[itemId], observacion: obs } }))

  const handleSubmit = async () => {
    const sin = Object.values(respuestas).filter((r) => !r.valor)
    if (sin.length > 0) { setError("Debes responder todos los ítems"); return }
    const sinObsNoOk = Object.values(respuestas).filter((r) => r.valor === "NO_OK" && !r.observacion.trim())
    if (sinObsNoOk.length > 0) { setError("Los ítems NO OK requieren una observación"); return }
    setLoading(true)
    const res = await fetch(`/api/flota/solicitudes/${solicitudId}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ respuestas: Object.values(respuestas) }),
    })
    setLoading(false)
    if (!res.ok) { const d = await res.json(); setError(d.error); return }
    onDone()
  }

  return (
    <div className="space-y-6">
      {/* Imagen del vehículo */}
      {vehiculo.imagenUrl && (
        <img
          src={vehiculo.imagenUrl}
          alt={vehiculo.patente}
          className="w-full max-h-48 object-cover rounded-xl"
        />
      )}
      <p className="text-gray-600">Revisa el vehículo y completa el checklist antes de salir.</p>
      {categorias.map((cat) => (
        <div key={cat}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{cat}</p>
          <div className="space-y-3">
            {items.filter((i) => i.categoria === cat).map((item) => (
              <div key={item.id} className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-800 mb-3">{item.descripcion}</p>
                <div className="flex gap-2">
                  {(["OK", "NO_OK", "NA"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setValor(item.id, v)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors border-2 ${
                        respuestas[item.id]?.valor === v
                          ? v === "OK" ? "bg-green-500 border-green-500 text-white"
                            : v === "NO_OK" ? "bg-red-500 border-red-500 text-white"
                            : "bg-gray-400 border-gray-400 text-white"
                          : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"
                      }`}
                    >
                      {v === "OK" ? "✓ OK" : v === "NO_OK" ? "✗ NO OK" : "N/A"}
                    </button>
                  ))}
                </div>
                <input
                  placeholder={respuestas[item.id]?.valor === "NO_OK" ? "Observación (obligatoria)" : "Observación (opcional)"}
                  value={respuestas[item.id]?.observacion || ""}
                  onChange={(e) => setObs(item.id, e.target.value)}
                  className={`mt-2 w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                    respuestas[item.id]?.valor === "NO_OK" ? "border-red-300 bg-red-50" : "bg-white"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="border-t pt-4">
        <FotosChecklist solicitudId={solicitudId} fotosIniciales={fotosIniciales} />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-base font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Guardando..." : "Confirmar Checklist"}
      </button>
    </div>
  )
}

function PasoOrden({ solicitudId, onDone }: { solicitudId: number; onDone: () => void }) {
  const [form, setForm] = useState({ horaSalidaEst: "", horaRetornoEst: "", folioFedoks: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    if (!form.horaSalidaEst) { setError("La hora de salida es obligatoria"); return }
    setLoading(true)
    const res = await fetch(`/api/flota/solicitudes/${solicitudId}/orden`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setLoading(false)
    if (!res.ok) { const d = await res.json(); setError(d.error); return }
    onDone()
  }

  return (
    <div className="space-y-5">
      <p className="text-gray-600">Completa los datos de la orden de servicio.</p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Hora de salida estimada *</label>
        <input type="datetime-local" value={form.horaSalidaEst}
          onChange={(e) => setForm((f) => ({ ...f, horaSalidaEst: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Hora de retorno estimada</label>
        <input type="datetime-local" value={form.horaRetornoEst}
          onChange={(e) => setForm((f) => ({ ...f, horaRetornoEst: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Folio FEDOKS (opcional)</label>
        <input value={form.folioFedoks}
          onChange={(e) => setForm((f) => ({ ...f, folioFedoks: e.target.value }))}
          placeholder="Ej: EXP-2026-001"
          className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        <p className="text-xs text-gray-400 mt-1">Si subes la OS a FEDOKS, ingresa el folio aquí para trazabilidad.</p>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button onClick={handleSubmit} disabled={loading}
        className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-base font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {loading ? "Guardando..." : "Generar Orden de Servicio"}
      </button>
    </div>
  )
}

function PasoBitacora({ solicitudId, bitacora, onDone }: {
  solicitudId: number
  bitacora: Solicitud["bitacora"]
  onDone: () => void
}) {
  const [kmSalida, setKmSalida] = useState("")
  const [kmLlegada, setKmLlegada] = useState("")
  const [horaRetorno, setHoraRetorno] = useState("")
  const [observacion, setObservacion] = useState("")
  const [paradaForm, setParadaForm] = useState({ km: "", descripcion: "", litros: "", comprobanteRef: "" })
  const [mostrarCombustible, setMostrarCombustible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const registrarSalida = async () => {
    if (!kmSalida) { setError("Ingresa el km de salida"); return }
    setLoading(true)
    const res = await fetch(`/api/flota/solicitudes/${solicitudId}/bitacora`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kmSalida }),
    })
    setLoading(false)
    if (!res.ok) { const d = await res.json(); setError(d.error); return }
    onDone()
  }

  const agregarParada = async () => {
    if (!paradaForm.km) { setError("El km es obligatorio"); return }
    if (mostrarCombustible && !paradaForm.litros) { setError("Ingresa los litros cargados"); return }
    setLoading(true)
    const res = await fetch(`/api/flota/solicitudes/${solicitudId}/bitacora/parada`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        km: paradaForm.km,
        descripcion: paradaForm.descripcion || null,
        litros: mostrarCombustible ? paradaForm.litros : null,
        comprobanteRef: mostrarCombustible ? paradaForm.comprobanteRef || null : null,
      }),
    })
    setLoading(false)
    if (!res.ok) { const d = await res.json(); setError(d.error); return }
    setParadaForm({ km: "", descripcion: "", litros: "", comprobanteRef: "" })
    setMostrarCombustible(false)
    onDone()
  }

  const registrarLlegada = async () => {
    if (!kmLlegada) { setError("Ingresa el km de llegada"); return }
    if (bitacora && parseInt(kmLlegada) <= bitacora.kmSalida) {
      setError(`El km de llegada debe ser mayor al de salida (${bitacora.kmSalida.toLocaleString()} km)`)
      return
    }
    if (!confirm("¿Registrar llegada y cerrar el proceso? Esta acción es irreversible.")) return
    setLoading(true)
    const res = await fetch(`/api/flota/solicitudes/${solicitudId}/bitacora`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kmLlegada, horaRetornoReal: horaRetorno || undefined, observacion }),
    })
    setLoading(false)
    if (!res.ok) { const d = await res.json(); setError(d.error); return }
    onDone()
  }

  if (!bitacora) {
    return (
      <div className="space-y-5">
        <p className="text-gray-600 text-lg font-medium">¡La orden está autorizada! Registra el kilometraje de salida.</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kilometraje actual del vehículo *</label>
          <input
            type="number" inputMode="numeric" value={kmSalida}
            onChange={(e) => setKmSalida(e.target.value)}
            placeholder="Ej: 45230"
            className="w-full border rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button onClick={registrarSalida} disabled={loading}
          className="w-full bg-green-600 text-white py-4 rounded-xl text-lg font-bold hover:bg-green-700 disabled:opacity-50 transition-colors">
          {loading ? "Registrando..." : "✓ Registrar Salida"}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-green-50 rounded-lg p-4 flex items-center gap-3">
        <span className="text-2xl">🚗</span>
        <div>
          <p className="font-semibold text-green-800">Vehículo en viaje</p>
          <p className="text-green-700 text-sm">Km salida: {bitacora.kmSalida.toLocaleString()} km</p>
        </div>
      </div>

      {/* Paradas registradas */}
      <div>
        <p className="font-medium text-gray-700 mb-3">Paradas del viaje</p>
        {bitacora.paradas.length > 0 && (
          <div className="space-y-2 mb-4">
            {bitacora.paradas.map((p) => (
              <div key={p.id} className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800">{p.km.toLocaleString()} km</span>
                    {p.descripcion && <span className="text-gray-500 ml-2">— {p.descripcion}</span>}
                    {p.litros && (
                      <span className="ml-2 text-blue-600 text-xs font-medium">
                        ⛽ {p.litros} L{p.comprobanteRef ? ` · ${p.comprobanteRef}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-gray-400 text-xs">{fmtFecha(p.fecha)}</span>
                    <button
                      onClick={async () => {
                        if (!confirm("¿Eliminar esta parada?")) return
                        const res = await fetch(`/api/flota/solicitudes/${solicitudId}/bitacora/parada`, {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ paradaId: p.id }),
                        })
                        if (res.ok) onDone()
                      }}
                      className="text-red-400 hover:text-red-600"
                    >✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Formulario nueva parada */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Registrar parada</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Km actual *</label>
              <input type="number" inputMode="numeric" value={paradaForm.km}
                onChange={(e) => setParadaForm((f) => ({ ...f, km: e.target.value }))}
                placeholder={String(bitacora.kmSalida + 1)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Motivo (opcional)</label>
              <input value={paradaForm.descripcion}
                onChange={(e) => setParadaForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder="Ej: Almuerzo, gestión, etc."
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={mostrarCombustible}
              onChange={(e) => setMostrarCombustible(e.target.checked)}
              className="accent-blue-600 w-4 h-4" />
            <span className="text-sm text-gray-600">⛽ Incluir carga de combustible</span>
          </label>

          {mostrarCombustible && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Litros *</label>
                <input type="number" inputMode="decimal" value={paradaForm.litros}
                  onChange={(e) => setParadaForm((f) => ({ ...f, litros: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">N° comprobante</label>
                <input value={paradaForm.comprobanteRef}
                  onChange={(e) => setParadaForm((f) => ({ ...f, comprobanteRef: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
          )}

          <button onClick={agregarParada} disabled={loading}
            className="w-full bg-gray-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
            + Agregar parada
          </button>
        </div>
      </div>

      {/* Km llegada */}
      <div className="border-t pt-5">
        <p className="font-medium text-gray-700 mb-3">Registrar llegada</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Km de llegada *</label>
            <input type="number" inputMode="numeric" value={kmLlegada}
              onChange={(e) => setKmLlegada(e.target.value)}
              placeholder={String(bitacora.kmSalida + 1)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hora retorno real</label>
            <input type="datetime-local" value={horaRetorno}
              onChange={(e) => setHoraRetorno(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">Observaciones del viaje</label>
          <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)}
            rows={2} placeholder="Novedades, incidentes, etc."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
        <button onClick={registrarLlegada} disabled={loading}
          className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-base font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {loading ? "Cerrando proceso..." : "🔒 Registrar llegada y cerrar proceso"}
        </button>
      </div>
    </div>
  )
}

function PasoCierre({ solicitudId, bitacora, onDone }: {
  solicitudId: number
  bitacora: NonNullable<Solicitud["bitacora"]>
  onDone: () => void
}) {
  const [obs, setObs] = useState(bitacora.observacion ?? "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const kmRecorridos = (bitacora.kmLlegada ?? 0) - bitacora.kmSalida
  const totalLitros = bitacora.paradas.reduce((s, p) => s + (p.litros ?? 0), 0)

  const handleCierre = async () => {
    if (!confirm("¿Cerrar el proceso? Esta acción es irreversible y no podrá modificarse.")) return
    setLoading(true)
    const res = await fetch(`/api/flota/solicitudes/${solicitudId}/cerrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ observacionHojaVida: obs }),
    })
    setLoading(false)
    if (!res.ok) { const d = await res.json(); setError(d.error); return }
    onDone()
  }

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 rounded-xl p-5 space-y-3">
        <p className="font-semibold text-gray-800 mb-2">Resumen del viaje</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-800">{kmRecorridos.toLocaleString()}</p>
            <p className="text-gray-500 text-xs">km recorridos</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-800">{totalLitros > 0 ? totalLitros.toFixed(1) : "—"}</p>
            <p className="text-gray-500 text-xs">litros cargados</p>
          </div>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Observación para hoja de vida del vehículo
        </label>
        <textarea value={obs} onChange={(e) => setObs(e.target.value)}
          rows={3} placeholder="Sin novedades / descripción del viaje"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button onClick={handleCierre} disabled={loading}
        className="w-full bg-green-600 text-white py-4 rounded-xl text-lg font-bold hover:bg-green-700 disabled:opacity-50 transition-colors">
        {loading ? "Cerrando..." : "🔒 Cerrar Proceso"}
      </button>
      <p className="text-xs text-gray-400 text-center">
        Una vez cerrado el proceso no podrá ser modificado.
      </p>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────

export default function SolicitudDetallePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null)
  const [cargando, setCargando] = useState(true)
  const [motivoRechazo, setMotivoRechazo] = useState("")
  const [loadingAction, setLoadingAction] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const cargar = useCallback(() => {
    if (!session) return
    fetch(`/api/flota/solicitudes/${id}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((d) => { setSolicitud(d); setCargando(false) })
      .catch(() => { setCargando(false) })
  }, [session, id])

  useEffect(() => { cargar() }, [cargar])

  const aprobar = async () => {
    setLoadingAction(true)
    const res = await fetch(`/api/flota/solicitudes/${id}/aprobar`, { method: "POST" })
    setLoadingAction(false)
    if (res.ok) cargar()
  }

  const rechazar = async () => {
    if (!motivoRechazo.trim()) return
    setLoadingAction(true)
    const res = await fetch(`/api/flota/solicitudes/${id}/rechazar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo: motivoRechazo }),
    })
    setLoadingAction(false)
    if (res.ok) cargar()
  }

  const firmarOrden = async () => {
    setLoadingAction(true)
    const res = await fetch(`/api/flota/solicitudes/${id}/orden/firmar`, { method: "POST" })
    setLoadingAction(false)
    if (res.ok) cargar()
  }

  const role = session?.user?.role

  if (cargando) return <Layout titulo="Solicitud"><div className="text-gray-400 p-8">Cargando...</div></Layout>
  if (!solicitud) return <Layout titulo="Solicitud"><div className="text-gray-400 p-8">No encontrado</div></Layout>

  const paso = getPaso(solicitud)

  // Stepper visual — 5 bloques
  const VISUAL = [
    { label: "Checklist" },
    { label: "Orden de Servicio" },
    { label: "Pre-salida" },
    { label: "En viaje" },
    { label: "Cierre" },
  ]

  const pasoVisual = solicitud.estado === "RECHAZADA" ? -1
    : paso === 1 ? 0
    : paso <= 3 ? 1
    : paso === 4 ? 2
    : paso === 5 ? 3
    : 4

  return (
    <Layout titulo={`Solicitud #${solicitud.id} — ${solicitud.vehiculo.patente}`}>

      {/* Stepper */}
      {solicitud.estado !== "RECHAZADA" && (
        <div className="flex items-center mb-8 overflow-x-auto pb-2">
          {VISUAL.map((v, i) => {
            const activo = i === pasoVisual
            const completo = i < pasoVisual
            return (
              <div key={v.label} className="flex items-center shrink-0">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activo ? "bg-blue-600 text-white" : completo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                  {completo ? "✓ " : ""}{v.label}
                </div>
                {i < VISUAL.length - 1 && (
                  <div className={`h-0.5 w-6 mx-1 ${i < pasoVisual ? "bg-green-400" : "bg-gray-200"}`} />
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Columna izquierda: datos de la solicitud */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-xs text-gray-400 uppercase font-semibold mb-3">Datos de la solicitud</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Vehículo</span>
                <span className="font-mono font-bold">{solicitud.vehiculo.patente}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Conductor</span>
                <span className="text-gray-700">{solicitud.conductorNombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Destino</span>
                <span className="text-gray-700 font-medium">{solicitud.destino}</span>
              </div>
              <div>
                <span className="text-gray-500">Propósito</span>
                <p className="text-gray-700 mt-1">{solicitud.proposito}</p>
              </div>
              <div className="flex justify-between pt-1 border-t">
                <span className="text-gray-500">Solicitado</span>
                <span className="text-gray-500">{fmtFecha(solicitud.fechaSolicitud)}</span>
              </div>
              {solicitud.aprobadoPor && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Aprobado por</span>
                  <span className="text-gray-700">{solicitud.aprobadoPor.name}</span>
                </div>
              )}
              {solicitud.ordenServicio?.firmada && (
                <div className="flex justify-between">
                  <span className="text-gray-500">OS firmada por</span>
                  <span className="text-gray-700">{solicitud.ordenServicio.firmadaPor?.name}</span>
                </div>
              )}
              {solicitud.bitacora && (
                <>
                  <div className="flex justify-between pt-1 border-t">
                    <span className="text-gray-500">Km salida</span>
                    <span className="text-gray-700">{solicitud.bitacora.kmSalida.toLocaleString()}</span>
                  </div>
                  {solicitud.bitacora.kmLlegada && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Km llegada</span>
                      <span className="text-gray-700">{solicitud.bitacora.kmLlegada.toLocaleString()}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Columna derecha: acción del paso actual */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm p-6">

            {/* RECHAZADA */}
            {solicitud.estado === "RECHAZADA" && (
              <div className="text-center py-6">
                <p className="text-4xl mb-3">❌</p>
                <p className="text-xl font-semibold text-red-600 mb-2">Solicitud rechazada</p>
                {solicitud.motivoRechazo && <p className="text-gray-500">Motivo: {solicitud.motivoRechazo}</p>}
                <a href="/flota/solicitudes/nueva" className="mt-4 inline-block bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700">
                  Crear nueva solicitud
                </a>
              </div>
            )}

            {/* PASO 1: Checklist (conductor, inmediatamente tras crear) */}
            {paso === 1 && (
              <PasoChecklist
                solicitudId={solicitud.id}
                vehiculo={solicitud.vehiculo}
                fotosIniciales={solicitud.fotosRevision}
                onDone={cargar}
              />
            )}

            {/* PASO 2: Generar OS (conductor) */}
            {paso === 2 && <PasoOrden solicitudId={solicitud.id} onDone={cargar} />}

            {/* PASO 3: Encargado/Admin autoriza OS */}
            {paso === 3 && (
              <div>
                {(role === "ADMIN" || role === "ENCARGADO") ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="font-semibold text-gray-800 text-lg">Orden de Servicio para autorizar</p>
                      <button onClick={() => generarPDFOrden(solicitud)}
                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors">
                        📄 Descargar PDF
                      </button>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
                      <div className="flex justify-between"><span className="text-gray-500">Conductor</span><span>{solicitud.conductorNombre}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Vehículo</span><span className="font-mono font-bold">{solicitud.vehiculo.patente}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Destino</span><span>{solicitud.destino}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Salida estimada</span>
                        <span>{solicitud.ordenServicio?.horaSalidaEst ? fmt(solicitud.ordenServicio.horaSalidaEst) : "—"}</span>
                      </div>
                      {solicitud.ordenServicio?.folioFedoks && (
                        <div className="flex justify-between"><span className="text-gray-500">Folio FEDOKS</span><span className="font-mono">{solicitud.ordenServicio.folioFedoks}</span></div>
                      )}
                    </div>
                    <button onClick={firmarOrden} disabled={loadingAction}
                      className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-base font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      {loadingAction ? "Procesando..." : "✅ Autorizar Orden de Servicio"}
                    </button>
                    <div className="border-t pt-3">
                      <input value={motivoRechazo} onChange={(e) => setMotivoRechazo(e.target.value)}
                        placeholder="Motivo de rechazo (si corresponde)..."
                        className="w-full border rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-red-300" />
                      <button onClick={rechazar} disabled={loadingAction || !motivoRechazo.trim()}
                        className="w-full bg-red-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors">
                        Rechazar solicitud
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-4xl mb-3">✍️</p>
                    <p className="text-xl font-semibold text-gray-700">Esperando autorización</p>
                    <p className="text-gray-400 mt-2 mb-5">El encargado de vehículos debe autorizar la orden de servicio.</p>
                    <button onClick={() => generarPDFOrden(solicitud)}
                      className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                      📄 Descargar PDF para FEDOKS
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* PASO 4: Registrar km salida (OS autorizada) */}
            {paso === 4 && <PasoBitacora solicitudId={solicitud.id} bitacora={null} onDone={cargar} />}

            {/* PASO 5: En viaje — paradas + km llegada + cierre automático */}
            {paso === 5 && solicitud.bitacora && (
              <PasoBitacora solicitudId={solicitud.id} bitacora={solicitud.bitacora} onDone={cargar} />
            )}

            {/* PASO 6: Cerrada */}
            {paso === 6 && (
              <div className="text-center py-8">
                <p className="text-4xl mb-3">🔒</p>
                <p className="text-xl font-semibold text-gray-700">Proceso cerrado</p>
                <p className="text-gray-400 mt-1">
                  Cerrado el {solicitud.fechaCierre ? fmtFecha(solicitud.fechaCierre) : "—"}
                  {solicitud.cerradoPor && ` por ${solicitud.cerradoPor.name}`}
                </p>
                {solicitud.bitacora && (
                  <div className="grid grid-cols-2 gap-3 mt-5 max-w-xs mx-auto">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-gray-800">
                        {((solicitud.bitacora.kmLlegada ?? 0) - solicitud.bitacora.kmSalida).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">km recorridos</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-gray-800">
                        {solicitud.bitacora.paradas.reduce((s, p) => s + (p.litros ?? 0), 0).toFixed(1)}
                      </p>
                      <p className="text-xs text-gray-500">litros cargados</p>
                    </div>
                  </div>
                )}
              </div>
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