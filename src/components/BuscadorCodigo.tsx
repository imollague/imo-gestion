"use client"

import { useState, useRef, useEffect, useCallback } from "react"

interface ResultadoBusqueda {
  id: number
  codigo: string
  nombre?: string
  nombreGenerico?: string
  nombreComercial?: string | null
  unidad: string
  stockActual: number
  formaFarmaceutica?: string
  concentracion?: string | null
  categoria: { nombre: string }
}

interface BuscadorCodigoProps {
  endpoint: string // "/api/bodega/productos/buscar" o "/api/farmacia/medicamentos/buscar"
  onSeleccionar: (item: ResultadoBusqueda) => void
  placeholder?: string
  colorFoco?: string
  urlCrear?: string // "/bodega/productos/nuevo" o "/farmacia/medicamentos/nuevo"
}

export default function BuscadorCodigo({
  endpoint,
  onSeleccionar,
  placeholder = "Escanea o escribe el código...",
  colorFoco = "blue",
  urlCrear
}: BuscadorCodigoProps) {
  const [query, setQuery] = useState("")
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([])
  const [mostrarLista, setMostrarLista] = useState(false)
  const [mostrarNoEncontrado, setMostrarNoEncontrado] = useState(false)
  const [indiceActivo, setIndiceActivo] = useState(0)
  const [buscando, setBuscando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const focusClass = colorFoco === "green" ? "focus:ring-green-500" : "focus:ring-blue-500"

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const buscar = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResultados([])
        setMostrarLista(false)
        setMostrarNoEncontrado(false)
        return
      }

      setBuscando(true)
      try {
        const res = await fetch(`${endpoint}?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResultados(data)

        if(data.length === 0) {
          setMostrarLista(false)
          setMostrarNoEncontrado(true)
        } else {
          setMostrarLista(true)
          setMostrarNoEncontrado(false)
          setIndiceActivo(0)

          // Si hay exactamente un resultado con código exacto, seleccionar automáticamente
          if(data.length === 1 && data[0].codigo.toLowerCase() === q.toLocaleLowerCase()) {
            seleccionar(data[0])
          }
        }
      } catch {
        setResultados([])
        setMostrarNoEncontrado(true)
      } finally {
        setBuscando(false)
      }
    },
    [endpoint]
  )

  const seleccionar = (item: ResultadoBusqueda) => {
    onSeleccionar(item)
    setQuery("")
    setResultados([])
    setMostrarLista(false)
    setMostrarNoEncontrado(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value
    setQuery(valor)

    if(!valor.trim()) {
      setMostrarNoEncontrado(false)
      setMostrarLista(false)
    }

    // Debounce de 200ms para no saturar la API mientras se escribe
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => buscar(valor), 200)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setIndiceActivo((i) => Math.min(i + 1, resultados.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setIndiceActivo((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (resultados.length > 0) {
        seleccionar(resultados[indiceActivo])
      }
    } else if (e.key === "Escape") {
      setMostrarLista(false)
      setMostrarNoEncontrado(false)
    }
  }

  const getNombre = (item: ResultadoBusqueda) =>
    item.nombreGenerico || item.nombre || ""

  const getSubtitulo = (item: ResultadoBusqueda) => {
    if (item.formaFarmaceutica) {
      return `${item.formaFarmaceutica}${item.concentracion ? ` — ${item.concentracion}` : ""} | ${item.categoria.nombre}`
    }
    return item.categoria.nombre
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => { setMostrarLista(false); setMostrarNoEncontrado(false)}, 150)}
          onFocus={() => {
            if (resultados.length > 0) setMostrarLista(true)
            else if (query.trim() && resultados.length === 0) setMostrarNoEncontrado(true)
          }}
          placeholder={placeholder}
          className={`w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 ${focusClass} pr-10`}
        />
        {buscando && (
          <div className="absolute right-3 top-2.5">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        )}
      </div>
        
      {/* Lista de resultados */}
      {mostrarLista && resultados.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {resultados.map((item, idx) => (
            <li
              key={item.id}
              onMouseDown={() => seleccionar(item)}
              className={`px-4 py-3 cursor-pointer flex justify-between items-center gap-4 ${
                idx === indiceActivo ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{getNombre(item)}</p>
                <p className="text-xs text-gray-400 truncate">{getSubtitulo(item)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-mono text-gray-500">{item.codigo}</p>
                <p className={`text-xs font-semibold ${item.stockActual === 0 ? "text-red-600" : "text-green-600"}`}>
                  Stock: {item.stockActual} {item.unidad}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Mensaje no encontrado */}
      {mostrarNoEncontrado && query.trim() && !buscando && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-orange-200 rounded-lg shadow-lg p-4">
          <p className="text-sm text-orange-700 font-medium mb-1">
            No se encontro ningun resultado para "{query}"
          </p>
          <p className="text-xs text-gray-500 mb-3">
            Verifica el codigo o nombre. Si el producto no existe aun, puedes crearlo.
          </p>
          {urlCrear && (
            <a
              href={urlCrear}
              className={`inline-block text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-colors ${
                colorFoco === "green" ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              + Crear nuevo
            </a>
          )}
        </div>
      )}
    </div>
  )
}