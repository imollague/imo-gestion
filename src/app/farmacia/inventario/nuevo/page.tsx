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

interface ItemConteo {
  medicamentoId: number
  codigo: string
  nombre: string
  unidad: string
  categoria: string
  stockSistema: number
  stockContado: number
}

interface Firmante {
  id: number
  name: string
  role: string
}

export default function NuevoInventarioFarmaciaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const [items, setItems] = useState<ItemConteo[]>([])
  const [loading, setLoading] = useState(true)
  const [firmantes, setFirmantes] = useState<Firmante[]>([])
  const [jefeId, setJefeId] = useState<string>("")
  const [jefeNombre, setJefeNombre] = useState("")
  const [observaciones, setObservaciones] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [busqueda, setBusqueda] = useState("")

  useEffect(() => {
    const fetchData = async () => {
      const [medRes, firmRes] = await Promise.all([
        fetch("/api/farmacia/medicamentos"),
        fetch("/api/usuarios/firmantes"),
      ])
      const medicamentos: Medicamento[] = await medRes.json()
      const firmsData: Firmante[] = await firmRes.json()

      setItems(
        medicamentos.map((m) => ({
          medicamentoId: m.id,
          codigo: m.codigo,
          nombre: m.concentracion
            ? `${m.nombreGenerico} ${m.concentracion}`
            : m.nombreGenerico,
          unidad: m.unidad,
          categoria: m.categoria.nombre,
          stockSistema: m.stockActual,
          stockContado: m.stockActual,
        }))
      )
      setFirmantes(firmsData)
      setLoading(false)
    }
    fetchData()
  }, [])

  const updateContado = (idx: number, valor: string) => {
    const num = parseInt(valor)
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, stockContado: isNaN(num) || num < 0 ? 0 : num } : item
      )
    )
  }

  const itemsFiltrados = items.filter(
    (item) =>
      item.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      item.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
      item.categoria.toLowerCase().includes(busqueda.toLowerCase())
  )

  const tieneDiferencias = items.some((i) => i.stockContado !== i.stockSistema)
  const itemsDif = items.filter((i) => i.stockContado !== i.stockSistema)

  const jefeSeleccionado = firmantes.find((f) => String(f.id) === jefeId)

  function buildPDF(): string {
    const doc = new jsPDF()
    const M = 15
    const PW = 180
    let y = M + 3

    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text("Municipalidad de Ollagüe — Sistema IMO", M, y)
    y += 7
    doc.setFontSize(13)
    doc.setTextColor(0)
    doc.setFont("helvetica", "bold")
    doc.text("ACTA DE INVENTARIO — FARMACIA POSTA RURAL", M, y)
    y += 6
    doc.setDrawColor(180)
    doc.line(M, y, M + PW, y)
    y += 7

    const now = new Date()
    const fecha = now.toLocaleDateString("es-CL")
    const hora = now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.text(`Fecha: ${fecha}   Hora: ${hora} hrs`, M, y)
    y += 5
    doc.text(`Responsable: ${session?.user?.name ?? "—"}`, M, y)
    if (tieneDiferencias && jefeSeleccionado) {
      doc.text(`Jefe autorizador: ${jefeSeleccionado.name}`, M + 90, y)
    }
    y += 5

    doc.setFont("helvetica", "bold")
    const totalItems = items.length
    const sinDif = items.filter((i) => i.stockContado === i.stockSistema).length
    const conDif = itemsDif.length
    doc.text(`Total medicamentos: ${totalItems}   |   Sin diferencia: ${sinDif}   |   Con diferencia: ${conDif}`, M, y)
    y += 5

    if (observaciones) {
      doc.setFont("helvetica", "italic")
      doc.setFontSize(8)
      doc.text(`Observaciones: ${observaciones}`, M, y)
      y += 5
    }
    y += 3

    type Col = { x: number; label: string }
    const COLS: Col[] = [
      { x: M,       label: "Codigo"      },
      { x: M + 22,  label: "Nombre"      },
      { x: M + 82,  label: "Unidad"      },
      { x: M + 97,  label: "Stk.Sistema" },
      { x: M + 119, label: "Stk.Contado" },
      { x: M + 141, label: "Diferencia"  },
    ]

    const drawHeader = (yH: number) => {
      doc.setFillColor(22, 101, 52)
      doc.rect(M, yH - 4, PW, 7, "F")
      doc.setTextColor(255)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(7)
      for (const c of COLS) doc.text(c.label, c.x, yH)
    }

    drawHeader(y)
    y += 5

    let rowIdx = 0
    for (const item of items) {
      if (y > 265) {
        doc.addPage()
        y = 18
        drawHeader(y)
        y += 5
      }
      const dif = item.stockContado - item.stockSistema
      if (rowIdx % 2 === 1) {
        doc.setFillColor(245, 247, 250)
        doc.rect(M, y - 4, PW, 5.5, "F")
      }
      doc.setTextColor(dif !== 0 ? (dif > 0 ? 21 : 185) : 30, dif < 0 ? 28 : 30, 30)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7)
      doc.text(item.codigo.slice(0, 12), COLS[0].x, y)
      doc.text(item.nombre.slice(0, 34), COLS[1].x, y)
      doc.text(item.unidad.slice(0, 8), COLS[2].x, y)
      doc.text(String(item.stockSistema), COLS[3].x, y)
      doc.text(String(item.stockContado), COLS[4].x, y)
      doc.text(dif === 0 ? "—" : (dif > 0 ? "+" : "") + dif, COLS[5].x, y)
      y += 5.5
      rowIdx++
    }

    y += 10
    if (y > 240) { doc.addPage(); y = 30 }
    doc.setTextColor(0)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setDrawColor(130)

    doc.line(M, y, M + 75, y)
    y += 5
    doc.text("Responsable de Farmacia", M, y)
    y += 4
    doc.setFontSize(7.5)
    doc.setTextColor(100)
    doc.text(`Firmado digitalmente: ${session?.user?.name ?? ""}`, M, y)
    y += 4
    doc.text("Firma Electronica Simple — Ley N° 19.799 de 2002", M, y)

    if (tieneDiferencias && jefeSeleccionado) {
      doc.setTextColor(0)
      doc.setFontSize(8)
      const xJ = M + 100
      const yFirmaJefe = y - 13
      doc.line(xJ, yFirmaJefe, xJ + 75, yFirmaJefe)
      doc.text(`Jefe / Subrogante: ${jefeSeleccionado.name}`, xJ, yFirmaJefe + 5)
      doc.setTextColor(100)
      doc.setFontSize(7.5)
      doc.text("Firma Electronica Simple — Ley N° 19.799 de 2002", xJ, yFirmaJefe + 9)
    }

    return doc.output("datauristring").split(",")[1]
  }

  const handleSubmit = async () => {
    if (tieneDiferencias && !jefeId) {
      setError("Hay diferencias en el conteo. Debes seleccionar un jefe que autorice los ajustes.")
      return
    }
    setSubmitting(true)
    setError("")
    const pdfBase64 = buildPDF()
    const res = await fetch("/api/farmacia/inventario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({
          medicamentoId: i.medicamentoId,
          nombre: i.nombre,
          codigo: i.codigo,
          unidad: i.unidad,
          stockSistema: i.stockSistema,
          stockContado: i.stockContado,
        })),
        jefeId: tieneDiferencias ? parseInt(jefeId) : undefined,
        observaciones: observaciones || undefined,
        pdfBase64,
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (res.ok) {
      router.push(`/farmacia?actaId=${data.actaId}&estado=${data.estado}`)
    } else {
      setError(data.error || "Error al procesar el inventario")
    }
  }

  const handleJefeInput = (val: string) => {
    setJefeNombre(val)
    const match = firmantes.find((f) => f.name === val)
    setJefeId(match ? String(match.id) : "")
  }

  if (loading) {
    return (
      <Layout titulo="Toma de Inventario — Farmacia">
        <p className="text-gray-500 text-sm">Cargando medicamentos...</p>
      </Layout>
    )
  }

  return (
    <Layout titulo="Toma de Inventario — Farmacia Posta Rural">
      <div className="mb-6">
        <a href="/farmacia" className="text-sm text-green-600 hover:underline">
          &larr; Volver a Farmacia
        </a>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Ingresa el stock contado para cada medicamento. El sistema detectará diferencias y generará el acta firmada.
      </p>

      {tieneDiferencias && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5">
          <p className="text-amber-800 text-sm font-medium mb-2">
            Se detectaron diferencias en {itemsDif.length} medicamento(s). Debes seleccionar un jefe para autorizar los ajustes.
          </p>
          <label className="block text-sm text-amber-800 font-medium mb-1">
            Jefe o subrogante autorizador
          </label>
          <input
            list="lista-jefes-farmacia"
            value={jefeNombre}
            onChange={(e) => handleJefeInput(e.target.value)}
            placeholder="Escribe o selecciona un nombre..."
            className="border border-amber-300 rounded-lg px-3 py-2 text-sm w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <datalist id="lista-jefes-farmacia">
            {firmantes.map((f) => (
              <option key={f.id} value={f.name} />
            ))}
          </datalist>
          {jefeNombre && !jefeSeleccionado && (
            <p className="text-xs text-red-600 mt-1">
              Nombre no encontrado en el sistema. Asegúrate de que el usuario tenga RUT configurado.
            </p>
          )}
        </div>
      )}

      <div className="mb-4 flex gap-3 items-center">
        <input
          type="text"
          placeholder="Buscar medicamento..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <span className="text-xs text-gray-400">
          {itemsFiltrados.length} de {items.length} medicamentos
        </span>
        {tieneDiferencias && (
          <span className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
            {itemsDif.length} con diferencia
          </span>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-3 py-3 text-gray-600 font-medium">Codigo</th>
              <th className="text-left px-3 py-3 text-gray-600 font-medium">Nombre</th>
              <th className="text-left px-3 py-3 text-gray-600 font-medium">Categoria</th>
              <th className="text-left px-3 py-3 text-gray-600 font-medium">Unidad</th>
              <th className="text-right px-3 py-3 text-gray-600 font-medium">Stock sistema</th>
              <th className="text-right px-3 py-3 text-gray-600 font-medium">Stock contado</th>
              <th className="text-right px-3 py-3 text-gray-600 font-medium">Diferencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {itemsFiltrados.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-400 text-sm">
                  No se encontraron medicamentos
                </td>
              </tr>
            ) : (
              itemsFiltrados.map((item) => {
                const idxGlobal = items.findIndex((i) => i.medicamentoId === item.medicamentoId)
                const dif = item.stockContado - item.stockSistema
                return (
                  <tr key={item.medicamentoId} className={`hover:bg-gray-50 ${dif !== 0 ? "bg-amber-50" : ""}`}>
                    <td className="px-3 py-2 font-mono text-gray-500 text-xs">{item.codigo}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">{item.nombre}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{item.categoria}</td>
                    <td className="px-3 py-2 text-gray-500">{item.unidad}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{item.stockSistema}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        value={item.stockContado}
                        onChange={(e) => updateContado(idxGlobal, e.target.value)}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {dif === 0 ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span className={dif > 0 ? "text-green-700" : "text-red-600"}>
                          {dif > 0 ? "+" : ""}{dif}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Observaciones (opcional)
        </label>
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={3}
          placeholder="Condiciones del inventario, notas adicionales..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {error && (
        <p className="text-red-600 text-sm mb-4">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={submitting || (tieneDiferencias && !jefeSeleccionado)}
          className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {submitting
            ? "Firmando acta..."
            : tieneDiferencias
            ? "Firmar acta y enviar a jefe"
            : "Firmar acta de inventario"}
        </button>
        <a
          href="/farmacia"
          className="bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </a>
      </div>
    </Layout>
  )
}
