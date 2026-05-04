"use client"

import { useEffect, useState } from "react"
import Layout from "@/components/Layout"
import { validarRut, formatearRut } from "@/lib/validarRut"

interface Paciente {
  id: number
  rut: string
  nombre: string
  apellido: string
  telefono: string | null
  createdAt: string
  _count: { movimientos: number }
}

export default function PacientesPage() {
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [editando, setEditando] = useState<Paciente | null>(null)
  const [formEdit, setFormEdit] = useState({ nombre: "", apellido: "", telefono: "" })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const [exito, setExito] = useState("")

  // Nuevo paciente
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [formNuevo, setFormNuevo] = useState({ rut: "", nombre: "", apellido: "", telefono: "" })
  const [errorNuevo, setErrorNuevo] = useState("")
  const [errorRutNuevo, setErrorRutNuevo] = useState("")
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    fetchPacientes()
  }, [])

  useEffect(() => {
    const timer = setTimeout(fetchPacientes, 300)
    return () => clearTimeout(timer)
  }, [busqueda])

  const fetchPacientes = async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (busqueda.trim()) qs.set("q", busqueda.trim())
    const res = await fetch(`/api/farmacia/pacientes?${qs}`)
    const data = await res.json()
    setPacientes(data.pacientes ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }

  const handleEditar = (p: Paciente) => {
    setEditando(p)
    setFormEdit({ nombre: p.nombre, apellido: p.apellido, telefono: p.telefono ?? "" })
    setError("")
  }

  const handleGuardar = async () => {
    if (!editando) return
    setError("")
    if (!formEdit.nombre.trim() || !formEdit.apellido.trim()) {
      setError("Nombre y apellido son obligatorios"); return
    }
    setGuardando(true)
    const res = await fetch("/api/farmacia/pacientes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editando.id, ...formEdit }),
    })
    const data = await res.json()
    setGuardando(false)
    if (!res.ok) { setError(data.error || "Error al guardar"); return }
    setEditando(null)
    setExito("Paciente actualizado")
    setTimeout(() => setExito(""), 3000)
    fetchPacientes()
  }

  const handleCrear = async () => {
    setErrorNuevo("")
    setErrorRutNuevo("")
    if (!formNuevo.rut.trim()) { setErrorNuevo("El RUT es obligatorio"); return }
    if (!validarRut(formNuevo.rut)) { setErrorRutNuevo("RUT inválido"); return }
    if (!formNuevo.nombre.trim()) { setErrorNuevo("El nombre es obligatorio"); return }
    if (!formNuevo.apellido.trim()) { setErrorNuevo("El apellido es obligatorio"); return }
    setCreando(true)
    const res = await fetch("/api/farmacia/pacientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formNuevo),
    })
    const data = await res.json()
    setCreando(false)
    if (!res.ok) { setErrorNuevo(data.error || "Error al crear"); return }
    setMostrarNuevo(false)
    setFormNuevo({ rut: "", nombre: "", apellido: "", telefono: "" })
    setExito("Paciente registrado")
    setTimeout(() => setExito(""), 3000)
    fetchPacientes()
  }

  const formatFecha = (f: string) =>
    new Date(f).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })

  return (
    <Layout titulo="Pacientes — Farmacia">
      <div className="max-w-4xl mx-auto space-y-4">

        {exito && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">{exito}</div>}

        {/* Barra de búsqueda y acciones */}
        <div className="flex gap-3 items-center">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por RUT, nombre o apellido..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={() => { setMostrarNuevo((v) => !v); setErrorNuevo("") }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors whitespace-nowrap"
          >
            + Nuevo paciente
          </button>
        </div>

        {/* Formulario nuevo paciente */}
        {mostrarNuevo && (
          <div className="bg-white rounded-lg shadow p-5 border-l-4 border-green-500">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Registrar nuevo paciente</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">RUT <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formNuevo.rut}
                  onChange={(e) => { setFormNuevo((f) => ({ ...f, rut: formatearRut(e.target.value) })); setErrorRutNuevo("") }}
                  onBlur={() => { if (formNuevo.rut && !validarRut(formNuevo.rut)) setErrorRutNuevo("RUT inválido") }}
                  placeholder="12345678-9"
                  maxLength={12}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {errorRutNuevo && <p className="text-red-500 text-xs mt-0.5">{errorRutNuevo}</p>}
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={formNuevo.telefono}
                  onChange={(e) => setFormNuevo((f) => ({ ...f, telefono: e.target.value }))}
                  placeholder="+56 9 1234 5678"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formNuevo.nombre}
                  onChange={(e) => setFormNuevo((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Juan"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Apellido <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formNuevo.apellido}
                  onChange={(e) => setFormNuevo((f) => ({ ...f, apellido: e.target.value }))}
                  placeholder="Pérez"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            {errorNuevo && <p className="text-red-500 text-xs mt-2">{errorNuevo}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={handleCrear} disabled={creando}
                className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                {creando ? "Guardando..." : "Guardar paciente"}
              </button>
              <button onClick={() => setMostrarNuevo(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Tabla de pacientes */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {busqueda ? `${total} resultado(s) para "${busqueda}"` : `${total} paciente(s) registrado(s)`}
            </p>
          </div>

          {loading ? (
            <p className="text-center py-10 text-gray-400 text-sm">Cargando...</p>
          ) : pacientes.length === 0 ? (
            <p className="text-center py-10 text-gray-400 text-sm">
              {busqueda ? "Sin resultados para la búsqueda" : "No hay pacientes registrados aún"}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-5 py-3 text-gray-600 font-medium">RUT</th>
                  <th className="text-left px-5 py-3 text-gray-600 font-medium">Nombre</th>
                  <th className="text-left px-5 py-3 text-gray-600 font-medium">Teléfono</th>
                  <th className="text-center px-5 py-3 text-gray-600 font-medium">Despachos</th>
                  <th className="text-left px-5 py-3 text-gray-600 font-medium">Registrado</th>
                  <th className="text-center px-5 py-3 text-gray-600 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pacientes.map((p) =>
                  editando?.id === p.id ? (
                    <tr key={p.id} className="bg-green-50">
                      <td className="px-5 py-3 font-mono text-gray-600">{p.rut}</td>
                      <td className="px-5 py-3" colSpan={2}>
                        <div className="flex gap-2">
                          <input
                            value={formEdit.nombre}
                            onChange={(e) => setFormEdit((f) => ({ ...f, nombre: e.target.value }))}
                            className="border border-gray-300 rounded px-2 py-1 text-sm w-28 focus:outline-none focus:ring-1 focus:ring-green-500"
                            placeholder="Nombre"
                          />
                          <input
                            value={formEdit.apellido}
                            onChange={(e) => setFormEdit((f) => ({ ...f, apellido: e.target.value }))}
                            className="border border-gray-300 rounded px-2 py-1 text-sm w-28 focus:outline-none focus:ring-1 focus:ring-green-500"
                            placeholder="Apellido"
                          />
                          <input
                            value={formEdit.telefono}
                            onChange={(e) => setFormEdit((f) => ({ ...f, telefono: e.target.value }))}
                            className="border border-gray-300 rounded px-2 py-1 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-green-500"
                            placeholder="Teléfono"
                          />
                        </div>
                        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                      </td>
                      <td className="px-5 py-3 text-center text-gray-500">{p._count.movimientos}</td>
                      <td className="px-5 py-3 text-gray-400 text-xs">{formatFecha(p.createdAt)}</td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <button onClick={handleGuardar} disabled={guardando}
                            className="text-green-600 text-xs hover:underline disabled:opacity-50">
                            {guardando ? "..." : "Guardar"}
                          </button>
                          <button onClick={() => setEditando(null)} className="text-gray-400 text-xs hover:underline">
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-mono text-gray-600">{p.rut}</td>
                      <td className="px-5 py-3 font-medium text-gray-800">{p.apellido}, {p.nombre}</td>
                      <td className="px-5 py-3 text-gray-500">{p.telefono || <span className="text-gray-300">—</span>}</td>
                      <td className="px-5 py-3 text-center">
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                          {p._count.movimientos}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs">{formatFecha(p.createdAt)}</td>
                      <td className="px-5 py-3 text-center">
                        <button onClick={() => handleEditar(p)} className="text-blue-500 text-xs hover:underline">
                          Editar
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  )
}
