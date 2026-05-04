export const TipoMovimiento = {
  ENTRADA: "ENTRADA",
  SALIDA: "SALIDA",
  AJUSTE: "AJUSTE",
} as const

export type TipoMovimiento = typeof TipoMovimiento[keyof typeof TipoMovimiento]