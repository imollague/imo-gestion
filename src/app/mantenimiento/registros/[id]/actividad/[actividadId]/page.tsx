"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import Layout from "@/components/Layout"
import { comprimirImagen } from "@/lib/comprimirImagen"

interface Campo {
  id: number
  descripcion: string
  tipo: "TEXTO" | "FECHA_HORA" | "NUMERO"
  requiereImagen: boolean
  valorMin: number | null
  valorMax: number | null
}

interface Actividad {
  id: number
  nombre: string
  campos: Campo[]
}

interface BloqueExistente {
  id: number
  observaciones: string | null
  respuestas: { campoId: number; valor: string; imagenUrl: string | null }[]
}

export default function AgregarBloquePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { id, actividadId } = useParams<{ id: string; actividadId: string }>()
  const searchParams = useSearchParams()
  const bloqueIdEditar = searchParams.get("editar")

  const [actividad, setActividad] = useState<Actividad | null>(null)
  const [cargando, setCargando] = useState(true)
  const [valores, setValores] = useState<Record<number, string>>({})
  const [imagenesExistentes, setImagenesExistentes] = useState<Record<number, string>>({})
  const [imagenes, setImagenes] = useState<Record<number, File>>({})
  const [observaciones, setObservaciones] = useState("")
  const [hallazgo, setHallazgo] = useState("")
  const [mostrarHallazgo, setMostrarHallazgo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if (!session) return
    fetch("/api/mantenimiento/actividades")
      .then((r) => r.json())
      .then(async (lista: Actividad[]) => {
        const act = lista.find((a) => a.id === parseInt(actividadId)) ?? null
        setActividad(act)

        if (bloqueIdEditar) {
          const res = await fetch(`/api/mantenimiento/registros/${id}`)
          const data = await res.json()
          const bloque: BloqueExistente | undefined = data.registro.bloques.find(
            (b: { id: number }) => b.id === parseInt(bloqueIdEditar)
          )
          if (bloque) {
            setObservaciones(bloque.observaciones ?? "")
            const vals: Record<number, string> = {}
            const imgs: Record<number, string> = {}
            for (const r of bloque.respuestas) {
              vals[r.campoId] = r.valor
              if (r.imagenUrl) imgs[r.campoId] = r.imagenUrl
            }
            setValores(vals)
            setImagenesExistentes(imgs)
          }
        }
        setCargando(false)
      })
  }, [session, actividadId, id, bloqueIdEditar])

  const setValor = (campoId: number, valor: string) =>
    setValores((v) => ({ ...v, [campoId]: valor }))

  const setImagen = async (campoId: number, file: File | null) => {
    if (!file) {
      setImagenes((im) => { const copia = { ...im }; delete copia[campoId]; return copia })
      return
    }
    const comprimido = await comprimirImagen(file)
    setImagenes((im) => ({ ...im, [campoId]: comprimido }))
  }

  const fueraDeRango = (campo: Campo): boolean => {
    if (campo.tipo !== "NUMERO") return false
    const valor = valores[campo.id]
    if (!valor || isNaN(Number(valor))) return false
    const num = Number(valor)
    if (campo.valorMin !== null && num < campo.valorMin) return true
    if (campo.valorMax !== null && num > campo.valorMax) return true
    return false
  }

  const enviar = async () => {
    if (!actividad) return
    setError("")

    for (const campo of actividad.campos) {
      if (!valores[campo.id]?.trim()) {
        setError(`Falta completar: ${campo.descripcion}`)
        return
      }
      if (campo.tipo === "NUMERO" && isNaN(Number(valores[campo.id]))) {
        setError(`${campo.descripcion} debe ser un número`)
        return
      }
      if (campo.requiereImagen && !imagenes[campo.id] && !imagenesExistentes[campo.id]) {
        setError(`Falta la foto de: ${campo.descripcion}`)
        return
      }
    }

    setEnviando(true)
    const formData = new FormData()
    formData.append("observaciones", observaciones)
    if (hallazgo.trim()) formData.append("hallazgo", hallazgo)
    formData.append(
      "respuestas",
      JSON.stringify(actividad.campos.map((c) => ({ campoId: c.id, valor: valores[c.id] })))
    )
    for (const [campoId, file] of Object.entries(imagenes)) {
      formData.append(`imagen_${campoId}`, file)
    }

    let res: Response
    if (bloqueIdEditar) {
      res = await fetch(`/api/mantenimiento/registros/${id}/bloques/${bloqueIdEditar}`, { method: "PATCH", body: formData })
    } else {
      formData.append("actividadId", String(actividad.id))
      res = await fetch(`/api/mantenimiento/registros/${id}/bloques`, { method: "POST", body: formData })
    }
    setEnviando(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || "Error al guardar")
      return
    }

    router.push(`/mantenimiento/registros/${id}`)
  }

  if (cargando) {
    return <Layout titulo="Agregar actividad"><div className="p-12 text-center text-gray-400">Cargando...</div></Layout>
  }
  if (!actividad) {
    return <Layout titulo="Agregar actividad"><div className="p-12 text-center text-gray-400">Actividad no encontrada.</div></Layout>
  }

  return (
    <Layout titulo={`${bloqueIdEditar ? "Editar" : ""} ${actividad.nombre}`}>
      <div className="max-w-2xl mx-auto space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-5 space-y-5">
          {actividad.campos.map((campo) => (
            <div key={campo.id}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {campo.descripcion} {campo.requiereImagen && <span className="text-gray-400 font-normal">(con foto)</span>}
                {campo.tipo === "NUMERO" && (campo.valorMin !== null || campo.valorMax !== null) && (
                  <span className="text-gray-400 font-normal">
                    {" "}(rango normal: {campo.valorMin ?? "—"} a {campo.valorMax ?? "—"})
                  </span>
                )}
              </label>

              {campo.tipo === "FECHA_HORA" ? (
                <input
                  type="datetime-local"
                  value={valores[campo.id] ?? ""}
                  onChange={(e) => setValor(campo.id, e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : campo.tipo === "NUMERO" ? (
                <>
                  <input
                    type="number"
                    step="any"
                    value={valores[campo.id] ?? ""}
                    onChange={(e) => setValor(campo.id, e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                      fueraDeRango(campo) ? "border-red-300 focus:ring-red-300" : "border-gray-300 focus:ring-blue-500"
                    }`}
                  />
                  {fueraDeRango(campo) && (
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-red-600">⚠ Fuera del rango normal</span>
                      <button
                        type="button"
                        onClick={() => {
                          setMostrarHallazgo(true)
                          setHallazgo((h) => h || `${campo.descripcion}: valor ${valores[campo.id]} fuera del rango normal (${campo.valorMin ?? "—"} a ${campo.valorMax ?? "—"})`)
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Reportar como hallazgo
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <input
                  type="text"
                  value={valores[campo.id] ?? ""}
                  onChange={(e) => setValor(campo.id, e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}

              {campo.requiereImagen && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors">
                    📷 Elegir archivo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => setImagen(campo.id, e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                  </label>
                  {imagenes[campo.id] ? (
                    <span className="text-xs text-green-600">✓ {imagenes[campo.id].name}</span>
                  ) : imagenesExistentes[campo.id] ? (
                    <a href={imagenesExistentes[campo.id]} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                      Ver foto actual
                    </a>
                  ) : null}
                </div>
              )}
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {!mostrarHallazgo ? (
            <button
              type="button"
              onClick={() => setMostrarHallazgo(true)}
              className="text-sm text-red-600 hover:underline"
            >
              ⚠ Reportar un hallazgo o anomalía
            </button>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hallazgo / anomalía detectada</label>
              <textarea
                value={hallazgo}
                onChange={(e) => setHallazgo(e.target.value)}
                rows={2}
                autoFocus
                className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <p className="text-xs text-gray-400 mt-1">Queda registrado como pendiente hasta que se cierre desde &quot;Hallazgos&quot;.</p>
            </div>
          )}

          <button
            onClick={enviar}
            disabled={enviando}
            className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {enviando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </Layout>
  )
}
