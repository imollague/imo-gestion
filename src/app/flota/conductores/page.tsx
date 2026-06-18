"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Layout from "@/components/Layout"

interface Conductor {
  id: number
  nombre: string
  rut: string | null
  numeroLicencia: string | null
  tipoLicencia: string
  fechaLicencia: string | null
  user: { id: number; name: string; username: string } | null
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL")
}

export default function ConductoresPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [conductores, setConductores] = useState<Conductor[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetch("/api/flota/conductores")
        .then((r) => r.json())
        .then((d) => { setConductores(d); setCargando(false) })
    }
  }, [session])

  const role = session?.user?.role
  if (role && role !== "ADMIN" && role !== "ENCARGADO") {
    return <Layout titulo="Conductores"><div className="text-gray-400 p-8">Sin permisos para ver esta página.</div></Layout>
  }

  return (
    <Layout titulo="Conductores">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Registro de choferes habilitados y su tipo de licencia.</p>
        <a href="/flota/conductores/nuevo"
          className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 transition-colors">
          + Conductor
        </a>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {cargando ? (
          <div className="p-12 text-center text-gray-400">Cargando...</div>
        ) : conductores.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Sin conductores registrados</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Nombre</th>
                <th className="text-left px-4 py-3">RUT</th>
                <th className="text-left px-4 py-3">Licencia</th>
                <th className="text-left px-4 py-3">Vencimiento</th>
                <th className="text-left px-4 py-3">Cuenta vinculada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {conductores.map((c) => (
                <tr key={c.id}
                  onClick={() => router.push(`/flota/conductores/${c.id}/editar`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{c.nombre}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono">{c.rut ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {c.tipoLicencia}
                    </span>
                    {c.numeroLicencia && <span className="text-gray-400 text-xs ml-2">{c.numeroLicencia}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.fechaLicencia ? fmtFecha(c.fechaLicencia) : "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{c.user ? c.user.name : <span className="text-gray-300">Sin vincular</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}
