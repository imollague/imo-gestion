"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Layout from "@/components/Layout"

interface Solicitud {
  id: number
  conductorNombre: string
  destino: string
  proposito: string
  estado: string
  fechaSolicitud: string
  vehiculo: { patente: string; marca: string; modelo: string }
  checklist: { id: number } | null
  ordenServicio: { id: number; firmada: boolean } | null
  bitacora: { id: number; kmSalida: number; kmLlegada: number | null } | null
  aprobadoPor: { name: string } | null
}

const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE: "bg-yellow-100 text-yellow-700",
  APROBADA: "bg-blue-100 text-blue-700",
  RECHAZADA: "bg-red-100 text-red-700",
  EN_CURSO: "bg-green-100 text-green-700",
  CERRADA: "bg-gray-100 text-gray-500",
}

function pasoTexto(s: Solicitud): string {
  if (s.estado === "PENDIENTE") return "Esperando aprobación"
  if (s.estado === "RECHAZADA") return "Rechazada"
  if (s.estado === "CERRADA") return "Cerrada"
  if (s.estado === "APROBADA") {
    if (!s.checklist) return "Pendiente: Checklist"
    if (!s.ordenServicio) return "Pendiente: Orden de servicio"
    if (!s.ordenServicio.firmada) return "Esperando firma de orden"
    return "Lista para salir"
  }
  if (s.estado === "EN_CURSO") {
    if (!s.bitacora?.kmLlegada) return "En viaje"
    return "Pendiente: Cerrar proceso"
  }
  return ""
}

export default function SolicitudesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [cargando, setCargando] = useState(true)
  const [verTodas, setVerTodas] = useState(false)

  const role = session?.user?.role

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if (!session) return
    const url = role === "ADMIN" && verTodas
      ? "/api/flota/solicitudes?todas=1"
      : "/api/flota/solicitudes"
    setCargando(true)
    fetch(url)
      .then((r) => r.json())
      .then((d) => { setSolicitudes(d); setCargando(false) })
  }, [session, verTodas, role])

  return (
    <Layout titulo="Solicitudes de Vehículos">
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          {role === "ADMIN" && (
            <>
              <button
                onClick={() => setVerTodas(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!verTodas ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50 border"}`}
              >
                Mis solicitudes
              </button>
              <button
                onClick={() => setVerTodas(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${verTodas ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50 border"}`}
              >
                Todas
              </button>
            </>
          )}
        </div>
        <a
          href="/flota/solicitudes/nueva"
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Nueva solicitud
        </a>
      </div>

      {cargando ? (
        <div className="text-center text-gray-400 py-12">Cargando...</div>
      ) : solicitudes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
          No hay solicitudes registradas
        </div>
      ) : (
        <div className="space-y-3">
          {solicitudes.map((s) => (
            <div
              key={s.id}
              onClick={() => router.push(`/flota/solicitudes/${s.id}`)}
              className="bg-white rounded-xl shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow border border-transparent hover:border-blue-100"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono font-bold text-gray-800">
                      {s.vehiculo.patente}
                    </span>
                    <span className="text-gray-500 text-sm">
                      {s.vehiculo.marca} {s.vehiculo.modelo}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[s.estado]}`}>
                      {s.estado}
                    </span>
                  </div>
                  <p className="text-gray-700 font-medium">{s.destino}</p>
                  <p className="text-gray-500 text-sm">{s.proposito}</p>
                  {verTodas && (
                    <p className="text-gray-400 text-xs mt-1">Conductor: {s.conductorNombre}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400 mb-1">
                    {new Date(s.fechaSolicitud).toLocaleDateString("es-CL")}
                  </p>
                  <p className={`text-xs font-medium ${s.estado === "EN_CURSO" ? "text-green-600" : s.estado === "PENDIENTE" ? "text-yellow-600" : "text-gray-500"}`}>
                    {pasoTexto(s)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}