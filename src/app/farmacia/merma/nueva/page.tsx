"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import jsPDF from "jspdf"
import Layout from "@/components/Layout"

interface Medicamento {
  id: number
  codigo: string
  nombreGenerico: string
  concentracion: string | null
  formaFarmaceutica: string
  unidad: string
  stockActual: number
  categoria: { nombre: string }
}

interface ItemMerma {
  medicamentoId: number
  codigo: string
  nombre: string
  unidad: string
  stockAntes: number
  cantidad: number
  observacion: string
}

interface Firmante {
  id: number
  name: string
}

const MOTIVOS = [
  { value: "VENCIMIENTO", label: "Vencimiento / Caducidad" },
  { value: "DAÑO", label: "Daño / Deterioro" },
  { value: "PERDIDA", label: "Pérdida / Robo" },
  { value: "USO_INTERNO", label: "Uso interno" },
  { value: "OTRO", label: "Otro" },
]

export default function NuevaMermaFarmaciaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])
  const [firmantes, setFirmantes] = useState<Firmante[]>([])
  const [loading, setLoading] = useState(true)

  const [items, setItems] = useState<ItemMerma[]>([])
  const [motivo, setMotivo] = useState("")
  const [observaciones, setObservaciones] = useState("")
  const [jefeId, setJefeId] = useState("")
  const [jefeNombre, setJefeNombre] = useState("")

  const [busqMed, setBusqMed] = useState("")
  const [cantInput, setCantInput] = useState("1")
  const [obsItemInput, setObsItemInput] = useState("")
  const [medSeleccionado, setMedSeleccionado] = useState<Medicamento | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([
      fetch("/api/farmacia/medicamentos").then(r => r.json()),
      fetch("/api/usuarios/firmantes").then(r => r.json()),
    ]).then(([meds, firms]) => {
      setMedicamentos(meds)
      setFirmantes(firms)
      setLoading(false)
    })
  }, [])

  const nombreMed = (m: Medicamento) =>
    m.concentracion ? `${m.nombreGenerico} ${m.concentracion}` : m.nombreGenerico

  const medFiltrados = busqMed.length >= 1
    ? medicamentos.filter(m =>
        nombreMed(m).toLowerCase().includes(busqMed.toLowerCase()) ||
        m.codigo.toLowerCase().includes(busqMed.toLowerCase())
      ).slice(0, 8)
    : []

  const yaAgregado = (id: number) => items.some(i => i.medicamentoId === id)

  const agregarItem = () => {
    if (!medSeleccionado) return
    const cant = parseInt(cantInput)
    if (isNaN(cant) || cant <= 0) { setError("La cantidad debe ser mayor a 0"); return }
    if (cant > medSeleccionado.stockActual) {
      setError(`No se puede dar de baja más que el stock actual (${medSeleccionado.stockActual})`)
      return
    }
    setItems(prev => [...prev, {
      medicamentoId: medSeleccionado.id,
      codigo: medSeleccionado.codigo,
      nombre: nombreMed(medSeleccionado),
      unidad: medSeleccionado.unidad,
      stockAntes: medSeleccionado.stockActual,
      cantidad: cant,
      observacion: obsItemInput,
    }])
    setMedSeleccionado(null); setBusqMed(""); setCantInput("1"); setObsItemInput(""); setError("")
  }

  const quitarItem = (medicamentoId: number) =>
    setItems(prev => prev.filter(i => i.medicamentoId !== medicamentoId))

  const jefeSeleccionado = firmantes.find(f => String(f.id) === jefeId)

  const handleJefeInput = (val: string) => {
    setJefeNombre(val)
    const match = firmantes.find(f => f.name === val)
    setJefeId(match ? String(match.id) : "")
  }

  function buildPDF(): string {
    const doc = new jsPDF()
    const M = 15, PW = 180
    let y = M + 3

    doc.setFontSize(9); doc.setTextColor(100)
    doc.text("Municipalidad de Ollagüe — Sistema IMO", M, y)
    y += 7
    doc.setFontSize(13); doc.setTextColor(0); doc.setFont("helvetica", "bold")
    doc.text("ACTA DE MERMA / PÉRDIDA — FARMACIA POSTA RURAL", M, y)
    y += 6
    doc.setDrawColor(180); doc.line(M, y, M + PW, y)
    y += 7

    const now = new Date()
    const motivoLabel = MOTIVOS.find(m => m.value === motivo)?.label ?? motivo
    doc.setFont("helvetica", "normal"); doc.setFontSize(9)
    doc.text(`Fecha: ${now.toLocaleDateString("es-CL")}   Hora: ${now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} hrs`, M, y)
    y += 5
    doc.text(`Responsable: ${session?.user?.name ?? "—"}`, M, y)
    if (jefeSeleccionado) doc.text(`Jefe autorizador: ${jefeSeleccionado.name}`, M + 90, y)
    y += 5
    doc.setFont("helvetica", "bold")
    doc.text(`Motivo: ${motivoLabel}`, M, y)
    y += 5
    if (observaciones) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(8)
      doc.text(`Observaciones: ${observaciones}`, M, y)
      y += 5
    }
    y += 3

    type Col = { x: number; label: string }
    const COLS: Col[] = [
      { x: M,       label: "Codigo"     },
      { x: M + 22,  label: "Nombre"     },
      { x: M + 90,  label: "Unidad"     },
      { x: M + 107, label: "Stk.Actual" },
      { x: M + 128, label: "Cantidad"   },
      { x: M + 148, label: "Stk.Final"  },
    ]

    const drawHeader = (yH: number) => {
      doc.setFillColor(22, 101, 52)
      doc.rect(M, yH - 4, PW, 7, "F")
      doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(7)
      for (const c of COLS) doc.text(c.label, c.x, yH)
    }

    drawHeader(y); y += 5

    let rowIdx = 0
    for (const item of items) {
      if (y > 265) { doc.addPage(); y = 18; drawHeader(y); y += 5 }
      if (rowIdx % 2 === 1) {
        doc.setFillColor(240, 253, 244)
        doc.rect(M, y - 4, PW, 5.5, "F")
      }
      doc.setTextColor(30, 80, 30); doc.setFont("helvetica", "normal"); doc.setFontSize(7)
      doc.text(item.codigo.slice(0, 12), COLS[0].x, y)
      doc.text(item.nombre.slice(0, 36), COLS[1].x, y)
      doc.text(item.unidad.slice(0, 8), COLS[2].x, y)
      doc.text(String(item.stockAntes), COLS[3].x, y)
      doc.text(String(item.cantidad), COLS[4].x, y)
      doc.text(String(item.stockAntes - item.cantidad), COLS[5].x, y)
      if (item.observacion) {
        y += 4; doc.setTextColor(130); doc.setFontSize(6.5)
        doc.text(`  Obs: ${item.observacion}`, M, y)
      }
      y += 5.5; rowIdx++
    }

    y += 10
    if (y > 240) { doc.addPage(); y = 30 }
    doc.setTextColor(0); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setDrawColor(130)
    doc.line(M, y, M + 75, y); y += 5
    doc.text("Responsable de Farmacia", M, y); y += 4
    doc.setFontSize(7.5); doc.setTextColor(100)
    doc.text(`Firmado digitalmente: ${session?.user?.name ?? ""}`, M, y); y += 4
    doc.text("Firma Electronica Simple — Ley N° 19.799 de 2002", M, y)

    if (jefeSeleccionado) {
      doc.setTextColor(0); doc.setFontSize(8)
      const xJ = M + 100, yJ = y - 13
      doc.line(xJ, yJ, xJ + 75, yJ)
      doc.text(`Jefe / Subrogante: ${jefeSeleccionado.name}`, xJ, yJ + 5)
      doc.setTextColor(100); doc.setFontSize(7.5)
      doc.text("Firma Electronica Simple — Ley N° 19.799 de 2002", xJ, yJ + 9)
    }

    return doc.output("datauristring").split(",")[1]
  }

  const handleSubmit = async () => {
    if (!items.length) { setError("Agrega al menos un medicamento"); return }
    if (!motivo) { setError("Selecciona el motivo de merma"); return }
    if (!jefeSeleccionado) { setError("Selecciona el jefe que autorizará la baja"); return }
    setSubmitting(true); setError("")
    const pdfBase64 = buildPDF()
    const res = await fetch("/api/farmacia/merma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map(i => ({
          medicamentoId: i.medicamentoId, nombre: i.nombre, codigo: i.codigo,
          unidad: i.unidad, cantidad: i.cantidad, stockAntes: i.stockAntes,
          observacion: i.observacion || undefined,
        })),
        jefeId: parseInt(jefeId), motivo,
        observaciones: observaciones || undefined,
        pdfBase64,
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (res.ok) router.push(`/farmacia?mermaId=${data.actaId}`)
    else setError(data.error || "Error al registrar el acta")
  }

  if (loading) {
    return <Layout titulo="Acta de Merma — Farmacia"><p className="text-gray-500 text-sm">Cargando...</p></Layout>
  }

  return (
    <Layout titulo="Acta de Merma / Pérdida — Farmacia Posta Rural">
      <div className="mb-6">
        <a href="/farmacia" className="text-sm text-green-600 hover:underline">&larr; Volver a Farmacia</a>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Registra los medicamentos que serán dados de baja por merma o pérdida. El acta requiere siempre la autorización del jefe.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de la merma <span className="text-red-500">*</span></label>
          <select
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <option value="">Selecciona un motivo...</option>
            {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Jefe autorizador <span className="text-red-500">*</span></label>
          <input
            list="lista-jefes-merma-farmacia"
            value={jefeNombre}
            onChange={e => handleJefeInput(e.target.value)}
            placeholder="Escribe o selecciona un nombre..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <datalist id="lista-jefes-merma-farmacia">
            {firmantes.map(f => <option key={f.id} value={f.name} />)}
          </datalist>
          {jefeNombre && !jefeSeleccionado && (
            <p className="text-xs text-red-600 mt-1">Nombre no encontrado. Verifica que el usuario tenga RUT configurado.</p>
          )}
        </div>
      </div>

      {/* Agregar medicamento */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-5">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Agregar medicamento a dar de baja</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48 relative">
            <label className="block text-xs text-gray-500 mb-1">Medicamento</label>
            <input
              type="text"
              value={medSeleccionado ? `${medSeleccionado.codigo} — ${nombreMed(medSeleccionado)}` : busqMed}
              onChange={e => { setMedSeleccionado(null); setBusqMed(e.target.value) }}
              placeholder="Buscar por nombre o código..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            {!medSeleccionado && medFiltrados.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                {medFiltrados.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={yaAgregado(m.id)}
                    onClick={() => { setMedSeleccionado(m); setBusqMed("") }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="font-mono text-gray-500 text-xs">{m.codigo}</span>
                    {" — "}
                    <span className="font-medium">{nombreMed(m)}</span>
                    <span className="text-gray-400 text-xs ml-1">(stock: {m.stockActual} {m.unidad})</span>
                    {yaAgregado(m.id) && <span className="text-xs text-green-500 ml-1">ya agregado</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="w-24">
            <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
            <input
              type="number" min={1}
              value={cantInput}
              onChange={e => setCantInput(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div className="flex-1 min-w-32">
            <label className="block text-xs text-gray-500 mb-1">Observación del item (opcional)</label>
            <input
              type="text"
              value={obsItemInput}
              onChange={e => setObsItemInput(e.target.value)}
              placeholder="Ej: lote vencido 01/2026"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <button
            type="button"
            onClick={agregarItem}
            disabled={!medSeleccionado}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            Agregar
          </button>
        </div>
        {medSeleccionado && (
          <p className="text-xs text-gray-500 mt-2">
            Stock actual: <span className="font-semibold">{medSeleccionado.stockActual} {medSeleccionado.unidad}</span>
          </p>
        )}
      </div>

      {items.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden mb-5">
          <table className="w-full text-sm">
            <thead className="bg-red-50 border-b border-red-100">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Codigo</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Unidad</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Stock actual</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Dar de baja</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Stock final</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Observación</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr key={item.medicamentoId} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-gray-500 text-xs">{item.codigo}</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{item.nombre}</td>
                  <td className="px-4 py-2 text-gray-500">{item.unidad}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{item.stockAntes}</td>
                  <td className="px-4 py-2 text-right font-semibold text-red-600">-{item.cantidad}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-800">{item.stockAntes - item.cantidad}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{item.observacion || "—"}</td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => quitarItem(item.medicamentoId)} className="text-red-500 hover:text-red-700 text-xs">Quitar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!items.length && (
        <p className="text-gray-400 text-sm text-center py-8 border border-dashed border-gray-200 rounded-lg mb-5">
          Aún no has agregado medicamentos. Usa el buscador de arriba.
        </p>
      )}

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones generales (opcional)</label>
        <textarea
          value={observaciones}
          onChange={e => setObservaciones(e.target.value)}
          rows={3}
          placeholder="Contexto adicional sobre la merma..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        />
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={submitting || !items.length || !motivo || !jefeSeleccionado}
          className="bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Firmando acta..." : "Firmar y enviar a jefe para autorización"}
        </button>
        <a href="/farmacia"
          className="bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          Cancelar
        </a>
      </div>
    </Layout>
  )
}
