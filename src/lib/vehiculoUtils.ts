export type CategoriaVehiculo = "liviano" | "pesado" | "maquinaria"

const LIVIANOS = ["AUTOMOVIL", "STATION_WAGON", "TODO_TERRENO", "CAMIONETA", "FURGON", "MOTOCICLETA"]
const PESADOS = ["CAMION", "BUS", "MINIBUS"]
export const MAQUINARIA_TIPOS = ["MAQUINARIA", "CARRO_ARRASTRE"]

// Excluye SEDAN a propósito: valor histórico sin uso que se mantiene en el enum de BD
// solo para no forzar una recreación del tipo en Postgres (ver prisma/schema.prisma)
export const TIPO_VEHICULO_LABELS: Record<string, string> = {
  AUTOMOVIL: "Automóvil",
  STATION_WAGON: "Station Wagon",
  TODO_TERRENO: "Todo Terreno / SUV",
  CAMIONETA: "Camioneta",
  FURGON: "Furgón",
  MINIBUS: "Minibus",
  BUS: "Bus",
  CAMION: "Camión",
  MOTOCICLETA: "Motocicleta",
  CARRO_ARRASTRE: "Carro de Arrastre",
  MAQUINARIA: "Maquinaria",
  OTRO: "Otro",
}

export function categoriaVehiculo(tipo: string): CategoriaVehiculo {
  if (LIVIANOS.includes(tipo)) return "liviano"
  if (PESADOS.includes(tipo)) return "pesado"
  return "maquinaria"
}

export function requierePatente(tipo: string): boolean {
  return !MAQUINARIA_TIPOS.includes(tipo)
}

export function usaHoras(tipo: string): boolean {
  return MAQUINARIA_TIPOS.includes(tipo)
}
