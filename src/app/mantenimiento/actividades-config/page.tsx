"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Layout from "@/components/Layout"

type TipoCampo = "TEXTO" | "FECHA_HORA" | "NUMERO"

interface Campo {
  id: number
  descripcion: string
  tipo: TipoCampo
  requiereImagen: boolean
  valorMin: number | null
  valorMax: number | null
}

interface Actividad {
  id: number
  nombre: string
  activo: boolean
  intervaloDiasAlerta: number | null
  campos: Campo[]
}

interface Activo {
  id: number
  nombre: string
}

interface NuevoCampoForm {
  descripcion: string
  tipo: TipoCampo
  requiereImagen: boolean
  valorMin: string
  valorMax: string
}

const CAMPO_VACIO: NuevoCampoForm = { descripcion: "", tipo: "TEXTO", requiereImagen: false, valorMin: "", valorMax: "" }

export default function ActividadesConfigPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [cargando, setCargando] = useState(true)
  const [nombreNueva, setNombreNueva] = useState("")
  const [error, setError] = useState("")

  const [nuevoCampo, setNuevoCampo] = useState<Record<number, NuevoCampoForm>>({})

  const [activos, setActivos] = useState<Activo[]>([])
  const [nombreActivoNuevo, setNombreActivoNuevo] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const cargar = () => {
    fetch("/api/mantenimiento/actividades")
      .then((r) => r.json())
      .then((d) => { setActividades(d); setCargando(false) })
  }

  const cargarActivos = () => {
    fetch("/api/mantenimiento/activos")
      .then((r) => r.json())
      .then(setActivos)
  }

  useEffect(() => { if (session) { cargar(); cargarActivos() } }, [session])

  const role = session?.user?.role
  if (role && role !== "ADMIN" && role !== "ENCARGADO") {
    return <Layout titulo="Mantenimiento"><div className="text-gray-400 p-8">Sin permisos para ver esta página.</div></Layout>
  }

  const crearActividad = async () => {
    setError("")
    if (!nombreNueva.trim()) { setError("El nombre es obligatorio"); return }
    const res = await fetch("/api/mantenimiento/actividades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreNueva }),
    })
    if (!res.ok) { const d = await res.json(); setError(d.error); return }
    setNombreNueva("")
    cargar()
  }

  const actualizarActividad = async (id: number, datos: Partial<Pick<Actividad, "nombre" | "intervaloDiasAlerta">>) => {
    await fetch(`/api/mantenimiento/actividades/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    })
    cargar()
  }

  const eliminarActividad = async (id: number) => {
    if (!confirm("¿Eliminar esta actividad? Si ya tiene registros, solo se ocultará.")) return
    await fetch(`/api/mantenimiento/actividades/${id}`, { method: "DELETE" })
    cargar()
  }

  const agregarCampo = async (actividadId: number) => {
    const datos = nuevoCampo[actividadId]
    if (!datos?.descripcion?.trim()) return
    await fetch(`/api/mantenimiento/actividades/${actividadId}/campos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    })
    setNuevoCampo((s) => ({ ...s, [actividadId]: CAMPO_VACIO }))
    cargar()
  }

  const actualizarCampo = async (actividadId: number, campoId: number, datos: Partial<Campo>) => {
    await fetch(`/api/mantenimiento/actividades/${actividadId}/campos/${campoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    })
    cargar()
  }

  const eliminarCampo = async (actividadId: number, campoId: number) => {
    if (!confirm("¿Eliminar este campo? Si ya tiene respuestas registradas, solo se ocultará.")) return
    await fetch(`/api/mantenimiento/actividades/${actividadId}/campos/${campoId}`, { method: "DELETE" })
    cargar()
  }

  const crearActivo = async () => {
    if (!nombreActivoNuevo.trim()) return
    await fetch("/api/mantenimiento/activos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreActivoNuevo }),
    })
    setNombreActivoNuevo("")
    cargarActivos()
  }

  const eliminarActivo = async (id: number) => {
    if (!confirm("¿Eliminar este equipo/lugar? Si ya se usó en algún registro, solo se ocultará.")) return
    await fetch(`/api/mantenimiento/activos/${id}`, { method: "DELETE" })
    cargarActivos()
  }

  return (
    <Layout titulo="Configurar Actividades de Mantenimiento">
      <div className="max-w-3xl mx-auto space-y-6">
        <p className="text-sm text-gray-500">
          Cada actividad define los datos (y si requieren foto) que el operador debe completar al registrarla.
        </p>

        {cargando ? (
          <div className="p-12 text-center text-gray-400">Cargando...</div>
        ) : (
          actividades.map((a) => (
            <div key={a.id} className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
                <input
                  defaultValue={a.nombre}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== a.nombre && actualizarActividad(a.id, { nombre: e.target.value })}
                  className="font-semibold text-gray-800 border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none px-1 py-0.5 flex-1"
                />
                <button onClick={() => eliminarActividad(a.id)} className="text-red-400 hover:text-red-600 text-xs shrink-0">
                  Eliminar
                </button>
              </div>

              <div className="flex items-center gap-2 mb-4 px-1">
                <label className="text-xs text-gray-500">Avisar por correo si pasan</label>
                <input
                  type="number"
                  inputMode="numeric"
                  defaultValue={a.intervaloDiasAlerta ?? ""}
                  placeholder="Sin alerta"
                  onBlur={(e) => actualizarActividad(a.id, { intervaloDiasAlerta: e.target.value === "" ? null : parseInt(e.target.value) })}
                  className="w-20 border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <label className="text-xs text-gray-500">días sin registrarse</label>
              </div>

              <table className="w-full text-sm mb-3">
                <thead className="text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="text-left py-1">Dato a registrar</th>
                    <th className="text-left py-1 w-32">Tipo</th>
                    <th className="text-left py-1 w-28">Rango válido</th>
                    <th className="text-center py-1 w-20">Con foto</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {a.campos.map((c) => (
                    <tr key={c.id}>
                      <td className="py-1.5">
                        <input
                          defaultValue={c.descripcion}
                          onBlur={(e) => e.target.value.trim() && e.target.value !== c.descripcion && actualizarCampo(a.id, c.id, { descripcion: e.target.value })}
                          className="w-full border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none py-0.5"
                        />
                      </td>
                      <td>
                        <select
                          value={c.tipo}
                          onChange={(e) => actualizarCampo(a.id, c.id, { tipo: e.target.value as TipoCampo })}
                          className="border rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                          <option value="TEXTO">Texto</option>
                          <option value="FECHA_HORA">Fecha y hora</option>
                          <option value="NUMERO">Número</option>
                        </select>
                      </td>
                      <td>
                        {c.tipo === "NUMERO" && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number" defaultValue={c.valorMin ?? ""} placeholder="min"
                              onBlur={(e) => actualizarCampo(a.id, c.id, { valorMin: e.target.value === "" ? null : Number(e.target.value) })}
                              className="w-12 border rounded px-1 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                            <span className="text-gray-300">–</span>
                            <input
                              type="number" defaultValue={c.valorMax ?? ""} placeholder="max"
                              onBlur={(e) => actualizarCampo(a.id, c.id, { valorMax: e.target.value === "" ? null : Number(e.target.value) })}
                              className="w-12 border rounded px-1 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                          </div>
                        )}
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          checked={c.requiereImagen}
                          onChange={(e) => actualizarCampo(a.id, c.id, { requiereImagen: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="text-right">
                        <button onClick={() => eliminarCampo(a.id, c.id)} className="text-red-400 hover:text-red-600 text-xs">
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex gap-2 items-center flex-wrap">
                <input
                  value={nuevoCampo[a.id]?.descripcion ?? ""}
                  onChange={(e) => setNuevoCampo((s) => ({ ...s, [a.id]: { ...(s[a.id] ?? CAMPO_VACIO), descripcion: e.target.value } }))}
                  placeholder="Nuevo dato a registrar..."
                  className="flex-1 min-w-40 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <select
                  value={nuevoCampo[a.id]?.tipo ?? "TEXTO"}
                  onChange={(e) => setNuevoCampo((s) => ({ ...s, [a.id]: { ...(s[a.id] ?? CAMPO_VACIO), tipo: e.target.value as TipoCampo } }))}
                  className="border rounded-lg px-1.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 shrink-0"
                >
                  <option value="TEXTO">Texto</option>
                  <option value="FECHA_HORA">Fecha y hora</option>
                  <option value="NUMERO">Número</option>
                </select>
                {nuevoCampo[a.id]?.tipo === "NUMERO" && (
                  <>
                    <input
                      type="number" placeholder="min" value={nuevoCampo[a.id]?.valorMin ?? ""}
                      onChange={(e) => setNuevoCampo((s) => ({ ...s, [a.id]: { ...(s[a.id] ?? CAMPO_VACIO), valorMin: e.target.value } }))}
                      className="w-14 border rounded-lg px-1.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 shrink-0"
                    />
                    <input
                      type="number" placeholder="max" value={nuevoCampo[a.id]?.valorMax ?? ""}
                      onChange={(e) => setNuevoCampo((s) => ({ ...s, [a.id]: { ...(s[a.id] ?? CAMPO_VACIO), valorMax: e.target.value } }))}
                      className="w-14 border rounded-lg px-1.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 shrink-0"
                    />
                  </>
                )}
                <label className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
                  <input
                    type="checkbox"
                    checked={nuevoCampo[a.id]?.requiereImagen ?? false}
                    onChange={(e) => setNuevoCampo((s) => ({ ...s, [a.id]: { ...(s[a.id] ?? CAMPO_VACIO), requiereImagen: e.target.checked } }))}
                    className="rounded border-gray-300"
                  />
                  Con foto
                </label>
                <button
                  onClick={() => agregarCampo(a.id)}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors shrink-0"
                >
                  Agregar
                </button>
              </div>
            </div>
          ))
        )}

        <div className="bg-white rounded-xl shadow-sm p-5 max-w-md">
          <p className="font-medium text-gray-700 mb-3">Nueva actividad</p>
          <div className="flex gap-3">
            <input
              value={nombreNueva}
              onChange={(e) => setNombreNueva(e.target.value)}
              placeholder="Ej: Mantención Planta Desaladora"
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button onClick={crearActividad}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              Agregar
            </button>
          </div>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        </div>

        <h2 className="text-lg font-semibold text-gray-800 mt-8 mb-1">Equipos y Lugares</h2>
        <p className="text-sm text-gray-500 mb-4">Para asociar cada registro a un equipo o lugar específico (motor, bomba, estanque, etc.)</p>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {activos.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">Sin equipos/lugares registrados todavía.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-50">
                {activos.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2.5 text-gray-700">{a.nombre}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => eliminarActivo(a.id)} className="text-red-400 hover:text-red-600 text-xs">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 max-w-md">
          <div className="flex gap-3">
            <input
              value={nombreActivoNuevo}
              onChange={(e) => setNombreActivoNuevo(e.target.value)}
              placeholder="Ej: Estanque Inka, Motor Bomba 1..."
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button onClick={crearActivo}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              Agregar
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
