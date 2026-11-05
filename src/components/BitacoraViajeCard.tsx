"use client"

import { useState } from "react"
import { DatosBitacoraViaje, fmtFechaHora, generarPDFBitacora, resumenBitacora } from "@/lib/bitacoraViaje"

function Hito({ color, children, ultimo }: { color: string; children: React.ReactNode; ultimo?: boolean }) {
  return (
    <li className="relative pl-7 pb-5 last:pb-0">
      {!ultimo && <span className="absolute left-[7px] top-4 bottom-0 w-px bg-gray-200" />}
      <span className={`absolute left-0 top-1 h-4 w-4 rounded-full border-2 border-white ring-2 ${color}`} />
      {children}
    </li>
  )
}

export default function BitacoraViajeCard({ datos }: { datos: DatosBitacoraViaje }) {
  const [generando, setGenerando] = useState(false)
  const r = resumenBitacora(datos)
  const enCurso = datos.kmLlegada == null

  const descargar = async () => {
    setGenerando(true)
    try { await generarPDFBitacora(datos) } finally { setGenerando(false) }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-lg font-semibold text-gray-800">Bitácora del viaje</p>
          <p className="text-xs text-gray-400">
            {enCurso ? "Viaje en curso — se actualiza al registrar paradas y llegada" : "Salida, paradas y llegada registradas"}
          </p>
        </div>
        <button
          onClick={descargar}
          disabled={generando}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {generando ? "Generando..." : "Descargar bitácora (PDF)"}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xl font-bold text-gray-800">{r.kmRecorridos != null ? r.kmRecorridos.toLocaleString("es-CL") : "—"}</p>
          <p className="text-xs text-gray-500">km recorridos</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xl font-bold text-gray-800">{r.paradas}</p>
          <p className="text-xs text-gray-500">parada{r.paradas === 1 ? "" : "s"}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xl font-bold text-gray-800">{r.litros.toFixed(1)}</p>
          <p className="text-xs text-gray-500">litros cargados</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xl font-bold text-gray-800">{r.duracion ?? "—"}</p>
          <p className="text-xs text-gray-500">duración</p>
        </div>
      </div>

      <ol>
        <Hito color="bg-green-500 ring-green-200">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="font-medium text-gray-800">Salida</p>
            <p className="text-xs text-gray-400">{fmtFechaHora(datos.salidaRegistradaEn)}</p>
          </div>
          <p className="text-sm text-gray-600">{datos.kmSalida.toLocaleString("es-CL")} km</p>
        </Hito>

        {datos.paradas.map((p, i) => (
          <Hito key={p.id} color="bg-blue-500 ring-blue-200">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="font-medium text-gray-800">Parada {i + 1}{p.descripcion ? ` — ${p.descripcion}` : ""}</p>
              <p className="text-xs text-gray-400">{fmtFechaHora(p.fecha)}</p>
            </div>
            <p className="text-sm text-gray-600">
              {p.km.toLocaleString("es-CL")} km
              <span className="text-gray-400"> · {(p.km - datos.kmSalida).toLocaleString("es-CL")} km desde la salida</span>
            </p>
            {p.litros != null && p.litros > 0 && (
              <p className="text-sm text-blue-700 mt-1">
                ⛽ {p.litros} L{p.comprobanteRef ? ` · comprobante ${p.comprobanteRef}` : ""}
                {p.comprobanteFotoUrl && (
                  <a href={p.comprobanteFotoUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-blue-500 hover:underline">
                    📷 Ver foto
                  </a>
                )}
              </p>
            )}
            {p.pasajeros.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {p.pasajeros.map((x, j) => (
                  <span key={j} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full border border-blue-100">
                    {x.nombre}{x.rut ? ` · ${x.rut}` : ""}
                  </span>
                ))}
              </div>
            )}
          </Hito>
        ))}

        <Hito color={enCurso ? "bg-gray-300 ring-gray-100" : "bg-red-500 ring-red-200"} ultimo>
          {enCurso ? (
            <p className="text-sm text-gray-400">Llegada pendiente</p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="font-medium text-gray-800">Llegada</p>
                {datos.horaRetornoReal && <p className="text-xs text-gray-400">{fmtFechaHora(datos.horaRetornoReal)}</p>}
              </div>
              <p className="text-sm text-gray-600">{datos.kmLlegada!.toLocaleString("es-CL")} km</p>
            </>
          )}
        </Hito>
      </ol>

      {datos.observacion && (
        <div className="mt-5 border-t pt-4">
          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Observación del viaje</p>
          <p className="text-sm text-gray-700 whitespace-pre-line">{datos.observacion}</p>
        </div>
      )}
    </div>
  )
}
