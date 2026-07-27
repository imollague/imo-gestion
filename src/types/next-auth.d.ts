import type { Role } from "@/generated/prisma/enums"
import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name: string
      username: string
      role: Role
      conductorFlotaId: number | null
      rut: string | null
    }
  }

  interface User {
    id: string
    name: string
    username: string
    role: Role
    conductorFlotaId: number | null
    rut: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    username: string
    role: Role
    conductorFlotaId: number | null
    rut: string | null
  }
}