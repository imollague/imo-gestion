"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import Layout from "@/components/Layout"

interface Hallazgo {
  id: number
  descripcion: string
  estado: string
  fecha: string
  creadoPor: { name: string }
  cerradoPor: { name: string } | null
  bloque: { registroId: number; actividad: { nombre: string } }
}

export default function HallazgosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<"ABIERTA" | "CERRADA" | "">("ABIERTA")

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if (!session) return
    fetch(`/api/mantenimiento/hallazgos${filtro ? `?estado=${filtro}` : ""}`)
      .then((r) => r.json())
      .then((d) => { setHallazgos(d); setCargando(false) })
  }, [session, filtro])

  const role = session?.user?.role
  const puedeCerrar = role === "ADMIN" || role === "ENCARGADO"

  const cerrar = async (id: number) => {
    await fetch(`/api/mantenimiento/hallazgos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    setHallazgos((h) =>
      filtro === "ABIERTA" ? h.filter((x) => x.id !== id) : h.map((x) => (x.id === id ? { ...x, estado: "CERRADA" } : x))
    )
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })

  return (
    <Layout titulo="Hallazgos de Mantenimiento">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex gap-2">
          {(["ABIERTA", "CERRADA", ""] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filtro === f ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50 border"
              }`}
            >
              {f === "ABIERTA" ? "Abiertos" : f === "CERRADA" ? "Cerrados" : "Todos"}
            </button>
          ))}
        </div>

        {cargando ? (
          <div className="text-center text-gray-400 py-12">Cargando...</div>
        ) : hallazgos.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">Sin hallazgos.</div>
        ) : (
          <div className="space-y-3">
            {hallazgos.map((h) => (
              <div key={h.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Link href={`/mantenimiento/registros/${h.bloque.registroId}`} className="text-sm font-medium text-blue-600 hover:underline">
                        {h.bloque.actividad.nombre}
                      </Link>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${h.estado === "ABIERTA" ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"}`}>
                        {h.estado === "ABIERTA" ? "Abierto" : "Cerrado"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{h.descripcion}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Reportado por {h.creadoPor.name} el {fmt(h.fecha)}
                      {h.cerradoPor && ` · Cerrado por ${h.cerradoPor.name}`}
                    </p>
                  </div>
                  {h.estado === "ABIERTA" && puedeCerrar && (
                    <button onClick={() => cerrar(h.id)} className="text-xs text-blue-600 hover:underline shrink-0">
                      Cerrar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
