"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Layout from "@/components/Layout"
import BuscadorCodigo from "@/components/BuscadorCodigo"
import BuscadorPaciente from "@/components/BuscadorPaciente"
import ModalConfirmar from "@/components/ModalConfirmar"

interface Medicamento {
  id: number
  codigo: string
  nombreGenerico?: string
  nombreComercial?: string | null
  formaFarmaceutica?: string
  concentracion?: string | null
  unidad: string
  stockActual: number
  categoria: { nombre: string }
}

interface Paciente {
  id: number
  rut: string
  nombre: string
  apellido: string
  telefono: string | null
}

function NuevoMovimientoFarmaciaContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const cantidadRef = useRef<HTMLInputElement>(null)

  const [medicamentoSeleccionado, setMedicamentoSeleccionado] = useState<Medicamento | null>(null)
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<Paciente | null>(null)
  const [cargandoMedicamento, setCargandoMedicamento] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [exito, setExito] = useState(false)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)

  const [form, setForm] = useState({
    tipo: "ENTRADA",
    cantidad: "",
    stockReal: "",
    lote: "",
    fechaVencimiento: "",
    proveedor: "",
    observacion: "",
  })

  useEffect(() => {
    const medicamentoId = searchParams.get("medicamentoId")
    if (medicamentoId) {
      setCargandoMedicamento(true)
      fetch(`/api/farmacia/medicamentos/${medicamentoId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.id) {
            setMedicamentoSeleccionado(data)
            setTimeout(() => cantidadRef.current?.focus(), 100)
          }
        })
        .catch(() => {})
        .finally(() => setCargandoMedicamento(false))
    }
  }, [searchParams])

  const handleSeleccionar = (medicamento: Medicamento) => {
    setMedicamentoSeleccionado(medicamento)
    setError("")
    setTimeout(() => cantidadRef.current?.focus(), 50)
  }

  const esAjuste = form.tipo === "AJUSTE"

  const handleClickRegistrar = () => {
    setError("")
    if (!medicamentoSeleccionado) { setError("Debes seleccionar un medicamento"); return }

    if (esAjuste) {
      if (form.stockReal === "" || parseInt(form.stockReal) < 0) {
        setError("Ingresa el stock real contado (puede ser 0)"); return
      }
      if (parseInt(form.stockReal) === medicamentoSeleccionado.stockActual) {
        setError("El stock real coincide con el sistema, no es necesario ajustar"); return
      }
      if (!form.observacion.trim()) {
        setError("El motivo del ajuste es obligatorio"); return
      }
    } else {
      if (!form.cantidad || parseInt(form.cantidad) <= 0) { setError("La cantidad debe ser mayor a 0"); return }
      if (form.tipo === "SALIDA" && parseInt(form.cantidad) > medicamentoSeleccionado.stockActual) {
        setError(`Stock insuficiente. Stock actual: ${medicamentoSeleccionado.stockActual}`); return
      }
    }
    setMostrarConfirmacion(true)
  }

  const handleSubmit = async () => {
    setLoading(true)

    const body = esAjuste
      ? {
          tipo: "AJUSTE",
          stockReal: parseInt(form.stockReal),
          observacion: form.observacion,
          medicamentoId: medicamentoSeleccionado!.id,
        }
      : {
          ...form,
          cantidad: parseInt(form.cantidad),
          medicamentoId: medicamentoSeleccionado!.id,
          fechaVencimiento: form.fechaVencimiento || null,
          ...(form.tipo === "SALIDA" && pacienteSeleccionado
            ? { rutPaciente: pacienteSeleccionado.rut, pacienteId: pacienteSeleccionado.id }
            : {}),
        }

    const res = await fetch("/api/farmacia/movimientos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || "Error al registrar movimiento")
      setMostrarConfirmacion(false)
      setLoading(false)
      return
    }
    setMostrarConfirmacion(false)
    setExito(true)
    setLoading(false)
    setTimeout(() => {
      setExito(false)
      setMedicamentoSeleccionado(null)
      setPacienteSeleccionado(null)
      setForm((f) => ({ ...f, cantidad: "", stockReal: "", lote: "", fechaVencimiento: "", observacion: "" }))
    }, 2000)
  }

  const stockRealNum = parseInt(form.stockReal)
  const diferencia = medicamentoSeleccionado && form.stockReal !== ""
    ? stockRealNum - medicamentoSeleccionado.stockActual
    : null

  const filasConfirmacion = esAjuste
    ? [
        { label: "Tipo", valor: "AJUSTE DE STOCK" },
        { label: "Medicamento", valor: medicamentoSeleccionado?.nombreGenerico ?? "" },
        { label: "Stock en sistema", valor: `${medicamentoSeleccionado?.stockActual} ${medicamentoSeleccionado?.unidad}` },
        { label: "Stock real contado", valor: `${form.stockReal} ${medicamentoSeleccionado?.unidad}`, destacado: true },
        { label: "Diferencia", valor: diferencia !== null ? `${diferencia > 0 ? "+" : ""}${diferencia} ${medicamentoSeleccionado?.unidad}` : "" },
        { label: "Motivo", valor: form.observacion },
      ]
    : [
        { label: "Tipo", valor: form.tipo === "ENTRADA" ? "ENTRADA" : "DESPACHO" },
        { label: "Medicamento", valor: medicamentoSeleccionado?.nombreGenerico ?? "" },
        ...(medicamentoSeleccionado?.nombreComercial ? [{ label: "Nombre comercial", valor: medicamentoSeleccionado.nombreComercial }] : []),
        { label: "Cantidad", valor: `${form.cantidad} ${medicamentoSeleccionado?.unidad ?? ""}`, destacado: true },
        ...(form.lote ? [{ label: "Lote", valor: form.lote }] : []),
        ...(form.fechaVencimiento ? [{ label: "Vencimiento", valor: form.fechaVencimiento }] : []),
        ...(form.proveedor ? [{ label: "Proveedor", valor: form.proveedor }] : []),
        ...(pacienteSeleccionado ? [{ label: "Paciente", valor: `${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellido} — RUT: ${pacienteSeleccionado.rut}` }] : []),
        ...(form.observacion ? [{ label: "Observacion", valor: form.observacion }] : []),
      ]

  return (
    <Layout titulo="Registrar Movimiento — Farmacia">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 space-y-5">

          {/* Selector de tipo */}
          <div className="flex gap-3">
            <button onClick={() => setForm((f) => ({ ...f, tipo: "ENTRADA" }))}
              className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-colors ${
                form.tipo === "ENTRADA" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>ENTRADA</button>
            <button onClick={() => setForm((f) => ({ ...f, tipo: "SALIDA" }))}
              className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-colors ${
                form.tipo === "SALIDA" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>DESPACHO</button>
            <button onClick={() => setForm((f) => ({ ...f, tipo: "AJUSTE" }))}
              className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-colors ${
                form.tipo === "AJUSTE" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>AJUSTE</button>
          </div>

          {/* Descripcion ajuste */}
          {esAjuste && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-orange-700 text-sm">
              Usa el ajuste cuando el stock fisico no coincide con el sistema. Ingresa la cantidad real contada y el sistema calculara la diferencia automaticamente.
            </div>
          )}

          {/* Buscador medicamento */}
          {cargandoMedicamento ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="w-4 h-4 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
              <p className="text-green-600 text-sm">Cargando medicamento...</p>
            </div>
          ) : !medicamentoSeleccionado ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Codigo de medicamento <span className="text-gray-400 font-normal">(escanea o escribe)</span>
              </label>
              <BuscadorCodigo
                endpoint="/api/farmacia/medicamentos/buscar"
                onSeleccionar={handleSeleccionar}
                placeholder="Escanea el codigo de barras o escribe el nombre..."
                colorFoco="green"
                urlCrear="/farmacia/medicamentos/nuevo"
              />
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex justify-between items-start">
              <div>
                <p className="text-green-800 font-semibold">{medicamentoSeleccionado.nombreGenerico}</p>
                {medicamentoSeleccionado.nombreComercial && (
                  <p className="text-green-600 text-sm">{medicamentoSeleccionado.nombreComercial}</p>
                )}
                <p className="text-green-600 text-sm">
                  {medicamentoSeleccionado.formaFarmaceutica}
                  {medicamentoSeleccionado.concentracion && ` — ${medicamentoSeleccionado.concentracion}`}
                </p>
                <p className="text-green-600 text-sm">
                  Stock actual: <span className="font-semibold">{medicamentoSeleccionado.stockActual} {medicamentoSeleccionado.unidad}</span>
                </p>
              </div>
              <button onClick={() => setMedicamentoSeleccionado(null)}
                className="text-green-400 hover:text-green-600 text-xs underline">
                Cambiar
              </button>
            </div>
          )}

          {/* Campos según tipo */}
          {esAjuste ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock real contado <span className="text-red-500">*</span>
                </label>
                <input
                  ref={cantidadRef}
                  type="number"
                  min="0"
                  value={form.stockReal}
                  onChange={(e) => setForm((f) => ({ ...f, stockReal: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="Cantidad fisica contada"
                />
                {medicamentoSeleccionado && form.stockReal !== "" && diferencia !== null && (
                  <p className={`text-xs mt-1 font-medium ${
                    diferencia === 0 ? "text-gray-500" :
                    diferencia > 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {diferencia === 0
                      ? "Sin diferencia"
                      : diferencia > 0
                      ? `↑ Aumenta ${diferencia} ${medicamentoSeleccionado.unidad}`
                      : `↓ Disminuye ${Math.abs(diferencia)} ${medicamentoSeleccionado.unidad}`}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo del ajuste <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.observacion}
                  onChange={(e) => setForm((f) => ({ ...f, observacion: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  placeholder="Ej: Conteo fisico mensual, vencimiento de lote, correccion de error..."
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                <input ref={cantidadRef} type="number" min="1" value={form.cantidad}
                  onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="0" />
              </div>

              {form.tipo === "ENTRADA" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lote</label>
                    <input type="text" value={form.lote}
                      onChange={(e) => setForm((f) => ({ ...f, lote: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Numero de lote" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de vencimiento</label>
                    <input type="date" value={form.fechaVencimiento}
                      onChange={(e) => setForm((f) => ({ ...f, fechaVencimiento: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                    <input type="text" value={form.proveedor}
                      onChange={(e) => setForm((f) => ({ ...f, proveedor: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Nombre del proveedor o CESFAM" />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Paciente <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <BuscadorPaciente
                    pacienteSeleccionado={pacienteSeleccionado}
                    onSeleccionar={setPacienteSeleccionado}
                    onLimpiar={() => setPacienteSeleccionado(null)}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observacion <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <textarea value={form.observacion} onChange={(e) => setForm((f) => ({ ...f, observacion: e.target.value }))}
                  rows={2} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  placeholder="Observaciones adicionales..." />
              </div>
            </>
          )}

          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>}
          {exito && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm font-medium">Movimiento registrado correctamente</div>}

          <div className="flex gap-3 pt-2">
            <button onClick={handleClickRegistrar} disabled={loading || exito}
              className={`flex-1 text-white py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 transition-colors ${
                esAjuste ? "bg-orange-500 hover:bg-orange-600" : "bg-green-600 hover:bg-green-700"
              }`}>
              {esAjuste ? "Registrar Ajuste" : "Registrar Movimiento"}
            </button>
            <button onClick={() => router.back()}
              className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      </div>

      {mostrarConfirmacion && medicamentoSeleccionado && (
        <ModalConfirmar
          titulo={esAjuste ? "Confirmar ajuste de stock" : "Confirmar movimiento de farmacia"}
          colorConfirmar={esAjuste ? "blue" : form.tipo === "ENTRADA" ? "green" : "blue"}
          filas={filasConfirmacion}
          onConfirmar={handleSubmit}
          onCancelar={() => setMostrarConfirmacion(false)}
          loading={loading}
        />
      )}
    </Layout>
  )
}

export default function NuevoMovimientoFarmaciaPage() {
  return (
    <Suspense>
      <NuevoMovimientoFarmaciaContent />
    </Suspense>
  )
}
