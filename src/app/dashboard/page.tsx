import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) redirect("/login")

  const role = session.user.role

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Sistema IMO</h1>
          <p className="text-xs text-gray-500">Municipalidad de Ollagüe</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {session.user.name} — <span className="font-medium">{role}</span>
          </span>
          <a href="/api/auth/signout" className="text-sm text-red-500 hover:underline">
            Cerrar sesión
          </a>
        </div>
      </nav>

      <main className="p-6 max-w-4xl mx-auto">
        <h2 className="text-xl font-semibold text-gray-700 mb-6">
          Bienvenido, {session.user.name}
        </h2>

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
            <a
              href="/dashboard/stats"
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow border-l-4 border-yellow-500"
            >
              <h3 className="text-lg font-semibold text-gray-800">Estadisticas</h3>
              <p className="text-gray-500 text-sm mt-1">Graficos y resumen general</p>
            </a>
          )}

          {role === "ADMIN" && (
            <a href="/admin/usuarios" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow border-l-4 border-purple-500">
              <h3 className="text-lg font-semibold text-gray-800">Administración</h3>
              <p className="text-gray-500 text-sm mt-1">Gestión de usuarios y configuración</p>
            </a>
          )}
        </div>
      </main>
    </div>
  )
}