"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import Layout from "@/components/Layout"

interface Respuesta {
  id: number
  valor: string
  imagenUrl: string | null
  campo: { descripcion: string }
}

interface Hallazgo {
  id: number
  descripcion: string
  estado: string
  fecha: string
}

interface Bloque {
  id: number
  fecha: string
  observaciones: string | null
  actividad: { id: number; nombre: string }
  creadoPor: { name: string }
  creadoPorId: number
  editadoPor: { name: string } | null
  fechaEdicion: string | null
  respuestas: Respuesta[]
  hallazgos: Hallazgo[]
  _count: { versiones: number }
}

interface RegistroDetalle {
  id: number
  fecha: string
  creadoPor: { name: string }
  activo: { nombre: string } | null
  bloques: Bloque[]
}

interface Actividad {
  id: number
  nombre: string
}

interface Version {
  id: number
  fecha: string
  editadoPor: { name: string }
  datos: { observaciones: string | null; respuestas: { descripcion: string; valor: string }[] }
}

export default function RegistroDetallePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [registro, setRegistro] = useState<RegistroDetalle | null>(null)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [cargando, setCargando] = useState(true)
  const [bloqueAbierto, setBloqueAbierto] = useState<number | null>(null)
  const [historial, setHistorial] = useState<Record<number, Version[]>>({})

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const cargar = useCallback(() => {
    fetch(`/api/mantenimiento/registros/${id}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((d) => { setRegistro(d.registro); setActividades(d.actividades); setCargando(false) })
      .catch(() => setCargando(false))
  }, [id])

  useEffect(() => { if (session) cargar() }, [session, cargar])

  const cargarHistorial = async (bloqueId: number) => {
    const res = await fetch(`/api/mantenimiento/registros/${id}/bloques/${bloqueId}/versiones`)
    const data = await res.json()
    setHistorial((h) => ({ ...h, [bloqueId]: data }))
  }

  const cerrarHallazgo = async (hallazgoId: number) => {
    await fetch(`/api/mantenimiento/hallazgos/${hallazgoId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
    cargar()
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })

  if (cargando) {
    return <Layout titulo="Registro"><div className="p-12 text-center text-gray-400">Cargando...</div></Layout>
  }
  if (!registro) {
    return <Layout titulo="Registro"><div className="p-12 text-center text-gray-400">No encontrado.</div></Layout>
  }

  const role = session?.user?.role
  const userId = session?.user?.id ? parseInt(session.user.id) : null
  const puedeEditarTodo = role === "ADMIN" || role === "ENCARGADO"

  const bloquesPorActividad = new Map(registro.bloques.map((b) => [b.actividad.id, b]))

  return (
    <Layout titulo={`Registro #${registro.id}`}>
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-sm text-gray-500">
            Creado por <span className="font-medium text-gray-700">{registro.creadoPor.name}</span> el {fmt(registro.fecha)}
          </p>
          {registro.activo && (
            <p className="text-sm text-blue-700 mt-1">📍 {registro.activo.nombre}</p>
          )}
        </div>

        <div className="space-y-3">
          {actividades.map((a) => {
            const bloque = bloquesPorActividad.get(a.id)
            const abierto = bloqueAbierto === a.id

            if (!bloque) {
              return (
                <Link
                  key={a.id}
                  href={`/mantenimiento/registros/${registro.id}/actividad/${a.id}`}
                  className="flex items-center justify-between bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow border border-dashed border-gray-200"
                >
                  <span className="text-gray-500">{a.nombre}</span>
                  <span className="text-blue-600 text-sm font-medium">+ Agregar</span>
                </Link>
              )
            }

            const puedeEditar = puedeEditarTodo || bloque.creadoPorId === userId
            const hallazgosAbiertos = bloque.hallazgos.filter((h) => h.estado === "ABIERTA")

            return (
              <div key={a.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setBloqueAbierto(abierto ? null : a.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <span className="text-green-600 mr-1.5">✓</span>
                    <span className="font-medium text-gray-800">{a.nombre}</span>
                    {hallazgosAbiertos.length > 0 && (
                      <span className="ml-2 text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                        ⚠ {hallazgosAbiertos.length} hallazgo{hallazgosAbiertos.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      Por {bloque.creadoPor.name} · {fmt(bloque.fecha)}
                      {bloque.editadoPor && ` · editado por ${bloque.editadoPor.name} el ${fmt(bloque.fechaEdicion!)}`}
                    </p>
                  </div>
                  <span className="text-gray-400 text-sm">{abierto ? "Ocultar" : "Ver"}</span>
                </button>

                {abierto && (
                  <div className="border-t divide-y divide-gray-100">
                    {bloque.respuestas.map((r) => (
                      <div key={r.id} className="p-4">
                        <p className="text-sm font-medium text-gray-700 mb-1">{r.campo.descripcion}</p>
                        <p className="text-sm text-gray-600 mb-2">{r.valor}</p>
                        {r.imagenUrl && (
                          <a href={r.imagenUrl} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={r.imagenUrl} alt={r.campo.descripcion} className="max-w-xs rounded-lg border" />
                          </a>
                        )}
                      </div>
                    ))}
                    {bloque.observaciones && (
                      <div className="p-4">
                        <p className="text-sm font-medium text-gray-700 mb-1">Observaciones</p>
                        <p className="text-sm text-gray-600">{bloque.observaciones}</p>
                      </div>
                    )}

                    {bloque.hallazgos.length > 0 && (
                      <div className="p-4 space-y-2">
                        <p className="text-sm font-medium text-gray-700">Hallazgos reportados</p>
                        {bloque.hallazgos.map((h) => (
                          <div key={h.id} className="bg-red-50 rounded-lg p-3 flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm text-gray-700">{h.descripcion}</p>
                              <p className="text-xs text-gray-400">{fmt(h.fecha)} · {h.estado === "ABIERTA" ? "Abierto" : "Cerrado"}</p>
                            </div>
                            {h.estado === "ABIERTA" && puedeEditarTodo && (
                              <button onClick={() => cerrarHallazgo(h.id)} className="text-xs text-blue-600 hover:underline shrink-0">
                                Cerrar
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="p-4 flex items-center gap-4">
                      {puedeEditar && (
                        <Link
                          href={`/mantenimiento/registros/${registro.id}/actividad/${a.id}?editar=${bloque.id}`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Editar
                        </Link>
                      )}
                      {bloque._count.versiones > 0 && (
                        <button
                          onClick={() => cargarHistorial(bloque.id)}
                          className="text-sm text-gray-500 hover:underline"
                        >
                          Ver historial de cambios ({bloque._count.versiones})
                        </button>
                      )}
                    </div>

                    {historial[bloque.id] && (
                      <div className="p-4 space-y-3 bg-gray-50">
                        {historial[bloque.id].map((v) => (
                          <div key={v.id} className="text-xs text-gray-500">
                            <p className="font-medium text-gray-600 mb-1">Antes de la edición de {v.editadoPor.name} el {fmt(v.fecha)}:</p>
                            {v.datos.respuestas.map((r, i) => (
                              <p key={i}>{r.descripcion}: {r.valor}</p>
                            ))}
                            {v.datos.observaciones && <p>Observaciones: {v.datos.observaciones}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Layout>
  )
}
