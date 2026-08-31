/**
 * Importa vehículos desde Excel a la base de datos.
 *
 * Dry-run (previsualiza sin insertar):
 *   npx tsx scripts/import-vehiculos.ts
 *
 * Insertar en la base de datos:
 *   npx tsx scripts/import-vehiculos.ts --import
 */
import "dotenv/config"
import { config } from "dotenv"
// Solo carga .env.local (base de datos local) si se pasa el flag --local
if (process.argv.includes("--local")) {
  config({ path: ".env.local", override: true })
  console.log("[env] Usando base de datos LOCAL (.env.local)")
} else {
  console.log("[env] Usando base de datos de PRODUCCIÓN (.env)")
}

import * as XLSX from "xlsx"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient, TipoVehiculo, UsoMunicipal } from "../src/generated/prisma/client"

const EXCEL_PATH = "D:/DEV/Data/BD_parque_vehicular.xlsx"
const DRY_RUN = !process.argv.includes("--import")

// ── Mapa de tipos del Excel → enum TipoVehiculo + usoMunicipal opcional ────────

type Mapping = { tipo: TipoVehiculo; usoMunicipal?: UsoMunicipal; obs?: string }

const TIPO_MAP: Record<string, Mapping> = {
  "ambulancia":             { tipo: "CAMIONETA",    usoMunicipal: "AMBULANCIA" },
  "bus":                    { tipo: "BUS" },
  "cam. dob. cab.":        { tipo: "CAMIONETA",    obs: "Camioneta doble cabina" },
  "camioneta":              { tipo: "CAMIONETA" },
  "camión":                 { tipo: "CAMION" },
  "camion":                 { tipo: "CAMION" },
  "camión aljibe":          { tipo: "CAMION",       usoMunicipal: "ALJIBE" },
  "camion aljibe":          { tipo: "CAMION",       usoMunicipal: "ALJIBE" },
  "camión bombero":         { tipo: "CAMION",       obs: "Camión Bombero" },
  "camion bombero":         { tipo: "CAMION",       obs: "Camión Bombero" },
  "camión grua 9 ton":      { tipo: "CAMION",       obs: "Camión Grúa 9 ton" },
  "camion grua 9 ton":      { tipo: "CAMION",       obs: "Camión Grúa 9 ton" },
  "cargador frontal":       { tipo: "MAQUINARIA",   obs: "Cargador Frontal" },
  "carro arrastre":         { tipo: "CARRO_ARRASTRE" },
  "carrobomba":             { tipo: "CAMION",       obs: "Carrobomba" },
  "excavadora":             { tipo: "MAQUINARIA",   obs: "Excavadora" },
  "furgon":                 { tipo: "FURGON" },
  "furgón":                 { tipo: "FURGON" },
  "limpia fosa":            { tipo: "CAMION",       obs: "Limpia Fosa" },
  "mini bus":               { tipo: "MINIBUS" },
  "minibus":                { tipo: "MINIBUS" },
  "minibús":                { tipo: "MINIBUS" },
  "moto":                   { tipo: "MOTOCICLETA" },
  "motoniveladora":         { tipo: "MAQUINARIA",   obs: "Motoniveladora" },
  "multiproposito":         { tipo: "OTRO",         obs: "Multipropósito" },
  "recolector rsd":         { tipo: "CAMION",       usoMunicipal: "RECOLECTOR_RESIDUOS" },
  "retro excavadora":       { tipo: "MAQUINARIA",   obs: "Retroexcavadora" },
  "rodillo":                { tipo: "MAQUINARIA",   obs: "Rodillo" },
  "semi remolque":          { tipo: "CARRO_ARRASTRE", obs: "Semi Remolque" },
  "station wagon":          { tipo: "STATION_WAGON" },
  "station wagon ":         { tipo: "STATION_WAGON" },
  "statión wagon":          { tipo: "STATION_WAGON" },
  "surtidor de combustible": { tipo: "OTRO",        obs: "Surtidor de Combustible" },
  "tracto camión":          { tipo: "CAMION",       obs: "Tracto Camión" },
  "tracto camión ":         { tipo: "CAMION",       obs: "Tracto Camión" },
}

const MAQUINARIA_TIPOS: TipoVehiculo[] = ["MAQUINARIA", "CARRO_ARRASTRE"]

// ── Limpieza de patente ────────────────────────────────────────────────────────

function limpiarPatente(raw: string): string {
  // 1. Quitar espacios y pasar a mayúsculas
  let p = raw.trim().toUpperCase().replace(/\s+/g, "")
  // 2. Quitar dígito verificador final (single char tras guión) si la base es patente válida
  //    "SB8133-7" → "SB8133"  |  "CBSX83-6" → "CBSX83"  |  "WY4430-K" → "WY4430"
  p = p.replace(/^([A-Z]{2}\d{4}|[A-Z]{4}\d{2})-[A-Z0-9]$/, "$1")
  // 3. Quitar guiones restantes ("XA-4048" → "XA4048", "FDSV-13" → "FDSV13")
  p = p.replace(/-/g, "")
  return p
}

