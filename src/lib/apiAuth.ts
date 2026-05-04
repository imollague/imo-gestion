import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { NextResponse } from "next/server"
import type { Session } from "next-auth"

type AuthOk = { ok: true; session: Session }
type AuthErr = { ok: false; response: NextResponse }
export type AuthResult = AuthOk | AuthErr

/** Verifica sesión activa. Retorna 401 si no hay sesión. */
export async function requireAuth(): Promise<AuthResult> {
  const session = await getServerSession(authOptions)
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) }
  }
  return { ok: true, session }
}

/** Verifica sesión y que el rol esté en la lista permitida. Retorna 401/403 según corresponda. */
export async function requireRole(...roles: string[]): Promise<AuthResult> {
  const result = await requireAuth()
  if (!result.ok) return result
  if (!roles.includes(result.session.user.role)) {
    return { ok: false, response: NextResponse.json({ error: "Sin permisos" }, { status: 403 }) }
  }
  return result
}
