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
  unidad: string
  stockActual: number
}

interface LoteFarmacia {
  id: number
  medicamentoId: number
  numeroLote: string
  fechaVencimiento: string | null
  stockActual: number
}

interface ItemRetiro {
  medicamentoId: number
  codigo: string
  nombre: string
  unidad: string
  stockAntes: number
  lote: string
  fechaVencimiento: string
  cantidad: number
  observacion: string
}

interface Firmante { id: number; name: string }

const CAUSAS = [
  { value: "ALERTA_ISP", label: "Alerta sanitaria ISP" },
  { value: "CONTAMINACION", label: "Contaminación sospechada" },
  { value: "DEFECTO_FABRICACION", label: "Defecto de fabricación" },
  { value: "ORDEN_AUTORIDAD", label: "Orden de autoridad sanitaria" },
  { value: "OTRO", label: "Otro" },
]

const DESTINOS = [
  { value: "DEVOLUCION_PROVEEDOR", label: "Devolución al proveedor" },
  { value: "DESTRUCCION", label: "Destrucción" },
  { value: "CUARENTENA", label: "Cuarentena / retención" },
  { value: "OTRO", label: "Otro" },
]

export default function NuevaRetiroFarmaciaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])
  const [firmantes, setFirmantes] = useState<Firmante[]>([])
  const [loading, setLoading] = useState(true)
  const [lotesMed, setLotesMed] = useState<LoteFarmacia[]>([])

  const [items, setItems] = useState<ItemRetiro[]>([])
  const [causa, setCausa] = useState("")
  const [destino, setDestino] = useState("")
  const [referenciaOficial, setReferenciaOficial] = useState("")
  const [observaciones, setObservaciones] = useState("")
  const [jefeId, setJefeId] = useState("")
  const [jefeNombre, setJefeNombre] = useState("")

  const [busqMed, setBusqMed] = useState("")
  const [medSel, setMedSel] = useState<Medicamento | null>(null)
  const [loteInput, setLoteInput] = useState("")
  const [vencInput, setVencInput] = useState("")
  const [cantInput, setCantInput] = useState("1")
  const [obsItemInput, setObsItemInput] = useState("")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([
      fetch("/api/farmacia/medicamentos").then(r => r.json()),
      fetch("/api/usuarios/firmantes").then(r => r.json()),
    ]).then(([meds, firms]) => { setMedicamentos(meds); setFirmantes(firms); setLoading(false) })
  }, [])

  // Cuando se selecciona un medicamento, carga sus lotes activos
  useEffect(() => {
    if (!medSel) { setLotesMed([]); return }
    fetch(`/api/farmacia/medicamentos/${medSel.id}/lotes`)
      .then(r => r.ok ? r.json() : [])
      .then(setLotesMed)
      .catch(() => setLotesMed([]))
  }, [medSel])

  const nombreMed = (m: Medicamento) =>
    m.concentracion ? `${m.nombreGenerico} ${m.concentracion}` : m.nombreGenerico

  const medsFiltrados = busqMed.length >= 1
    ? medicamentos.filter(m =>
        nombreMed(m).toLowerCase().includes(busqMed.toLowerCase()) ||
        m.codigo.toLowerCase().includes(busqMed.toLowerCase())
      ).slice(0, 8)
    : []

  const yaAgregadoConLote = (medId: number, lote: string) =>
    items.some(i => i.medicamentoId === medId && i.lote === lote)

  const seleccionarLote = (lote: LoteFarmacia) => {
    setLoteInput(lote.numeroLote)
    setVencInput(lote.fechaVencimiento ? lote.fechaVencimiento.split("T")[0] : "")
    setCantInput(String(lote.stockActual))
  }

  const agregarItem = () => {
    if (!medSel) return
    const cant = parseInt(cantInput)
    if (isNaN(cant) || cant <= 0) { setError("La cantidad debe ser mayor a 0"); return }
    if (cant > medSel.stockActual) {
      setError(`No se puede retirar más que el stock actual (${medSel.stockActual})`); return
    }
    if (yaAgregadoConLote(medSel.id, loteInput)) {
      setError("Ya agregaste este medicamento con el mismo lote"); return
    }
    setItems(prev => [...prev, {
      medicamentoId: medSel.id, codigo: medSel.codigo, nombre: nombreMed(medSel),
      unidad: medSel.unidad, stockAntes: medSel.stockActual,
      lote: loteInput, fechaVencimiento: vencInput,
      cantidad: cant, observacion: obsItemInput,
    }])
    setMedSel(null); setBusqMed(""); setLoteInput(""); setVencInput("")
    setCantInput("1"); setObsItemInput(""); setLotesMed([]); setError("")
  }

  const quitarItem = (medId: number, lote: string) =>
    setItems(prev => prev.filter(i => !(i.medicamentoId === medId && i.lote === lote)))

  const jefeSeleccionado = firmantes.find(f => String(f.id) === jefeId)
  const handleJefeInput = (val: string) => {
    setJefeNombre(val)
    const match = firmantes.find(f => f.name === val)
    setJefeId(match ? String(match.id) : "")
  }

  const causaLabel = CAUSAS.find(c => c.value === causa)?.label ?? causa
  const destinoLabel = DESTINOS.find(d => d.value === destino)?.label ?? destino

  function buildPDF(): string {
    const doc = new jsPDF()
    const M = 15, PW = 180
    let y = M + 3

    doc.setFontSize(9); doc.setTextColor(100)
    doc.text("Municipalidad de Ollagüe — Sistema IMO", M, y); y += 7
    doc.setFontSize(13); doc.setTextColor(0); doc.setFont("helvetica", "bold")
    doc.text("ACTA DE RETIRO SANITARIO — FARMACIA POSTA RURAL", M, y); y += 6
    doc.setDrawColor(180); doc.line(M, y, M + PW, y); y += 7

    const now = new Date()
    doc.setFont("helvetica", "normal"); doc.setFontSize(9)
    doc.text(`Fecha: ${now.toLocaleDateString("es-CL")}   Hora: ${now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} hrs`, M, y); y += 5
    doc.text(`Responsable: ${session?.user?.name ?? "—"}`, M, y)
    if (jefeSeleccionado) doc.text(`Jefe autorizador: ${jefeSeleccionado.name}`, M + 90, y)
    y += 5
    doc.setFont("helvetica", "bold")
    doc.text(`Causa: ${causaLabel}`, M, y)
    doc.text(`Destino: ${destinoLabel}`, M + 90, y); y += 5
    if (referenciaOficial) { doc.text(`Referencia oficial: ${referenciaOficial}`, M, y); y += 5 }
    if (observaciones) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(8)
      doc.text(`Observaciones: ${observaciones}`, M, y); y += 5
    }
    y += 3

    type Col = { x: number; label: string }
    const COLS: Col[] = [
      { x: M,       label: "Codigo"    },
      { x: M + 22,  label: "Nombre"    },
      { x: M + 78,  label: "Lote"      },
      { x: M + 98,  label: "Vencim."   },
      { x: M + 116, label: "Unidad"    },
      { x: M + 130, label: "Stk.Actual"},
      { x: M + 150, label: "Retirado"  },
    ]

    const drawHeader = (yH: number) => {
      doc.setFillColor(120, 53, 15)
      doc.rect(M, yH - 4, PW, 7, "F")
      doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(7)
      for (const c of COLS) doc.text(c.label, c.x, yH)
    }

    drawHeader(y); y += 5
    let rowIdx = 0
    for (const item of items) {
      if (y > 265) { doc.addPage(); y = 18; drawHeader(y); y += 5 }
      if (rowIdx % 2 === 1) {
        doc.setFillColor(254, 247, 237)
        doc.rect(M, y - 4, PW, 5.5, "F")
      }
      doc.setTextColor(60, 20, 0); doc.setFont("helvetica", "normal"); doc.setFontSize(7)
      doc.text(item.codigo.slice(0, 12), COLS[0].x, y)
      doc.text(item.nombre.slice(0, 30), COLS[1].x, y)
      doc.text((item.lote || "—").slice(0, 10), COLS[2].x, y)
      doc.text(item.fechaVencimiento ? new Date(item.fechaVencimiento).toLocaleDateString("es-CL") : "—", COLS[3].x, y)
      doc.text(item.unidad.slice(0, 8), COLS[4].x, y)
      doc.text(String(item.stockAntes), COLS[5].x, y)
      doc.text(String(item.cantidad), COLS[6].x, y)
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
    if (!causa) { setError("Selecciona la causa del retiro"); return }
    if (!destino) { setError("Selecciona el destino de los medicamentos retirados"); return }
    if (!jefeSeleccionado) { setError("Selecciona el jefe que autorizará el retiro"); return }
    setSubmitting(true); setError("")
    const res = await fetch("/api/farmacia/retiro-sanitario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map(i => ({
          medicamentoId: i.medicamentoId, nombre: i.nombre, codigo: i.codigo, unidad: i.unidad,
          lote: i.lote || undefined, fechaVencimiento: i.fechaVencimiento || undefined,
          cantidad: i.cantidad, stockAntes: i.stockAntes, observacion: i.observacion || undefined,
        })),
        jefeId: parseInt(jefeId), causa, destino,
        referenciaOficial: referenciaOficial || undefined,
        observaciones: observaciones || undefined,
        pdfBase64: buildPDF(),
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (res.ok) router.push(`/farmacia?retiroId=${data.actaId}`)
    else setError(data.error || "Error al registrar el acta")
  }

  if (loading) return <Layout titulo="Retiro Sanitario — Farmacia"><p className="text-gray-500 text-sm">Cargando...</p></Layout>

  return (
    <Layout titulo="Acta de Retiro Sanitario — Farmacia Posta Rural">
      <div className="mb-6">
        <a href="/farmacia" className="text-sm text-green-600 hover:underline">&larr; Volver a Farmacia</a>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-6 text-sm text-orange-800">
        Documento formal para retiro de medicamentos por razones sanitarias o regulatorias. Al autorizar, el lote queda registrado como retirado en el sistema de lotes.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Causa del retiro <span className="text-red-500">*</span></label>
          <select value={causa} onChange={e => setCausa(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option value="">Selecciona una causa...</option>
            {CAUSAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Destino de los medicamentos <span className="text-red-500">*</span></label>
          <select value={destino} onChange={e => setDestino(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option value="">Selecciona un destino...</option>
            {DESTINOS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Referencia oficial (N° resolución, oficio, alerta ISP)</label>
          <input type="text" value={referenciaOficial} onChange={e => setReferenciaOficial(e.target.value)}
            placeholder="Ej: Alerta ISP N°123/2026"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Jefe autorizador <span className="text-red-500">*</span></label>
          <input list="lista-jefes-retiro-f" value={jefeNombre} onChange={e => handleJefeInput(e.target.value)}
            placeholder="Escribe o selecciona un nombre..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          <datalist id="lista-jefes-retiro-f">
            {firmantes.map(f => <option key={f.id} value={f.name} />)}
          </datalist>
          {jefeNombre && !jefeSeleccionado && (
            <p className="text-xs text-red-600 mt-1">Nombre no encontrado. Verifica que el usuario tenga RUT configurado.</p>
          )}
        </div>
      </div>

      {/* Agregar medicamento */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-5">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Agregar medicamento a retirar</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48 relative">
            <label className="block text-xs text-gray-500 mb-1">Medicamento</label>
            <input type="text"
              value={medSel ? `${medSel.codigo} — ${nombreMed(medSel)}` : busqMed}
              onChange={e => { setMedSel(null); setBusqMed(e.target.value); setLotesMed([]) }}
              placeholder="Buscar por nombre o código..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            {!medSel && medsFiltrados.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                {medsFiltrados.map(m => (
                  <button key={m.id} type="button"
                    onClick={() => { setMedSel(m); setBusqMed("") }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                    <span className="font-mono text-gray-500 text-xs">{m.codigo}</span>{" — "}
                    <span className="font-medium">{nombreMed(m)}</span>
                    <span className="text-gray-400 text-xs ml-1">(stock: {m.stockActual} {m.unidad})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="w-36">
            <label className="block text-xs text-gray-500 mb-1">N° Lote</label>
            <input type="text" value={loteInput} onChange={e => setLoteInput(e.target.value)}
              placeholder="Ej: L2025-01"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div className="w-36">
            <label className="block text-xs text-gray-500 mb-1">Fecha vencimiento</label>
            <input type="date" value={vencInput} onChange={e => setVencInput(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div className="w-20">
            <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
            <input type="number" min={1} value={cantInput} onChange={e => setCantInput(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div className="flex-1 min-w-28">
            <label className="block text-xs text-gray-500 mb-1">Observación del item</label>
            <input type="text" value={obsItemInput} onChange={e => setObsItemInput(e.target.value)}
              placeholder="Opcional"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <button type="button" onClick={agregarItem} disabled={!medSel}
            className="bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-800 disabled:opacity-40 transition-colors">
            Agregar
          </button>
        </div>
        {/* Lotes disponibles */}
        {medSel && lotesMed.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1">Lotes registrados para este medicamento (clic para autocompletar):</p>
            <div className="flex flex-wrap gap-2">
              {lotesMed.map(l => (
                <button key={l.id} type="button" onClick={() => seleccionarLote(l)}
                  className="text-xs bg-white border border-orange-200 rounded px-2 py-1 hover:bg-orange-50 transition-colors">
                  Lote {l.numeroLote}
                  {l.fechaVencimiento && ` · vence ${new Date(l.fechaVencimiento).toLocaleDateString("es-CL")}`}
                  {` · stock ${l.stockActual}`}
                </button>
              ))}
            </div>
          </div>
        )}
        {medSel && (
          <p className="text-xs text-gray-500 mt-2">Stock total actual: <span className="font-semibold">{medSel.stockActual} {medSel.unidad}</span></p>
        )}
      </div>

      {items.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden mb-5">
          <table className="w-full text-sm">
            <thead className="bg-orange-50 border-b border-orange-100">
              <tr>
                <th className="text-left px-3 py-3 text-gray-600 font-medium">Codigo</th>
                <th className="text-left px-3 py-3 text-gray-600 font-medium">Nombre</th>
                <th className="text-left px-3 py-3 text-gray-600 font-medium">Lote</th>
                <th className="text-left px-3 py-3 text-gray-600 font-medium">Vencimiento</th>
                <th className="text-right px-3 py-3 text-gray-600 font-medium">Stock actual</th>
                <th className="text-right px-3 py-3 text-gray-600 font-medium">Retirar</th>
                <th className="text-left px-3 py-3 text-gray-600 font-medium">Observación</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-gray-500 text-xs">{item.codigo}</td>
                  <td className="px-3 py-2 font-medium text-gray-800">{item.nombre}</td>
                  <td className="px-3 py-2 text-orange-700 font-mono text-xs">{item.lote || "—"}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">
                    {item.fechaVencimiento ? new Date(item.fechaVencimiento).toLocaleDateString("es-CL") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">{item.stockAntes}</td>
                  <td className="px-3 py-2 text-right font-semibold text-orange-700">-{item.cantidad}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{item.observacion || "—"}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => quitarItem(item.medicamentoId, item.lote)}
                      className="text-red-500 hover:text-red-700 text-xs">Quitar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-400 text-sm text-center py-8 border border-dashed border-gray-200 rounded-lg mb-5">
          Aún no has agregado medicamentos. Usa el buscador de arriba.
        </p>
      )}

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones generales (opcional)</label>
        <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3}
          placeholder="Contexto adicional sobre el retiro..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="flex gap-3">
        <button onClick={handleSubmit}
          disabled={submitting || !items.length || !causa || !destino || !jefeSeleccionado}
          className="bg-orange-700 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-800 disabled:opacity-50 transition-colors">
          {submitting ? "Firmando acta..." : "Firmar y enviar a jefe para autorización"}
        </button>
        <a href="/farmacia" className="bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          Cancelar
        </a>
      </div>
    </Layout>
  )
}