// ── Lectura del Excel ──────────────────────────────────────────────────────────

const wb = XLSX.readFile(EXCEL_PATH)
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as unknown[][]

// Fila 1 = encabezados, filas 2+ = datos
const dataRows = rows.slice(2).filter((r: unknown[]) => r[1]) // filtrar filas sin código

// ── Transformación ─────────────────────────────────────────────────────────────

type VehiculoData = {
  numeroInterno: string
  marca: string
  modelo: string
  anio: number
  tipo: TipoVehiculo
  usoMunicipal?: UsoMunicipal
  patente?: string
  observaciones?: string
  unidadMedidaUso: "KILOMETROS" | "HORAS"
}

const vehiculos: VehiculoData[] = []
const errores: string[] = []

for (const row of dataRows) {
  const r = row as unknown[]
  const codigo   = String(r[1] ?? "").trim()
  const marca    = String(r[2] ?? "").trim().replace(/\s+/g, " ")
  const modelo   = String(r[3] ?? "").trim().replace(/\s+/g, " ")
  const anioRaw  = r[4]
  const patenteRaw = r[5] ? String(r[5]).trim() : ""
  const tipoRaw  = r[8] ? String(r[8]).trim() : ""

  // Año
  const anio = typeof anioRaw === "number" ? anioRaw : parseInt(String(anioRaw), 10)
  if (!anio || isNaN(anio)) {
    errores.push(`${codigo}: año inválido (${anioRaw})`)
    continue
  }

  // Tipo
  const mapping = TIPO_MAP[tipoRaw.toLowerCase()]
  if (!mapping) {
    errores.push(`${codigo}: tipo no reconocido "${tipoRaw}"`)
    continue
  }

  const esMaquinaria = MAQUINARIA_TIPOS.includes(mapping.tipo)

  // Patente
  let patente: string | undefined
  if (!esMaquinaria) {
    if (!patenteRaw) {
      errores.push(`${codigo}: sin patente para tipo ${mapping.tipo}`)
      continue
    }
    patente = limpiarPatente(patenteRaw)
  }

  // Observaciones (combinar obs del mapa + patente para maquinaria)
  let obs = mapping.obs ?? undefined
  if (esMaquinaria && patenteRaw) {
    const patenteAdicional = `Placa registrada: ${patenteRaw.trim()}`
    obs = obs ? `${obs} | ${patenteAdicional}` : patenteAdicional
  }

  vehiculos.push({
    numeroInterno: codigo,
    marca,
    modelo,
    anio,
    tipo: mapping.tipo,
    usoMunicipal: mapping.usoMunicipal,
    patente,
    observaciones: obs,
    unidadMedidaUso: esMaquinaria ? "HORAS" : "KILOMETROS",
  })
}

// ── Preview ────────────────────────────────────────────────────────────────────

console.log(`\n=== IMPORTACIÓN DE VEHÍCULOS ${DRY_RUN ? "(DRY RUN)" : "(REAL)"} ===`)
console.log(`Vehículos a importar: ${vehiculos.length}`)
if (errores.length) {
  console.log(`\nFilas con problemas (${errores.length}):`)
  errores.forEach((e) => console.log(`  ⚠ ${e}`))
}

console.log("\nResumen por tipo:")
const resumen: Partial<Record<TipoVehiculo, number>> = {}
for (const v of vehiculos) resumen[v.tipo] = (resumen[v.tipo] ?? 0) + 1
Object.entries(resumen).sort().forEach(([t, n]) => console.log(`  ${t}: ${n}`))

if (DRY_RUN) {
  console.log("\n=== PREVIEW (primeros 5) ===")
  vehiculos.slice(0, 5).forEach((v) => console.log(JSON.stringify(v, null, 2)))
  console.log("\nEjecuta con --import para insertar en la base de datos.")
  process.exit(0)
}

// ── Inserción ──────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function importar() {
  let insertados = 0
  let omitidos = 0

  for (const v of vehiculos) {
    // Saltar si ya existe por patente o por numeroInterno
    const existe = await prisma.vehiculo.findFirst({
      where: {
        OR: [
          ...(v.patente ? [{ patente: v.patente }] : []),
          { numeroInterno: v.numeroInterno },
        ],
      },
    })
    if (existe) {
      console.log(`  ↷ Omitido (ya existe): ${v.numeroInterno} / patente ${v.patente ?? "N/A"}`)
      omitidos++
      continue
    }

    await prisma.vehiculo.create({ data: v })
    console.log(`  ✓ Insertado: ${v.numeroInterno} ${v.marca} ${v.modelo} (${v.tipo})`)
    insertados++
  }

  await prisma.$disconnect()
  console.log(`\nListo: ${insertados} insertados, ${omitidos} omitidos (ya existían).`)
}

importar().catch((e) => {
  console.error("Error:", e)
  process.exit(1)
})
