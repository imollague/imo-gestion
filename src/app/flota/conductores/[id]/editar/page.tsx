"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import Layout from "@/components/Layout"
import { TIPOS_LICENCIA } from "@/lib/licencias"

interface UsuarioFlota { id: number; name: string; username: string }

function toDateInput(iso: string | null) {
  if (!iso) return ""
  return iso.split("T")[0]
}

export default function EditarConductorPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [usuarios, setUsuarios] = useState<UsuarioFlota[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    nombre: "", rut: "", numeroCaucion: "", numeroLicencia: "",
    tipoLicencia: "", fechaLicencia: "", userId: "",
  })

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    fetch("/api/flota/conductores/usuarios-flota").then((r) => r.json()).then(setUsuarios)
  }, [])

  useEffect(() => {
    if (session) {
      fetch(`/api/flota/conductores/${id}`)
        .then((r) => r.json())
        .then((c) => setForm({
          nombre: c.nombre ?? "",
          rut: c.rut ?? "",
          numeroCaucion: c.numeroCaucion ?? "",
          numeroLicencia: c.numeroLicencia ?? "",
          tipoLicencia: c.tipoLicencia ?? "",
          fechaLicencia: toDateInput(c.fechaLicencia),
          userId: c.user?.id ? String(c.user.id) : "",
        }))
    }
  }, [session, id])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    setError("")
    setLoading(true)
    const res = await fetch(`/api/flota/conductores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, fechaLicencia: form.fechaLicencia || null, userId: form.userId || null }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error || "Error al actualizar")
      return
    }
    router.push("/flota/conductores")
  }

  const handleDesactivar = async () => {
    if (!confirm("¿Desactivar este conductor? Quedará oculto del listado pero sus solicitudes se conservan.")) return
    const res = await fetch(`/api/flota/conductores/${id}`, { method: "DELETE" })
    if (res.ok) router.push("/flota/conductores")
  }

  return (
    <Layout titulo="Editar Conductor">
      <div className="max-w-xl">
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input value={form.nombre} onChange={(e) => set("nombre", e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RUT</label>
              <input value={form.rut} onChange={(e) => set("rut", e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">N° de caución</label>
              <input value={form.numeroCaucion} onChange={(e) => set("numeroCaucion", e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">N° de licencia</label>
              <input value={form.numeroLicencia} onChange={(e) => set("numeroLicencia", e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de licencia *</label>
              <select value={form.tipoLicencia} onChange={(e) => set("tipoLicencia", e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {TIPOS_LICENCIA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de la licencia</label>
            <input type="date" value={form.fechaLicencia} onChange={(e) => set("fechaLicencia", e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Vincular a cuenta de usuario</label>
            <p className="text-xs text-gray-400 mb-2">Si se vincula, el sistema detecta automáticamente al conductor cuando esa cuenta inicia sesión.</p>
            <select value={form.userId} onChange={(e) => set("userId", e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">Sin vincular</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.username})</option>)}
            </select>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={handleSubmit} disabled={loading}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? "Guardando..." : "Guardar cambios"}
            </button>
            <button onClick={() => router.back()}
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
              Cancelar
            </button>
            <button onClick={handleDesactivar}
              className="ml-auto text-sm text-red-500 hover:text-red-700 hover:underline">
              Desactivar
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
