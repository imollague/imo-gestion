"use client"

import { useEffect, useState } from "react"
import Layout from "@/components/Layout"

interface Usuario {
  id: number
  username: string
  name: string
  role: "ADMIN" | "BODEGA" | "FARMACIA" | "VIEWER"
  roleAnterior: "ADMIN" | "BODEGA" | "FARMACIA" | "VIEWER" | null
  roleExpiration: string | null
  active: boolean
  createdAt: string
}

const ROLES = [
  { value: "ADMIN", label: "Administrador" },
  { value: "BODEGA", label: "Bodega" },
  { value: "FARMACIA", label: "Farmacia" },
  { value: "VIEWER", label: "Solo lectura" },
]

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [exito, setExito] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [usuarioReset, setUsuarioReset] = useState<Usuario | null>(null)
  const [nuevaPassword, setNuevaPassword] = useState("")
  const [errorReset, setErrorReset] = useState("")
  const [guardandoReset, setGuardandoReset] = useState(false)

  // Estado para modal de rol temporal
  const [usuarioRolTemporal, setUsuarioRolTemporal] = useState<Usuario | null>(null)
  const [rolTemporal, setRolTemporal] = useState("")
  const [fechaExpiracion, setFechaExpiracion] = useState("")
  const [esTemporal, setEsTemporal] = useState(false)
  const [guardandoRol, setGuardandoRol] = useState(false)

  const [form, setForm] = useState({
    username: "",
    name: "",
    role: "BODEGA",
    password: "",
  })

  useEffect(() => {
    fetchUsuarios()
  }, [])

  const fetchUsuarios = async () => {
    setLoading(true)
    const res = await fetch("/api/admin/usuarios")
    const data = await res.json()
    setUsuarios(data)
    setLoading(false)
  }

  const handleCrear = async () => {
    setError("")
    setExito("")
    if (!form.username || !form.name || !form.password) {
      setError("Usuario, nombre y contrasena son obligatorios")
      return
    }
    if (form.password.length < 6) {
      setError("La contrasena debe tener al menos 6 caracteres")
      return
    }
    setGuardando(true)
    const res = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || "Error al crear usuario")
      setGuardando(false)
      return
    }
    setExito(`Usuario "${form.name}" creado correctamente`)
    setForm({ username: "", name: "", role: "BODEGA", password: "" })
    setMostrarForm(false)
    fetchUsuarios()
    setGuardando(false)
    setTimeout(() => setExito(""), 3000)
  }

  const handleToggleActivo = async (usuario: Usuario) => {
    const accion = usuario.active ? "desactivar" : "activar"
    if (!confirm(`Desea ${accion} al usuario "${usuario.name}"?`)) return
    const res = await fetch("/api/admin/usuarios", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: usuario.id, active: !usuario.active }),
    })
    if (res.ok) fetchUsuarios()
  }

  const abrirModalRol = (usuario: Usuario) => {
    setUsuarioRolTemporal(usuario)
    setRolTemporal(usuario.role)
    setFechaExpiracion("")
    setEsTemporal(false)
  }

  const handleGuardarRol = async () => {
    if (!usuarioRolTemporal) return
    if (esTemporal && !fechaExpiracion) {
      alert("Debes seleccionar una fecha de expiracion")
      return
    }
    setGuardandoRol(true)
    const res = await fetch("/api/admin/usuarios", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: usuarioRolTemporal.id,
        role: rolTemporal,
        roleExpiration: esTemporal ? fechaExpiracion : null,
      }),
    })
    if (res.ok) {
      setUsuarioRolTemporal(null)
      fetchUsuarios()
      setExito(`Rol de "${usuarioRolTemporal.name}" actualizado correctamente`)
      setTimeout(() => setExito(""), 3000)
    }
    setGuardandoRol(false)
  }

  const handleResetPassword = async () => {
    setErrorReset("")
    if (!nuevaPassword || nuevaPassword.length < 6) {
      setErrorReset("La contrasena debe tener al menos 6 caracteres")
      return
    }
    setGuardandoReset(true)
    const res = await fetch("/api/admin/usuarios", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: usuarioReset!.id, password: nuevaPassword }),
    })
    const data = await res.json()
    if (!res.ok) {
      setErrorReset(data.error || "Error al cambiar contrasena")
      setGuardandoReset(false)
      return
    }
    setGuardandoReset(false)
    setUsuarioReset(null)
    setNuevaPassword("")
    setExito(`Contrasena de "${usuarioReset!.name}" actualizada correctamente`)
    setTimeout(() => setExito(""), 3000)
  }

  const formatFecha = (fecha: string) =>
    new Date(fecha).toLocaleDateString("es-CL", {
      day: "2-digit", month: "2-digit", year: "numeric",
    })

  const rolLabel = (role: string) => ROLES.find((r) => r.value === role)?.label ?? role

  return (
    <Layout titulo="Administracion de Usuarios">
      <div className="max-w-4xl mx-auto space-y-6">

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
        )}
        {exito && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">{exito}</div>
        )}

        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">{usuarios.length} usuario(s) registrado(s)</p>
          <button
            onClick={() => { setMostrarForm(!mostrarForm); setError("") }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {mostrarForm ? "Cancelar" : "+ Nuevo Usuario"}
          </button>
        </div>

        {/* Formulario nuevo usuario */}
        {mostrarForm && (
          <div className="bg-white rounded-lg shadow p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Nuevo usuario</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                <input type="text" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nombre del usuario" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de usuario</label>
                <input type="text" value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Sin espacios ni mayusculas" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contrasena</label>
                <input type="password" value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Minimo 6 caracteres" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <button onClick={handleCrear} disabled={guardando}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {guardando ? "Creando..." : "Crear Usuario"}
            </button>
          </div>
        )}

        {/* Lista de usuarios */}
        {loading ? (
          <p className="text-gray-500 text-sm">Cargando usuarios...</p>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Nombre</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Usuario</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Rol</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Creado</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium">Estado</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuarios.map((u) => (
                  <tr key={u.id} className={`hover:bg-gray-50 ${!u.active ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{u.username}</td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-gray-800 font-medium text-xs">{rolLabel(u.role)}</span>
                        {u.roleAnterior && u.roleExpiration && (
                          <p className="text-xs text-orange-500 mt-0.5">
                            Temporal hasta {formatFecha(u.roleExpiration)}
                            <br />
                            <span className="text-gray-400">Vuelve a: {rolLabel(u.roleAnterior)}</span>
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatFecha(u.createdAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        u.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {u.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-3">
                        <button onClick={() => abrirModalRol(u)}
                          className="text-blue-500 text-xs hover:underline">
                          Cambiar rol
                        </button>
                        <button
                          onClick={() => { setUsuarioReset(u); setNuevaPassword(""); setErrorReset("") }}
                          className="text-blue-500 text-xs hover:underline">
                          Cambiar contrasena
                        </button>
                        <button onClick={() => handleToggleActivo(u)}
                          className={`text-xs hover:underline ${u.active ? "text-red-500" : "text-green-600"}`}>
                          {u.active ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal cambiar rol */}
      {usuarioRolTemporal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Cambiar rol</h3>
            <p className="text-sm text-gray-500">Usuario: <span className="font-medium">{usuarioRolTemporal.name}</span></p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo rol</label>
              <select value={rolTemporal} onChange={(e) => setRolTemporal(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="esTemporal" checked={esTemporal}
                onChange={(e) => setEsTemporal(e.target.checked)}
                className="rounded border-gray-300" />
              <label htmlFor="esTemporal" className="text-sm text-gray-700">Es un cambio temporal (subrogancia)</label>
            </div>

            {esTemporal && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de retorno al rol original</label>
                <input type="date" value={fechaExpiracion}
                  onChange={(e) => setFechaExpiracion(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {usuarioRolTemporal.roleAnterior && (
                  <p className="text-xs text-gray-400 mt-1">
                    Rol original: {rolLabel(usuarioRolTemporal.roleAnterior)}
                  </p>
                )}
                <p className="text-xs text-orange-500 mt-1">
                  El sistema revertira automaticamente el rol al original en esa fecha
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={handleGuardarRol} disabled={guardandoRol}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {guardandoRol ? "Guardando..." : "Guardar"}
              </button>
              <button onClick={() => setUsuarioRolTemporal(null)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal reset contrasena */}
      {usuarioReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Cambiar contrasena</h3>
            <p className="text-sm text-gray-500 mb-4">Usuario: <span className="font-medium">{usuarioReset.name}</span></p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contrasena</label>
              <input type="password" value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Minimo 6 caracteres" />
            </div>
            {errorReset && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm mb-4">{errorReset}</div>
            )}
            <div className="flex gap-3">
              <button onClick={handleResetPassword} disabled={guardandoReset || !nuevaPassword}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {guardandoReset ? "Guardando..." : "Guardar contrasena"}
              </button>
              <button onClick={() => setUsuarioReset(null)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}