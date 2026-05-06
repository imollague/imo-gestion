"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import Layout from "@/components/Layout"

interface Vehiculo {
  id: number
  patente: string
  marca: string
  modelo: string
  anio: number
  tipo: string
  estado: string
  kmActual: number
  vencimientoSOAP: string | null
  vencimientoRevTecnica: string | null
  vencimientoPermiso: string | null
  observaciones: string | null
  hojaVida: { id: number; tipo: string; descripcion: string; fecha: string; usuario: { name: string } }[]
  documentos: { id: number; nombre: string; tipo: string; url: string; fecha: string; subidoPor: { name: string } }[]
  solicitudes: { id: number; estado: string; destino: string; conductorNombre: string; fechaSolicitud: string }[]
}

const ESTADO_COLOR: Record<string, string> = {
  OPERATIVO: "bg-green-100 text-green-700",
  EN_MANTENCION: "bg-yellow-100 text-yellow-700",
  FUERA_SERVICIO: "bg-red-100 text-red-700",
  DADO_DE_BAJA: "bg-gray-100 text-gray-500",
}

const TIPO_HOJA: Record<string, string> = {
  USO: "🚗",
  MANTENCION: "🔧",
  CORRECCION: "✏️",
  ALERTA: "⚠️",
  DOCUMENTO: "📄",
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function DocVencimiento({ label, fecha }: { label: string; fecha: string | null }) {
  if (!fecha) return <div className="text-sm text-gray-400">{label}: no registrado</div>
  const dias = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
  const color = dias < 0 ? "text-red-600 font-semibold" : dias <= 15 ? "text-red-500" : dias <= 30 ? "text-yellow-600" : "text-green-600"
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={color}>
        {fmtFecha(fecha)} {dias < 0 ? "(VENCIDO)" : dias <= 30 ? `(${dias} días)` : "✓"}
      </span>
    </div>
  )
}

export default function VehiculoDetallePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetch(`/api/flota/vehiculos/${id}`)
        .then((r) => r.json())
        .then((d) => { setVehiculo(d); setCargando(false) })
    }
  }, [session, id])

  const role = session?.user?.role

  if (cargando) return <Layout titulo="Vehículo"><div className="text-gray-400 p-8">Cargando...</div></Layout>
  if (!vehiculo) return <Layout titulo="Vehículo"><div className="text-gray-400 p-8">No encontrado</div></Layout>

  return (
    <Layout titulo={`${vehiculo.patente} — ${vehiculo.marca} ${vehiculo.modelo}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Columna izquierda: ficha + documentos */}
        <div className="lg:col-span-1 space-y-4">

          {/* Ficha del vehículo */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-2xl font-mono font-bold text-gray-800">{vehiculo.patente}</p>
                <p className="text-gray-600">{vehiculo.marca} {vehiculo.modelo} {vehiculo.anio}</p>
                <p className="text-gray-400 text-sm capitalize">{vehiculo.tipo.replace(/_/g, " ").toLowerCase()}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${ESTADO_COLOR[vehiculo.estado]}`}>
                {vehiculo.estado.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              <span className="font-medium">Kilometraje:</span> {vehiculo.kmActual.toLocaleString()} km
            </p>
            {vehiculo.observaciones && (
              <p className="text-sm text-gray-500 italic">{vehiculo.observaciones}</p>
            )}
            {(role === "ADMIN" || role === "FLOTA") && (
              <a
                href={`/flota/vehiculos/${vehiculo.id}/editar`}
                className="mt-4 block text-center text-sm text-blue-600 hover:underline"
              >
                Editar vehículo
              </a>
            )}
          </div>

          {/* Documentación */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="font-medium text-gray-700 mb-3">Documentación</p>
            <div className="space-y-2">
              <DocVencimiento label="SOAP" fecha={vehiculo.vencimientoSOAP} />
              <DocVencimiento label="Revisión técnica" fecha={vehiculo.vencimientoRevTecnica} />
              <DocVencimiento label="Permiso circulación" fecha={vehiculo.vencimientoPermiso} />
            </div>
          </div>

          {/* Archivos adjuntos */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="font-medium text-gray-700 mb-3">Archivos adjuntos</p>
            {vehiculo.documentos.length === 0 ? (
              <p className="text-sm text-gray-400">Sin archivos adjuntos</p>
            ) : (
              <ul className="space-y-2">
                {vehiculo.documentos.map((d) => (
                  <li key={d.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{d.nombre}</p>
                      <p className="text-xs text-gray-400">{d.tipo} · {fmtFecha(d.fecha)}</p>
                    </div>
                    <a href={d.url} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 text-xs hover:underline">
                      Ver
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Columna derecha: hoja de vida + solicitudes recientes */}
        <div className="lg:col-span-2 space-y-4">

          {/* Últimas solicitudes */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="font-medium text-gray-700 mb-3">Últimos usos</p>
            {vehiculo.solicitudes.length === 0 ? (
              <p className="text-sm text-gray-400">Sin solicitudes registradas</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-400 uppercase">
                  <tr>
                    <th className="text-left pb-2">Fecha</th>
                    <th className="text-left pb-2">Conductor</th>
                    <th className="text-left pb-2">Destino</th>
                    <th className="text-left pb-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {vehiculo.solicitudes.map((s) => (
                    <tr key={s.id}
                      onClick={() => router.push(`/flota/solicitudes/${s.id}`)}
                      className="cursor-pointer hover:bg-gray-50">
                      <td className="py-2 text-gray-500">{fmtFecha(s.fechaSolicitud)}</td>
                      <td className="py-2 text-gray-700">{s.conductorNombre}</td>
                      <td className="py-2 text-gray-700">{s.destino}</td>
                      <td className="py-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {s.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Hoja de vida */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="font-medium text-gray-700 mb-4">Hoja de vida</p>
            {vehiculo.hojaVida.length === 0 ? (
              <p className="text-sm text-gray-400">Sin registros en hoja de vida</p>
            ) : (
              <ol className="relative border-l border-gray-200 ml-3 space-y-4">
                {vehiculo.hojaVida.map((h) => (
                  <li key={h.id} className="ml-4">
                    <span className="absolute -left-2.5 flex h-5 w-5 items-center justify-center text-sm">
                      {TIPO_HOJA[h.tipo] ?? "•"}
                    </span>
                    <p className="text-sm text-gray-800">{h.descripcion}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {fmtFecha(h.fecha)} · {h.usuario.name}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:underline">
          ← Volver
        </button>
      </div>
    </Layout>
  )
}