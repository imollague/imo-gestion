import { NextRequest } from "next/server"

/**
 * Verifica el secreto de un cron job. Acepta el header que Vercel Cron manda
 * automáticamente (`Authorization: Bearer <CRON_SECRET>`) y también
 * `x-cron-secret` para poder disparar el endpoint manualmente (curl, etc.).
 */
export function verificarCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const auth = req.headers.get("authorization")
  if (auth === `Bearer ${secret}`) return true

  return req.headers.get("x-cron-secret") === secret
}
