/**
 * Inspecciona el Excel de vehículos y muestra sus columnas y primeras filas.
 * Uso: npx tsx scripts/inspect-excel.ts
 */
import * as XLSX from "xlsx"

const EXCEL_PATH = process.argv[2] ?? "D:/DEV/Data/BD_parque_vehicular.xlsx"

const workbook = XLSX.readFile(EXCEL_PATH)
const sheetName = workbook.SheetNames[0]
const sheet = workbook.Sheets[sheetName]

// Leer como array para inspeccionar la estructura raw
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

console.log(`\nArchivo: ${EXCEL_PATH}`)
console.log(`Hoja: ${sheetName} (${rows.length} filas total)\n`)

// Mostrar primeras 5 filas raw para entender la estructura
console.log("=== PRIMERAS 5 FILAS RAW ===")
rows.slice(0, 5).forEach((row, i) => {
  console.log(`\nFila ${i}:`, JSON.stringify(row))
})

// Intentar con headerRow = 1 (segunda fila como encabezado)
console.log("\n=== USANDO FILA 1 COMO ENCABEZADO ===")
const headers = rows[1] as string[]
headers.forEach((h, i) => {
  if (h) console.log(`  [${i}] "${h}"`)
})

console.log("\n=== DATOS (filas 2-5) ===")
rows.slice(2, 5).forEach((row, i) => {
  const arr = row as unknown[]
  console.log(`\nVehículo ${i + 1}:`)
  headers.forEach((h, j) => {
    if (h && arr[j] !== undefined && arr[j] !== null && arr[j] !== "") {
      console.log(`  "${h}": ${JSON.stringify(arr[j])}`)
    }
  })
})
