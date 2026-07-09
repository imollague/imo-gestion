"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Layout from "@/components/Layout"

interface TipoDocumento {
  id: number
  nombre: string
  diasAlertaDefault: number
  esDefault: boolean
}

export default function DocumentosConfigPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tipos, setTipos] = useState<TipoDocumento[]>([])
  const [cargando, setCargando] = useState(true)
  const [nombre, setNombre] = useState("")
  const [dias, setDias] = useState("30")
  const [error, setError] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const cargar = () => {
    fetch("/api/flota/tipos-documento").then((r) => r.json()).then((d) => { setTipos(d); setCargando(false) })
  }

  useEffect(() => { if (session) cargar() }, [session])

  const role = session?.user?.role
  if (role && role !== "ADMIN" && role !== "ENCARGADO") {
    return <Layout titulo="Documentos"><div className="text-gray-400 p-8">Sin permisos para ver esta página.</div></Layout>
  }

  const crear = async () => {
    setError("")
    if (!nombre.trim()) { setError("El nombre es obligatorio"); return }
    const res = await fetch("/api/flota/tipos-documento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, diasAlertaDefault: dias }),
    })
    if (!res.ok) { const d = await res.json(); setError(d.error); return }
    setNombre(""); setDias("30")
    cargar()
  }

  const actualizarDias = async (id: number, diasAlertaDefault: string) => {
    await fetch(`/api/flota/tipos-documento/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diasAlertaDefault }),
    })
    cargar()
  }

  const eliminar = async (id: number) => {
    if (!confirm("¿Eliminar este tipo de documento? Los vencimientos ya registrados con este tipo no se verán afectados.")) return
    await fetch(`/api/flota/tipos-documento/${id}`, { method: "DELETE" })
    cargar()
  }

  return (
    <Layout titulo="Tipos de Documento">
      <p className="text-sm text-gray-500 mb-4">
        Catálogo de documentos que pueden asignarse a un vehículo y el plazo de aviso antes del vencimiento.
      </p>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        {cargando ? (
          <div className="p-12 text-center text-gray-400">Cargando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Nombre</th>
                <th className="text-left px-4 py-3">Días de alerta</th>
                <th className="text-left px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tipos.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 text-gray-800">
                    {t.nombre}
                    {t.esDefault && <span className="ml-2 text-xs text-gray-400">(por defecto)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number" inputMode="numeric" defaultValue={t.diasAlertaDefault}
                      onBlur={(e) => actualizarDias(t.id, e.target.value)}
                      className="w-20 border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    /> días
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!t.esDefault && (
                      <button onClick={() => eliminar(t.id)} className="text-red-400 hover:text-red-600 text-xs">
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5 max-w-md">
        <p className="font-medium text-gray-700 mb-3">Agregar tipo de documento</p>
        <div className="flex gap-3">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Extintor"
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <input
            type="number" inputMode="numeric" value={dias}
            onChange={(e) => setDias(e.target.value)}
            className="w-20 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button onClick={crear}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            Agregar
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>
    </Layout>
  )
}
