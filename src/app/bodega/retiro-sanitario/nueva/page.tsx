"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import jsPDF from "jspdf"
import Layout from "@/components/Layout"

interface Producto {
  id: number
  codigo: string
  nombre: string
  unidad: string
  stockActual: number
  categoria: { nombre: string }
}

interface ItemRetiro {
  productoId: number
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

export default function NuevaRetiroBodegaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const [productos, setProductos] = useState<Producto[]>([])
  const [firmantes, setFirmantes] = useState<Firmante[]>([])
  const [loading, setLoading] = useState(true)

  const [items, setItems] = useState<ItemRetiro[]>([])
  const [causa, setCausa] = useState("")
  const [destino, setDestino] = useState("")
  const [referenciaOficial, setReferenciaOficial] = useState("")
  const [observaciones, setObservaciones] = useState("")
  const [jefeId, setJefeId] = useState("")
  const [jefeNombre, setJefeNombre] = useState("")

  const [busqProd, setBusqProd] = useState("")
  const [prodSel, setProdSel] = useState<Producto | null>(null)
  const [loteInput, setLoteInput] = useState("")
  const [vencInput, setVencInput] = useState("")
  const [cantInput, setCantInput] = useState("1")
  const [obsItemInput, setObsItemInput] = useState("")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([
      fetch("/api/bodega/productos").then(r => r.json()),
      fetch("/api/usuarios/firmantes").then(r => r.json()),
    ]).then(([prods, firms]) => { setProductos(prods); setFirmantes(firms); setLoading(false) })
  }, [])

  const prodsFiltrados = busqProd.length >= 1
    ? productos.filter(p =>
        p.nombre.toLowerCase().includes(busqProd.toLowerCase()) ||
        p.codigo.toLowerCase().includes(busqProd.toLowerCase())
      ).slice(0, 8)
    : []

  const yaAgregado = (id: number) => items.some(i => i.productoId === id)

  const agregarItem = () => {
    if (!prodSel) return
    const cant = parseInt(cantInput)
    if (isNaN(cant) || cant <= 0) { setError("La cantidad debe ser mayor a 0"); return }
    if (cant > prodSel.stockActual) {
      setError(`No se puede retirar más que el stock actual (${prodSel.stockActual})`); return
    }
    setItems(prev => [...prev, {
      productoId: prodSel.id, codigo: prodSel.codigo, nombre: prodSel.nombre,
      unidad: prodSel.unidad, stockAntes: prodSel.stockActual,
      lote: loteInput, fechaVencimiento: vencInput,
      cantidad: cant, observacion: obsItemInput,
    }])
    setProdSel(null); setBusqProd(""); setLoteInput(""); setVencInput("")
    setCantInput("1"); setObsItemInput(""); setError("")
  }

  const quitarItem = (id: number) => setItems(prev => prev.filter(i => i.productoId !== id))

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
    doc.text("ACTA DE RETIRO SANITARIO — BODEGA MUNICIPAL", M, y); y += 6
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
    if (referenciaOficial) {
      doc.text(`Referencia oficial: ${referenciaOficial}`, M, y); y += 5
    }
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
    doc.text("Responsable de Bodega", M, y); y += 4
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
    if (!items.length) { setError("Agrega al menos un producto"); return }
    if (!causa) { setError("Selecciona la causa del retiro"); return }
    if (!destino) { setError("Selecciona el destino de los productos retirados"); return }
    if (!jefeSeleccionado) { setError("Selecciona el jefe que autorizará el retiro"); return }
    setSubmitting(true); setError("")
    const res = await fetch("/api/bodega/retiro-sanitario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map(i => ({
          productoId: i.productoId, nombre: i.nombre, codigo: i.codigo, unidad: i.unidad,
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
    if (res.ok) router.push(`/bodega?retiroId=${data.actaId}`)
    else setError(data.error || "Error al registrar el acta")
  }

  if (loading) return <Layout titulo="Retiro Sanitario — Bodega"><p className="text-gray-500 text-sm">Cargando...</p></Layout>

  return (
    <Layout titulo="Acta de Retiro Sanitario — Bodega Municipal">
      <div className="mb-6">
        <a href="/bodega" className="text-sm text-blue-600 hover:underline">&larr; Volver a Bodega</a>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-6 text-sm text-orange-800">
        Documento formal para retiro de productos por razones sanitarias o regulatorias. Requiere autorización del jefe y genera trazabilidad completa.
      </div>

      {/* Datos del retiro */}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Destino de los productos <span className="text-red-500">*</span></label>
          <select value={destino} onChange={e => setDestino(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option value="">Selecciona un destino...</option>
            {DESTINOS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Referencia oficial (N° resolución, oficio, alerta)</label>
          <input type="text" value={referenciaOficial} onChange={e => setReferenciaOficial(e.target.value)}
            placeholder="Ej: Alerta ISP N°123/2026"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Jefe autorizador <span className="text-red-500">*</span></label>
          <input list="lista-jefes-retiro" value={jefeNombre} onChange={e => handleJefeInput(e.target.value)}
            placeholder="Escribe o selecciona un nombre..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          <datalist id="lista-jefes-retiro">
            {firmantes.map(f => <option key={f.id} value={f.name} />)}
          </datalist>
          {jefeNombre && !jefeSeleccionado && (
            <p className="text-xs text-red-600 mt-1">Nombre no encontrado. Verifica que el usuario tenga RUT configurado.</p>
          )}
        </div>
      </div>

      {/* Agregar producto */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-5">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Agregar producto a retirar</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48 relative">
            <label className="block text-xs text-gray-500 mb-1">Producto</label>
            <input type="text"
              value={prodSel ? `${prodSel.codigo} — ${prodSel.nombre}` : busqProd}
              onChange={e => { setProdSel(null); setBusqProd(e.target.value) }}
              placeholder="Buscar por nombre o código..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            {!prodSel && prodsFiltrados.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                {prodsFiltrados.map(p => (
                  <button key={p.id} type="button" disabled={yaAgregado(p.id)}
                    onClick={() => { setProdSel(p); setBusqProd("") }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                    <span className="font-mono text-gray-500 text-xs">{p.codigo}</span>{" — "}
                    <span className="font-medium">{p.nombre}</span>
                    <span className="text-gray-400 text-xs ml-1">(stock: {p.stockActual} {p.unidad})</span>
                    {yaAgregado(p.id) && <span className="text-xs text-orange-500 ml-1">ya agregado</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="w-32">
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
          <button type="button" onClick={agregarItem} disabled={!prodSel}
            className="bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-800 disabled:opacity-40 transition-colors">
            Agregar
          </button>
        </div>
        {prodSel && (
          <p className="text-xs text-gray-500 mt-2">Stock actual: <span className="font-semibold">{prodSel.stockActual} {prodSel.unidad}</span></p>
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
              {items.map(item => (
                <tr key={item.productoId} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-gray-500 text-xs">{item.codigo}</td>
                  <td className="px-3 py-2 font-medium text-gray-800">{item.nombre}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{item.lote || "—"}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">
                    {item.fechaVencimiento ? new Date(item.fechaVencimiento).toLocaleDateString("es-CL") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">{item.stockAntes}</td>
                  <td className="px-3 py-2 text-right font-semibold text-orange-700">-{item.cantidad}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{item.observacion || "—"}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => quitarItem(item.productoId)} className="text-red-500 hover:text-red-700 text-xs">Quitar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-400 text-sm text-center py-8 border border-dashed border-gray-200 rounded-lg mb-5">
          Aún no has agregado productos. Usa el buscador de arriba.
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
        <a href="/bodega" className="bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          Cancelar
        </a>
      </div>
    </Layout>
  )
}
