import { Role } from "@/generated/prisma/enums"

export type { Role }

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  BODEGA: "Bodega",
  FARMACIA: "Farmacia",
  FLOTA: "Conductor",
  ENCARGADO: "Encargado de Vehículos",
  VIEWER: "Solo lectura",
}

export const ROLES = Object.entries(ROLE_LABELS).map(([value, label]) => ({
  value: value as Role,
  label,
}))