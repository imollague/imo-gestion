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
  vehiculosDocVencidos: number
  vehiculosDocPorVencer: number
  total: number
}

export default function Layout({ children, titulo }: LayoutProps) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [alertas, setAlertas] = useState<Alertas | null>(null)
  const [mostrarAlertas, setMostrarAlertas] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const alertasRef = useRef<HTMLDivElement>(null)

  const role = session?.user?.role
  const cargando = status === "loading"
  const puedeVerFlota = role === "ADMIN" || role === "FLOTA" || role === "ENCARGADO"
  const totalAlertas = alertas
    ? alertas.productosStockBajo + alertas.medicamentosStockBajo + alertas.medicamentosPorVencer +
      (puedeVerFlota ? alertas.vehiculosDocVencidos + alertas.vehiculosDocPorVencer : 0)
    : 0

  const navLinks = [
    { href: "/dashboard", label: "Inicio", roles: null },
    { href: "/bodega", label: "Bodega", roles: ["ADMIN", "BODEGA", "VIEWER"] },
    { href: "/farmacia", label: "Farmacia", roles: ["ADMIN", "FARMACIA", "VIEWER"] },
    { href: "/farmacia/pacientes", label: "Pacientes", roles: ["ADMIN", "FARMACIA"] },
    { href: "/dashboard/stats", label: "Estadisticas", roles: null },
    { href: "/flota", label: "Flota", roles: ["ADMIN", "FLOTA", "ENCARGADO"] },
    { href: "/flota/solicitudes", label: "Solicitudes", roles: ["FLOTA", "ENCARGADO"] },
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

  // Cerrar menú móvil al navegar
  useEffect(() => { setMenuAbierto(false) }, [pathname])

  const fetchAlertas = async () => {
    try {
      const res = await fetch("/api/alertas")
      const data = await res.json()
      setAlertas(data)
    } catch {}
  }

  const linkVisible = (roles: string[] | null) => {
    if (cargando) return true
    if (roles === null) return true
    return roles.includes(role ?? "")
  }

  const esActivo = (href: string) =>
    href !== "/dashboard" ? pathname.startsWith(href) : pathname === href

  const linksVisibles = navLinks.filter((l) => linkVisible(l.roles))

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm relative z-40">
        {/* Barra principal */}
        <div className="px-4 py-3 flex items-center justify-between">

          {/* Izquierda: logo + título */}
          <div className="flex items-center gap-3">
            <img src="/brand_logo.png" alt="logo" width={48} className="shrink-0" />
            <div>
              <p className="text-sm font-bold text-gray-800 leading-tight">Sistema IMO</p>
              <p className="text-xs text-gray-400 hidden sm:block">Municipalidad de Ollagüe</p>
            </div>
          </div>

          {/* Centro: links de navegación (solo desktop) */}
          <div className="hidden md:flex items-center gap-1">
            {linksVisibles.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  esActivo(l.href) ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* Derecha: campana + usuario + cerrar sesión + hamburger */}
          <div className="flex items-center gap-2">

            {/* Campana */}
            {alertas && totalAlertas > 0 && (
              <div className="relative" ref={alertasRef}>
                <button
                  onClick={() => setMostrarAlertas(!mostrarAlertas)}
                  className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {totalAlertas > 9 ? "9+" : totalAlertas}
                  </span>
                </button>

                {mostrarAlertas && (
                  <div className="absolute right-0 top-10 w-72 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
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
                      {puedeVerFlota && alertas.vehiculosDocVencidos > 0 && (
                        <a href="/flota" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                          <div>
                            <p className="text-sm text-gray-800 font-medium">
                              {alertas.vehiculosDocVencidos} vehículo{alertas.vehiculosDocVencidos > 1 ? "s" : ""} con documentos vencidos
                            </p>
                            <p className="text-xs text-gray-400">Flota Municipal</p>
                          </div>
                        </a>
                      )}
                      {puedeVerFlota && alertas.vehiculosDocPorVencer > 0 && (
                        <a href="/flota" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                          <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
                          <div>
                            <p className="text-sm text-gray-800 font-medium">
                              {alertas.vehiculosDocPorVencer} vehículo{alertas.vehiculosDocPorVencer > 1 ? "s" : ""} con doc. por vencer
                            </p>
                            <p className="text-xs text-gray-400">Flota Municipal</p>
                          </div>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Usuario + cerrar sesión (solo desktop) */}
            <span className="hidden md:inline text-sm text-gray-600">
              {session?.user?.name}{" "}
              <span className="text-xs text-gray-400">({role})</span>
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="hidden md:inline text-sm text-red-500 hover:underline"
            >
              Cerrar sesion
            </button>

            {/* Hamburger (solo móvil) */}
            <button
              onClick={() => setMenuAbierto(!menuAbierto)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Menú"
            >
              {menuAbierto ? (
                <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Menú móvil desplegable */}
        {menuAbierto && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
            {linksVisibles.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                  esActivo(l.href) ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {l.label}
              </a>
            ))}
            <div className="border-t border-gray-100 pt-3 mt-2">
              <p className="px-4 py-1 text-sm text-gray-500">
                {session?.user?.name} · <span className="text-gray-400">{role}</span>
              </p>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full text-left px-4 py-3 rounded-lg text-base font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        )}
      </nav>

      <main className="p-4 md:p-6 max-w-6xl mx-auto">
        <h2 className="text-xl font-semibold text-gray-700 mb-6">{titulo}</h2>
        {children}
      </main>
    </div>
  )
}