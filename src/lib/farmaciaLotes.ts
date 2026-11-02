import type { Prisma } from "@/generated/prisma/client"

type Tx = Prisma.TransactionClient

export const ROLES_LECTURA_FARMACIA = ["ADMIN", "FARMACIA", "VIEWER"]
export const ROLES_LECTURA_BODEGA = ["ADMIN", "BODEGA", "VIEWER"]
// Datos de pacientes (RUT, teléfono): solo quienes operan la farmacia
export const ROLES_PACIENTES = ["ADMIN", "FARMACIA"]

/** Medianoche UTC de hoy en Chile: así un lote que vence hoy sigue siendo válido durante todo el día. */
export function hoyChile(): Date {
  const iso = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" })
  return new Date(iso)
}

export interface AsignacionLote {
  /** null = la parte del stock que no pertenece a ningún lote (entradas antiguas sin lote) */
  lote: { id: number; numeroLote: string; fechaVencimiento: Date | null } | null
  cantidad: number
}

/**
 * Descuenta `cantidad` del stock por lote de un medicamento y devuelve de dónde salió cada parte.
 * NO modifica Medicamento.stockActual: eso lo hace quien llama.
 *
 * - Despacho (`incluirVencidos: false`): FEFO — primero el lote que vence antes; nunca toca lotes vencidos.
 *   Lo que no está en ningún lote ("sin lote") se usa al final.
 * - Merma, ajuste, inventario, retiro (`incluirVencidos: true`): primero lo "sin lote", luego los lotes
 *   por vencimiento (los vencidos salen primero).
 */
export async function descontarStockLotes(
  tx: Tx,
  medicamento: { id: number; stockActual: number },
  cantidad: number,
  { incluirVencidos }: { incluirVencidos: boolean }
): Promise<AsignacionLote[]> {
  const hoy = hoyChile()

  const lotes = await tx.loteFarmacia.findMany({
    where: { medicamentoId: medicamento.id, retirado: false, stockActual: { gt: 0 } },
    orderBy: [{ fechaVencimiento: { sort: "asc", nulls: "last" } }, { fechaIngreso: "asc" }],
  })

  const totalEnLotes = lotes.reduce((s, l) => s + l.stockActual, 0)
  const sinLote = Math.max(0, medicamento.stockActual - totalEnLotes)
  const vigente = (l: (typeof lotes)[number]) => !l.fechaVencimiento || l.fechaVencimiento >= hoy
  const usables = incluirVencidos ? lotes : lotes.filter(vigente)

  const asignaciones: AsignacionLote[] = []
  let restante = cantidad

  const tomarSinLote = () => {
    const n = Math.min(sinLote, restante)
    if (n > 0) { asignaciones.push({ lote: null, cantidad: n }); restante -= n }
  }

  if (incluirVencidos) tomarSinLote()

  for (const l of usables) {
    if (restante <= 0) break
    const n = Math.min(l.stockActual, restante)
    await tx.loteFarmacia.update({ where: { id: l.id }, data: { stockActual: { decrement: n } } })
    asignaciones.push({ lote: { id: l.id, numeroLote: l.numeroLote, fechaVencimiento: l.fechaVencimiento }, cantidad: n })
    restante -= n
  }

  if (!incluirVencidos) tomarSinLote()

  if (restante > 0) {
    const vencido = lotes.filter((l) => !vigente(l)).reduce((s, l) => s + l.stockActual, 0)
    throw new Error(
      !incluirVencidos && vencido > 0
        ? `Stock disponible insuficiente: hay ${cantidad - restante} sin vencer y ${vencido} en lotes vencidos, que no se pueden despachar. Registra su merma o retiro.`
        : `Stock insuficiente. Stock actual: ${medicamento.stockActual}`
    )
  }

  return asignaciones
}
