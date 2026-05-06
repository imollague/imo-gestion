"use client"

import { useSession, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import { useEffect, useState, useRef } from "react"

interface LayoutProps {
  children: React.ReactNode
  titulo: string
}

interface Alertas {
  productosStockBajo: number
  medicamentosStockBajo: number
  medicamentosPorVencer: number
  total: number
}

export default function Layout({ children, titulo }: LayoutProps) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [alertas, setAlertas] = useState<Alertas | null>(null)
  const [mostrarAlertas, setMostrarAlertas] = useState(false)
  const alertasRef = useRef<HTMLDivElement>(null)

  const role = session?.user?.role
  const cargando = status === "loading"

  // Todos los links posibles, con su rol requerido (null = todos)
  const navLinks = [
    { href: "/dashboard", label: "Inicio", roles: null },
    { href: "/bodega", label: "Bodega", roles: ["ADMIN", "BODEGA", "VIEWER"] },
    { href: "/farmacia", label: "Farmacia", roles: ["ADMIN", "FARMACIA", "VIEWER"] },
    { href: "/farmacia/pacientes", label: "Pacientes", roles: ["ADMIN", "FARMACIA"] },
    { href: "/dashboard/stats", label: "Estadisticas", roles: null },
    { href: "/flota", label: "Flota", roles: ["ADMIN", "FLOTA"] },
    { href: "/flota/solicitudes", label: "Mis Solicitudes", roles: ["FLOTA"] },
    { href: "/admin/usuarios", label: "Usuarios", roles: ["ADMIN"] },
    { href: "/admin/actividad", label: "Actividad", roles: ["ADMIN"] },
  ]

  useEffect(() => {
    if (session) fetchAlertas()
  }, [session])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (alertasRef.current && !alertasRef.current.contains(e.target as Node)) {
        setMostrarAlertas(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const fetchAlertas = async () => {
    try {
      const res = await fetch("/api/alertas")
      const data = await res.json()
      setAlertas(data)
    } catch {}
  }

  const linkHabilitado = (roles: string[] | null) => {
    if (cargando) return false
    if (roles === null) return true
    return roles.includes(role ?? "")
  }

  const linkVisible = (roles: string[] | null) => {
    // Durante carga mostrar todos, luego filtrar por rol
    if (cargando) return true
    if (roles === null) return true
    return roles.includes(role ?? "")
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <img src="/brand_logo.png" alt="brand logo" width={64} />
            <div>
              <h1 className="text-base font-bold text-gray-800">Sistema IMO</h1>
              <p className="text-xs text-gray-400">Municipalidad de Ollagüe</p>
            </div>
            <div className="flex gap-2">
              {navLinks
                .filter((l) => linkVisible(l.roles))
                .map((l) => {
                  const habilitado = linkHabilitado(l.roles)
                  const activo = l.href !== "/dashboard"
                    ? pathname.startsWith(l.href)
                    : pathname === l.href

                  return habilitado ? (
                    <a
                      key={l.href}
                      href={l.href}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        activo
                          ? "bg-blue-100 text-blue-700"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {l.label}
                    </a>
                  ) : (
                    <span
                      key={l.href}
                      className="px-3 py-1.5 rounded text-sm font-medium text-gray-300 cursor-not-allowed select-none"
                      title="Cargando..."
                    >
                      {l.label}
                    </span>
                  )
                })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Campana de alertas */}
            {alertas && alertas.total > 0 && (
              <div className="relative" ref={alertasRef}>
                <button
                  onClick={() => setMostrarAlertas(!mostrarAlertas)}
                  className="relative p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Alertas de stock"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {alertas.total > 9 ? "9+" : alertas.total}
                  </span>
                </button>

                {mostrarAlertas && (
                  <div className="absolute right-0 top-9 w-72 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b bg-gray-50">
                      <p className="text-sm font-semibold text-gray-700">Alertas activas</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {alertas.productosStockBajo > 0 && (
                        <a href="/bodega" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                          <div>
                            <p className="text-sm text-gray-800 font-medium">
                              {alertas.productosStockBajo} producto{alertas.productosStockBajo > 1 ? "s" : ""} con stock bajo
                            </p>
                            <p className="text-xs text-gray-400">Bodega Municipal</p>
                          </div>
                        </a>
                      )}
                      {alertas.medicamentosStockBajo > 0 && (
                        <a href="/farmacia" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                          <div>
                            <p className="text-sm text-gray-800 font-medium">
                              {alertas.medicamentosStockBajo} medicamento{alertas.medicamentosStockBajo > 1 ? "s" : ""} con stock bajo
                            </p>
                            <p className="text-xs text-gray-400">Farmacia Posta Rural</p>
                          </div>
                        </a>
                      )}
                      {alertas.medicamentosPorVencer > 0 && (
                        <a href="/farmacia/movimientos" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                          <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
                          <div>
                            <p className="text-sm text-gray-800 font-medium">
                              {alertas.medicamentosPorVencer} lote{alertas.medicamentosPorVencer > 1 ? "s" : ""} por vencer en 30 dias
                            </p>
                            <p className="text-xs text-gray-400">Farmacia Posta Rural</p>
                          </div>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <span className="text-sm text-gray-600">
              {cargando ? (
                <span className="text-gray-300">Cargando...</span>
              ) : (
                <>
                  {session?.user?.name}{" "}
                  <span className="text-xs text-gray-400">({role})</span>
                </>
              )}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-sm text-red-500 hover:underline"
            >
              Cerrar sesion
            </button>
          </div>
        </div>
      </nav>

      <main className="p-6 max-w-6xl mx-auto">
        <h2 className="text-xl font-semibold text-gray-700 mb-6">{titulo}</h2>
        {children}
      </main>
    </div>
  )
}