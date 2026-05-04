/**
 * Valida un RUT chileno
 * Acepta formatos: 12345678-9, 12.345.678-9
 * Retorna true si es valido
 */
export function validarRut(rut: string): boolean {
  if (!rut || rut.trim() === "") return false

  // Limpiar puntos y espacios, dejar solo numeros y guion
  const rutLimpio = rut.replace(/\./g, "").replace(/\s/g, "").toUpperCase()

  // Verificar formato con guion
  if (!/^[0-9]+-[0-9K]$/.test(rutLimpio)) return false

  const partes = rutLimpio.split("-")
  const cuerpo = partes[0]
  const dv = partes[1]

  if (cuerpo.length < 7 || cuerpo.length > 8) return false

  // Calcular digito verificador
  let suma = 0
  let multiplo = 2

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * multiplo
    multiplo = multiplo === 7 ? 2 : multiplo + 1
  }

  const resto = suma % 11
  const dvCalculado = resto === 0 ? "0" : resto === 1 ? "K" : String(11 - resto)

  return dv === dvCalculado
}

/**
 * Formatea un RUT mientras se escribe
 * Agrega guion automaticamente antes del digito verificador
 */
export function formatearRut(rut: string): string {
  // Limpiar todo excepto numeros y K
  const limpio = rut.replace(/[^0-9kK]/g, "").toUpperCase()

  if (limpio.length === 0) return ""
  if (limpio.length === 1) return limpio

  // Separar cuerpo y dv
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)

  return `${cuerpo}-${dv}`
}