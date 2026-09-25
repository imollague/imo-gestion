"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Layout from "@/components/Layout"

interface Registro {
  id: number
  fecha: string
  creadoPor: { name: string }
  activo: { nombre: string } | null
  bloques: { actividad: { nombre: string } }[]
}

interface Activo {
  id: number
  nombre: string
}

export default function MantenimientoPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [registros, setRegistros] = useState<Registro[]>([])
  const [totalActividades, setTotalActividades] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(false)

  const [activos, setActivos] = useState<Activo[]>([])
  const [mostrarModal, setMostrarModal] = useState(false)
  const [activoElegido, setActivoElegido] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if (!session) return
    fetch("/api/mantenimiento/registros")
      .then((r) => r.json())
      .then((d) => { setRegistros(d.registros); setTotalActividades(d.totalActividades); setCargando(false) })
    fetch("/api/mantenimiento/activos")
      .then((r) => r.json())
      .then(setActivos)
  }, [session])

  const role = session?.user?.role
  const puedeConfigurar = role === "ADMIN" || role === "ENCARGADO"

  const nuevoRegistro = async () => {
    setCreando(true)
    const res = await fetch("/api/mantenimiento/registros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activoId: activoElegido || null }),
    })
    setCreando(false)
    setMostrarModal(false)
    setActivoElegido("")
    if (res.ok) {
      const registro = await res.json()
      router.push(`/mantenimiento/registros/${registro.id}`)
    }
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })

  return (
    <Layout titulo="Mantenimiento">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <p className="text-sm text-gray-500">Registro de actividades de mantención (planta de agua potable, motores, etc.)</p>
        <div className="flex items-center gap-3">
          <a href="/mantenimiento/hallazgos" className="text-sm text-blue-600 hover:underline">
            Hallazgos
          </a>
          {puedeConfigurar && (
            <a href="/mantenimiento/actividades-config" className="text-sm text-blue-600 hover:underline">
              Configurar actividades
            </a>
          )}
          <button
            onClick={() => setMostrarModal(true)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Nuevo registro
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="text-center text-gray-400 py-12">Cargando...</div>
      ) : registros.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
          No hay registros todavía. Crea el primero con &quot;+ Nuevo registro&quot;.
        </div>
      ) : (
        <div className="space-y-3">
          {registros.map((r) => (
            <div
              key={r.id}
              onClick={() => router.push(`/mantenimiento/registros/${r.id}`)}
              className="bg-white rounded-xl shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow border border-transparent hover:border-blue-100"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-gray-700 font-medium">Registro #{r.id}</p>
                    {r.activo && (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{r.activo.nombre}</span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm">Por {r.creadoPor.name}</p>
                  {r.bloques.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {r.bloques.map((b, i) => (
                        <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                          ✓ {b.actividad.nombre}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400 mb-1">{fmt(r.fecha)}</p>
                  <p className="text-xs font-medium text-gray-500">
                    {r.bloques.length}/{totalActividades} actividades
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {mostrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Nuevo registro</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Equipo o lugar <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <select
                value={activoElegido}
                onChange={(e) => setActivoElegido(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin especificar</option>
                {activos.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={nuevoRegistro} disabled={creando}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {creando ? "Creando..." : "Crear"}
              </button>
              <button onClick={() => { setMostrarModal(false); setActivoElegido("") }}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
