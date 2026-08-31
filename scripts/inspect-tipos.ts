import * as XLSX from "xlsx"
const wb = XLSX.readFile("D:/DEV/Data/BD_parque_vehicular.xlsx")
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as unknown[][]
const dataRows = rows.slice(2)
const tipos = [...new Set(dataRows.map((r: unknown[]) => r[8]).filter(Boolean))].sort()
console.log("TIPOS únicos:", JSON.stringify(tipos, null, 2))
console.log("Total vehículos:", dataRows.filter((r: unknown[]) => r[1]).length)
// Mostrar todos los vehículos: codigo, marca, patente, tipo
dataRows.filter((r: unknown[]) => r[1]).forEach((r: unknown[]) => {
  console.log(`${r[1]} | ${r[2]} ${r[3]} | patente: ${r[5]} | tipo: ${r[8]}`)
})
