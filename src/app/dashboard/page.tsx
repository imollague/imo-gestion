"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import Layout from "@/components/Layout"

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  if (status === "loading" || !session) return null

  const role = session.user.role

  return (
    <Layout titulo="Inicio">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(role === "ADMIN" || role === "BODEGA" || role === "VIEWER") && (
          <a href="/bodega" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow border-l-4 border-blue-500">
            <h3 className="text-lg font-semibold text-gray-800">Bodega Municipal</h3>
            <p className="text-gray-500 text-sm mt-1">Gestión de inventario y movimientos</p>
          </a>
        )}

        {(role === "ADMIN" || role === "FARMACIA" || role === "VIEWER") && (
          <a href="/farmacia" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow border-l-4 border-green-500">
            <h3 className="text-lg font-semibold text-gray-800">Farmacia Posta Rural</h3>
            <p className="text-gray-500 text-sm mt-1">Gestión de medicamentos y despachos</p>
          </a>
        )}

        {(role === "ADMIN" || role === "BODEGA" || role === "FARMACIA" || role === "VIEWER") && (
          <a href="/dashboard/stats" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow border-l-4 border-yellow-500">
            <h3 className="text-lg font-semibold text-gray-800">Estadisticas</h3>
            <p className="text-gray-500 text-sm mt-1">Graficos y resumen general</p>
          </a>
        )}

        {(role === "ADMIN" || role === "FLOTA" || role === "ENCARGADO") && (
          <a href="/flota" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow border-l-4 border-orange-500">
            <h3 className="text-lg font-semibold text-gray-800">Flota Municipal</h3>
            <p className="text-gray-500 text-sm mt-1">Gestión de vehículos y solicitudes de uso</p>
          </a>
        )}

        {role === "ADMIN" && (
          <a href="/admin/usuarios" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow border-l-4 border-purple-500">
            <h3 className="text-lg font-semibold text-gray-800">Administración</h3>
            <p className="text-gray-500 text-sm mt-1">Gestión de usuarios y configuración</p>
          </a>
        )}
      </div>
    </Layout>
  )
}