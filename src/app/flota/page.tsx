"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Layout from "@/components/Layout"

interface VencimientoDoc {
  dias: number
  alerta: boolean
  tipoDocumento: { nombre: string }
}

interface Vehiculo {
  id: number
  patente: string
  marca: string
  modelo: string
  anio: number
  tipo: string
  estado: string
  kmActual: number
  vencimientos: VencimientoDoc[]
  alertaDoc: boolean
  enUso: boolean
}

const TIPO_LABEL: Record<string, string> = {
  CAMIONETA: "Camioneta",
  SEDAN: "Sedán",
  CAMION: "Camión",
  CAMION_LIVIANO: "Camión",
  CAMION_PESADO: "Camión",
  MAQUINARIA: "Maquinaria",
  BUS: "Bus / Minibus",
  OTRO: "Otro",
}

const ESTADO_LABEL: Record<string, string> = {
  OPERATIVO: "Operativo",
  EN_MANTENCION: "En mantención",
  FUERA_SERVICIO: "Fuera de servicio",
  DADO_DE_BAJA: "Dado de baja",
}

const ESTADO_COLOR: Record<string, string> = {
  OPERATIVO: "bg-green-100 text-green-700",
  EN_MANTENCION: "bg-yellow-100 text-yellow-700",
  FUERA_SERVICIO: "bg-red-100 text-red-700",
  DADO_DE_BAJA: "bg-gray-100 text-gray-500",
}

function BadgeDias({ dias, label }: { dias: number; label: string }) {
  const color = dias < 0 ? "text-red-600 font-semibold" : dias <= 15 ? "text-red-500" : dias <= 30 ? "text-yellow-600" : "text-gray-400"
  const texto = dias < 0 ? `${label}: VENCIDO` : `${label}: ${dias}d`
  return <span className={`text-xs ${color}`}>{texto}</span>
}

export default function FlotaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetch("/api/flota/vehiculos")
        .then((r) => { if (!r.ok) throw new Error(); return r.json() })
        .then((d) => { setVehiculos(d); setCargando(false) })
        .catch(() => { setCargando(false) })
    }
  }, [session])

  const filtrados = vehiculos.filter((v) =>
    [v.patente, v.marca, v.modelo].some((f) =>
      f.toLowerCase().includes(busqueda.toLowerCase())
    )
  )

  const alertas = vehiculos.filter((v) => v.alertaDoc)
  const enUso = vehiculos.filter((v) => v.enUso).length
  const operativos = vehiculos.filter((v) => v.estado === "OPERATIVO" && !v.enUso).length

  const role = session?.user?.role

  return (
    <Layout titulo="Flota Municipal">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-blue-500">
          <p className="text-2xl font-bold text-gray-800">{vehiculos.length}</p>
          <p className="text-sm text-gray-500">Total vehículos</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-green-500">
          <p className="text-2xl font-bold text-gray-800">{operativos}</p>
          <p className="text-sm text-gray-500">Disponibles</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-yellow-500">
          <p className="text-2xl font-bold text-gray-800">{enUso}</p>
          <p className="text-sm text-gray-500">En uso</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-red-500">
          <p className="text-2xl font-bold text-gray-800">{alertas.length}</p>
          <p className="text-sm text-gray-500">Alertas doc.</p>
        </div>
      </div>

      {/* Alertas documentales */}
      {alertas.length > 0 && (
        <div className="mb-6 space-y-2">
          {alertas.map((v) => (
            <div key={v.id} className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 flex items-center gap-3">
              <span className="text-red-500 text-lg">⚠</span>
              <span className="font-medium text-red-700">{v.patente}</span>
              <span className="text-red-600 text-sm">{v.marca} {v.modelo}</span>
              <div className="flex gap-3 ml-auto">
                {v.vencimientos.filter((ve) => ve.alerta).map((ve, i) => (
                  <BadgeDias key={i} dias={ve.dias} label={ve.tipoDocumento.nombre} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center justify-between mb-4">
        <input
          type="text"
          placeholder="Buscar por patente, marca o modelo..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <div className="flex gap-2">
          <a
            href="/flota/solicitudes"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {(role === "ADMIN" || role === "ENCARGADO") ? "Solicitudes" : "Mis solicitudes"}
          </a>
          {(role === "ADMIN" || role === "ENCARGADO") && (
            <a
              href="/flota/vehiculos/nuevo"
              className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 transition-colors"
            >
              + Vehículo
            </a>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm overflow-scroll">
        {cargando ? (
          <div className="p-12 text-center text-gray-400">Cargando vehículos...</div>
        ) : filtrados.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No hay vehículos registrados</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Patente</th>
                <th className="text-left px-4 py-3">Vehículo</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="text-left px-4 py-3">Km actual</th>
                <th className="text-left px-4 py-3">Documentos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => router.push(`/flota/vehiculos/${v.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono font-semibold text-gray-800">{v.patente}</td>
                  <td className="px-4 py-3 text-gray-700">{v.marca} {v.modelo} <span className="text-gray-400">{v.anio}</span></td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{TIPO_LABEL[v.tipo] ?? v.tipo}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[v.estado]}`}>
                      {v.enUso ? "En uso" : ESTADO_LABEL[v.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{v.kmActual.toLocaleString()} km</td>
                  <td className="px-4 py-3">
                    {v.alertaDoc ? (
                      <div className="flex flex-col gap-0.5">
                        {v.vencimientos.filter((ve) => ve.alerta).map((ve, i) => (
                          <BadgeDias key={i} dias={ve.dias} label={ve.tipoDocumento.nombre} />
                        ))}
                      </div>
                    ) : (
                      <span className="text-green-500 text-xs">✓ Al día</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}