"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Layout from "@/components/Layout"
import BuscadorCodigo from "@/components/BuscadorCodigo"
import ModalConfirmar from "@/components/ModalConfirmar"

interface Producto {
  id: number
  codigo: string
  nombre?: string
  unidad: string
  stockActual: number
  categoria: { nombre: string }
}

const TIPOS_DOCUMENTO = [
  { value: "ORDEN_COMPRA", label: "Orden de Compra" },
  { value: "FACTURA", label: "Factura" },
  { value: "GUIA_DESPACHO", label: "Guia de Despacho" },
  { value: "NOTA_DEBITO", label: "Nota de Debito" },
  { value: "NOTA_CREDITO", label: "Nota de Credito" },
  { value: "ACTA_DONACION", label: "Acta de Donacion" },
  { value: "SIN_DOCUMENTO", label: "Sin Documento" },
  { value: "OTRO", label: "Otro" },
]

export default function NuevoMovimientoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const cantidadRef = useRef<HTMLInputElement>(null)

  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [cargandoProducto, setCargandoProducto] = useState(false)
  const [exito, setExito] = useState(false)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)

  const [form, setForm] = useState({
    tipo: "ENTRADA",
    cantidad: "",
    stockReal: "",
    documento: "ORDEN_COMPRA",
    numeroDocumento: "",
    proveedor: "",
    destinatario: "",
    area: "",
    observacion: "",
  })

  useEffect(() => {
    const productoId = searchParams.get("productoId")
    if (productoId) {
      setCargandoProducto(true)
      fetch(`/api/bodega/productos/${productoId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.id) {
            setProductoSeleccionado(data)
            setTimeout(() => cantidadRef.current?.focus(), 100)
          }
        })
        .catch(() => {})
        .finally(() => setCargandoProducto(false))
    }
  }, [searchParams])

  const handleSeleccionar = (producto: Producto) => {
    setProductoSeleccionado(producto)
    setError("")
    setTimeout(() => cantidadRef.current?.focus(), 50)
  }

  const esAjuste = form.tipo === "AJUSTE"

  const handleClickRegistrar = () => {
    setError("")
    if (!productoSeleccionado) {
      setError("Debes seleccionar un producto")
      return
    }
    if (esAjuste) {
      if (form.stockReal === "" || parseInt(form.stockReal) < 0) {
        setError("Ingresa el stock real contado (puede ser 0)")
        return
      }
      if (parseInt(form.stockReal) === productoSeleccionado.stockActual) {
        setError("El stock real coincide con el sistema, no es necesario ajustar")
        return
      }
      if (!form.observacion.trim()) {
        setError("El motivo del ajuste es obligatorio")
        return
      }
    } else {
      if (!form.cantidad || parseInt(form.cantidad) <= 0) {
        setError("La cantidad debe ser mayor a 0")
        return
      }
      if (form.tipo === "SALIDA" && parseInt(form.cantidad) > productoSeleccionado.stockActual) {
        setError(`Stock insuficiente. Stock actual: ${productoSeleccionado.stockActual}`)
        return
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
          productoId: productoSeleccionado!.id,
        }
      : {
          ...form,
          cantidad: parseInt(form.cantidad),
          productoId: productoSeleccionado!.id,
        }

    const res = await fetch("/api/bodega/movimientos", {
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
      setProductoSeleccionado(null)
      setForm((f) => ({ ...f, cantidad: "", stockReal: "", numeroDocumento: "", observacion: "" }))
    }, 2000)
  }

  const stockRealNum = parseInt(form.stockReal)
  const diferencia = productoSeleccionado && form.stockReal !== ""
    ? stockRealNum - productoSeleccionado.stockActual
    : null

  const filasConfirmacion = esAjuste
    ? [
        { label: "Tipo", valor: "AJUSTE DE STOCK" },
        { label: "Producto", valor: productoSeleccionado?.nombre ?? "" },
        { label: "Stock en sistema", valor: `${productoSeleccionado?.stockActual} ${productoSeleccionado?.unidad}` },
        { label: "Stock real contado", valor: `${form.stockReal} ${productoSeleccionado?.unidad}`, destacado: true },
        { label: "Diferencia", valor: diferencia !== null ? `${diferencia > 0 ? "+" : ""}${diferencia} ${productoSeleccionado?.unidad}` : "" },
        { label: "Motivo", valor: form.observacion },
      ]
    : [
        { label: "Tipo", valor: form.tipo },
        { label: "Producto", valor: productoSeleccionado?.nombre ?? "" },
        { label: "Cantidad", valor: `${form.cantidad} ${productoSeleccionado?.unidad ?? ""}`, destacado: true },
        { label: "Documento", valor: TIPOS_DOCUMENTO.find((t) => t.value === form.documento)?.label ?? form.documento },
        ...(form.numeroDocumento ? [{ label: "N Documento", valor: form.numeroDocumento }] : []),
        ...(form.proveedor ? [{ label: "Proveedor", valor: form.proveedor }] : []),
        ...(form.destinatario ? [{ label: "Destinatario", valor: form.destinatario }] : []),
        ...(form.area ? [{ label: "Area", valor: form.area }] : []),
        ...(form.observacion ? [{ label: "Observacion", valor: form.observacion }] : []),
      ]

  return (
    <Layout titulo="Registrar Movimiento de Bodega">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 space-y-5">

          {/* Selector de tipo */}
          <div className="flex gap-3">
            <button
              onClick={() => setForm((f) => ({ ...f, tipo: "ENTRADA" }))}
              className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-colors ${
                form.tipo === "ENTRADA" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              ENTRADA
            </button>
            <button
              onClick={() => setForm((f) => ({ ...f, tipo: "SALIDA" }))}
              className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-colors ${
                form.tipo === "SALIDA" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              SALIDA
            </button>
            <button
              onClick={() => setForm((f) => ({ ...f, tipo: "AJUSTE" }))}
              className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-colors ${
                form.tipo === "AJUSTE" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              AJUSTE
            </button>
          </div>

          {/* Descripcion ajuste */}
          {esAjuste && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-orange-700 text-sm">
              Usa el ajuste cuando el stock fisico no coincide con el sistema. Ingresa la cantidad real contada y el sistema calculara la diferencia automaticamente.
            </div>
          )}

          {/* Buscador producto */}
          {cargandoProducto ? (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-blue-600 text-sm">Cargando producto...</p>
            </div>
          ) : !productoSeleccionado ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Codigo de producto <span className="text-gray-400 font-normal">(escanea o escribe)</span>
              </label>
              <BuscadorCodigo
                endpoint="/api/bodega/productos/buscar"
                onSeleccionar={handleSeleccionar}
                placeholder="Escanea el codigo de barras o escribe el nombre..."
                colorFoco="blue"
                urlCrear="/bodega/productos/nuevo"
              />
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex justify-between items-start">
              <div>
                <p className="text-blue-800 font-semibold">{productoSeleccionado.nombre}</p>
                <p className="text-blue-600 text-sm">{productoSeleccionado.categoria.nombre} — {productoSeleccionado.unidad}</p>
                <p className="text-blue-600 text-sm">
                  Stock actual: <span className="font-semibold">{productoSeleccionado.stockActual} {productoSeleccionado.unidad}</span>
                </p>
              </div>
              <button
                onClick={() => setProductoSeleccionado(null)}
                className="text-blue-400 hover:text-blue-600 text-xs underline"
              >
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
                {/* Indicador de diferencia en tiempo real */}
                {productoSeleccionado && form.stockReal !== "" && diferencia !== null && (
                  <p className={`text-xs mt-1 font-medium ${
                    diferencia === 0 ? "text-gray-500" :
                    diferencia > 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {diferencia === 0
                      ? "Sin diferencia"
                      : diferencia > 0
                      ? `↑ Aumenta ${diferencia} ${productoSeleccionado.unidad}`
                      : `↓ Disminuye ${Math.abs(diferencia)} ${productoSeleccionado.unidad}`}
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
                  placeholder="Ej: Conteo fisico mensual, merma por deterioro, correccion de error de ingreso..."
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                <input
                  ref={cantidadRef}
                  type="number"
                  min="1"
                  value={form.cantidad}
                  onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de documento</label>
                  <select
                    value={form.documento}
                    onChange={(e) => setForm((f) => ({ ...f, documento: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TIPOS_DOCUMENTO.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numero de documento</label>
                  <input
                    type="text"
                    value={form.numeroDocumento}
                    onChange={(e) => setForm((f) => ({ ...f, numeroDocumento: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: 001234"
                    disabled={form.documento === "SIN_DOCUMENTO"}
                  />
                </div>
              </div>

              {form.tipo === "ENTRADA" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                  <input
                    type="text"
                    value={form.proveedor}
                    onChange={(e) => setForm((f) => ({ ...f, proveedor: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre del proveedor"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Destinatario</label>
                    <input
                      type="text"
                      value={form.destinatario}
                      onChange={(e) => setForm((f) => ({ ...f, destinatario: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nombre del destinatario"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Area / Departamento</label>
                    <input
                      type="text"
                      value={form.area}
                      onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ej: Obras Publicas"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observacion <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={form.observacion}
                  onChange={(e) => setForm((f) => ({ ...f, observacion: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Observaciones adicionales..."
                />
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
          )}
          {exito && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm font-medium">
              Movimiento registrado correctamente
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleClickRegistrar}
              disabled={loading || exito}
              className={`flex-1 text-white py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 transition-colors ${
                esAjuste ? "bg-orange-500 hover:bg-orange-600" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {esAjuste ? "Registrar Ajuste" : "Registrar Movimiento"}
            </button>
            <button
              onClick={() => router.back()}
              className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      {mostrarConfirmacion && productoSeleccionado && (
        <ModalConfirmar
          titulo={esAjuste ? "Confirmar ajuste de stock" : "Confirmar movimiento de bodega"}
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