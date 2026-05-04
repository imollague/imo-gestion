"use client"

import { useState, useEffect, useRef } from "react"
import { validarRut, formatearRut } from "@/lib/validarRut"

interface Paciente {
  id: number
  rut: string
  nombre: string
  apellido: string
  telefono: string | null
}

interface Props {
  onSeleccionar: (paciente: Paciente) => void
  onLimpiar: () => void
  pacienteSeleccionado: Paciente | null
}

export default function BuscadorPaciente({ onSeleccionar, onLimpiar, pacienteSeleccionado }: Props) {
  const [query, setQuery] = useState("")
  const [resultados, setResultados] = useState<Paciente[]>([])
  const [mostrarDropdown, setMostrarDropdown] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [mostrarFormNuevo, setMostrarFormNuevo] = useState(false)
  const [errorCrear, setErrorCrear] = useState("")
  const [creando, setCreando] = useState(false)
  const [formNuevo, setFormNuevo] = useState({ rut: "", nombre: "", apellido: "", telefono: "" })
  const [errorRutNuevo, setErrorRutNuevo] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMostrarDropdown(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  useEffect(() => {
    if (query.length < 2) { setResultados([]); setMostrarDropdown(false); return }
    const timer = setTimeout(async () => {
      setBuscando(true)
      const res = await fetch(`/api/farmacia/pacientes/buscar?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setResultados(data)
      setMostrarDropdown(true)
      setBuscando(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const handleSeleccionar = (p: Paciente) => {
    onSeleccionar(p)
    setQuery("")
    setResultados([])
    setMostrarDropdown(false)
  }

  const handleCrear = async () => {
    setErrorCrear("")
    setErrorRutNuevo("")
    if (!formNuevo.rut.trim()) { setErrorCrear("El RUT es obligatorio"); return }
    if (!validarRut(formNuevo.rut)) { setErrorRutNuevo("RUT inválido"); return }
    if (!formNuevo.nombre.trim()) { setErrorCrear("El nombre es obligatorio"); return }
    if (!formNuevo.apellido.trim()) { setErrorCrear("El apellido es obligatorio"); return }

    setCreando(true)
    const res = await fetch("/api/farmacia/pacientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formNuevo),
    })
    const data = await res.json()
    setCreando(false)
    if (!res.ok) { setErrorCrear(data.error || "Error al crear paciente"); return }
    handleSeleccionar(data)
    setMostrarFormNuevo(false)
    setFormNuevo({ rut: "", nombre: "", apellido: "", telefono: "" })
  }

  if (pacienteSeleccionado) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex justify-between items-start">
        <div>
          <p className="font-semibold text-green-800 text-sm">
            {pacienteSeleccionado.nombre} {pacienteSeleccionado.apellido}
          </p>
          <p className="text-green-600 text-xs">RUT: {pacienteSeleccionado.rut}</p>
          {pacienteSeleccionado.telefono && (
            <p className="text-green-600 text-xs">Tel: {pacienteSeleccionado.telefono}</p>
          )}
        </div>
        <button onClick={onLimpiar} className="text-green-400 hover:text-green-600 text-xs underline">
          Cambiar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative" ref={dropdownRef}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => resultados.length > 0 && setMostrarDropdown(true)}
          placeholder="Buscar por RUT o nombre..."
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        {buscando && (
          <div className="absolute right-3 top-2.5">
            <div className="w-4 h-4 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
          </div>
        )}

        {mostrarDropdown && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {resultados.length === 0 ? (
              <p className="text-gray-400 text-sm px-4 py-3">Sin resultados para &quot;{query}&quot;</p>
            ) : (
              resultados.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSeleccionar(p)}
                  className="w-full text-left px-4 py-2.5 hover:bg-green-50 border-b last:border-b-0 border-gray-100"
                >
                  <p className="text-sm font-medium text-gray-800">{p.nombre} {p.apellido}</p>
                  <p className="text-xs text-gray-400">RUT: {p.rut}{p.telefono ? ` · Tel: ${p.telefono}` : ""}</p>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => { setMostrarFormNuevo((v) => !v); setErrorCrear("") }}
        className="text-sm text-green-600 hover:underline"
      >
        {mostrarFormNuevo ? "Cancelar" : "+ Registrar paciente nuevo"}
      </button>

      {mostrarFormNuevo && (
        <div className="border border-green-200 rounded-lg p-4 bg-green-50 space-y-3">
          <p className="text-sm font-medium text-green-800">Nuevo paciente</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">RUT <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formNuevo.rut}
                onChange={(e) => { setFormNuevo((f) => ({ ...f, rut: formatearRut(e.target.value) })); setErrorRutNuevo("") }}
                onBlur={() => { if (formNuevo.rut && !validarRut(formNuevo.rut)) setErrorRutNuevo("RUT inválido") }}
                placeholder="12345678-9"
                maxLength={12}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {errorRutNuevo && <p className="text-red-500 text-xs mt-0.5">{errorRutNuevo}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formNuevo.nombre}
                onChange={(e) => setFormNuevo((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Juan"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Apellido <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formNuevo.apellido}
                onChange={(e) => setFormNuevo((f) => ({ ...f, apellido: e.target.value }))}
                placeholder="Pérez"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono <span className="text-gray-400">(opcional)</span></label>
              <input
                type="text"
                value={formNuevo.telefono}
                onChange={(e) => setFormNuevo((f) => ({ ...f, telefono: e.target.value }))}
                placeholder="+56 9 1234 5678"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          {errorCrear && <p className="text-red-500 text-xs">{errorCrear}</p>}
          <button
            type="button"
            onClick={handleCrear}
            disabled={creando}
            className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {creando ? "Guardando..." : "Guardar paciente"}
          </button>
        </div>
      )}
    </div>
  )
}
