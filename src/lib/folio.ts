import { prisma } from "@/lib/prisma"

/**
 * Genera el siguiente folio para un módulo dado en el año actual.
 * Usa ContadorFolio con upsert atómico — seguro bajo concurrencia.
 *
 * Ejemplos de uso:
 *   siguienteFolio("OS_FLOTA", "OS")          → "OS-2026-001"
 *   siguienteFolio("MEMO_RRHH", "MEMO")       → "MEMO-2026-001"
 *   siguienteFolio("RECETA_FARMACIA", "RX")   → "RX-2026-001"
 */
export async function siguienteFolio(modulo: string, prefijo: string, digits = 3): Promise<string> {
  const anio = new Date().getFullYear()
  const contador = await prisma.contadorFolio.upsert({
    where: { modulo_anio: { modulo, anio } },
    update: { ultimo: { increment: 1 } },
    create: { modulo, anio, ultimo: 1 },
  })
  return `${prefijo}-${anio}-${String(contador.ultimo).padStart(digits, "0")}`
}
