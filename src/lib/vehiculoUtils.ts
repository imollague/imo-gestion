export type CategoriaVehiculo = "liviano" | "pesado" | "maquinaria"

const LIVIANOS = ["AUTOMOVIL", "STATION_WAGON", "TODO_TERRENO", "CAMIONETA", "FURGON", "MOTOCICLETA"]
const PESADOS = ["CAMION", "BUS", "MINIBUS"]
export const MAQUINARIA_TIPOS = ["MAQUINARIA", "CARRO_ARRASTRE"]

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
