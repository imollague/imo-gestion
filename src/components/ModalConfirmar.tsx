"use client"

interface FilaResumen {
  label: string
  valor: string
  destacado?: boolean
}

interface ModalConfirmarProps {
  titulo: string
  filas: FilaResumen[]
  onConfirmar: () => void
  onCancelar: () => void
  loading?: boolean
  colorConfirmar?: "blue" | "green" | "red"
}

export default function ModalConfirmar({
  titulo,
  filas,
  onConfirmar,
  onCancelar,
  loading = false,
  colorConfirmar = "blue",
}: ModalConfirmarProps) {
  const colores = {
    blue: "bg-blue-600 hover:bg-blue-700",
    green: "bg-green-600 hover:bg-green-700",
    red: "bg-red-600 hover:bg-red-700",
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{titulo}</h3>

        <div className="bg-gray-50 rounded-lg divide-y divide-gray-200 mb-5">
          {filas.map((fila, idx) => (
            <div key={idx} className="flex justify-between items-center px-4 py-2.5">
              <span className="text-sm text-gray-500">{fila.label}</span>
              <span className={`text-sm font-medium ${fila.destacado ? "text-blue-700 text-base font-bold" : "text-gray-800"}`}>
                {fila.valor}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onConfirmar}
            disabled={loading}
            className={`flex-1 text-white py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50 transition-colors ${colores[colorConfirmar]}`}
          >
            {loading ? "Registrando..." : "Confirmar y Registrar"}
          </button>
          <button
            onClick={onCancelar}
            disabled={loading}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Revisar
          </button>
        </div>
      </div>
    </div>
  )
}