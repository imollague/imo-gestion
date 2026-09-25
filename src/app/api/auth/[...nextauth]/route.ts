import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

const MAX_INTENTOS = 5
const BLOQUEO_MINUTOS = 15

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
          include: { conductorFlota: { select: { id: true } } },
        })

        if (!user || !user.active) return null

        if (user.bloqueadoHasta && user.bloqueadoHasta > new Date()) {
          const minutosRestantes = Math.ceil((user.bloqueadoHasta.getTime() - Date.now()) / 60000)
          throw new Error(`Demasiados intentos fallidos. Intenta de nuevo en ${minutosRestantes} minuto${minutosRestantes === 1 ? "" : "s"}.`)
        }

        const passwordMatch = await bcrypt.compare(credentials.password, user.password)
        if (!passwordMatch) {
          const intentos = user.intentosFallidos + 1
          await prisma.user.update({
            where: { id: user.id },
            data: {
              intentosFallidos: intentos,
              bloqueadoHasta: intentos >= MAX_INTENTOS ? new Date(Date.now() + BLOQUEO_MINUTOS * 60000) : user.bloqueadoHasta,
            },
          })
          return null
        }

        if (user.intentosFallidos > 0 || user.bloqueadoHasta) {
          await prisma.user.update({
            where: { id: user.id },
            data: { intentosFallidos: 0, bloqueadoHasta: null },
          })
        }

        return {
          id: String(user.id),
          name: user.name,
          username: user.username,
          role: user.role,
          conductorFlotaId: user.conductorFlota?.id ?? null,
          rut: user.rut ?? null,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id
        token.username = user.username
        token.role = user.role
        token.conductorFlotaId = user.conductorFlotaId
        token.rut = user.rut
      }
      return token
    },
    async session({ session, token }: any) {
      if (token) {
        session.user.id = token.id
        session.user.username = token.username
        session.user.role = token.role
        session.user.conductorFlotaId = token.conductorFlotaId
        session.user.rut = token.rut
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt" as const,
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }