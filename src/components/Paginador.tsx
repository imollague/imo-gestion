"use client"

interface PaginadorProps {
  pagina: number
  totalPaginas: number
  total: number
  limite: number
  onChange: (pagina: number) => void
}

export default function Paginador({ pagina, totalPaginas, total, limite, onChange }: PaginadorProps) {
  if (totalPaginas <= 1) return null

  const desde = (pagina - 1) * limite + 1
  const hasta = Math.min(pagina * limite, total)

  const paginas = () => {
    const rango: (number | "...")[] = []
    if (totalPaginas <= 7) {
      for (let i = 1; i <= totalPaginas; i++) rango.push(i)
    } else {
      rango.push(1)
      if (pagina > 3) rango.push("...")
      for (let i = Math.max(2, pagina - 1); i <= Math.min(totalPaginas - 1, pagina + 1); i++) {
        rango.push(i)
      }
      if (pagina < totalPaginas - 2) rango.push("...")
      rango.push(totalPaginas)
    }
    return rango
  }

  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <p className="text-xs text-gray-500">
        Mostrando {desde}–{hasta} de {total} movimientos
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => onChange(pagina - 1)}
          disabled={pagina === 1}
          className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Anterior
        </button>
        {paginas().map((p, idx) =>
          p === "..." ? (
            <span key={idx} className="px-2 py-1.5 text-xs text-gray-400">...</span>
          ) : (
            <button
              key={idx}
              onClick={() => onChange(p as number)}
              className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${
                p === pagina
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(pagina + 1)}
          disabled={pagina === totalPaginas}
          className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Siguiente
        </button>
      </div>
    </div>
  )
}