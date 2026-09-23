import nodemailer from "nodemailer"
import type { Role } from "@/generated/prisma/client"

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT ?? "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export const EMAIL_FROM = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@imo-gestion.cl"
export const EMAIL_ADMINS = (process.env.ALERT_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean)

/** Junta EMAIL_ADMINS con los emails de usuarios activos que tengan alguno de los roles dados, sin duplicados. */
export async function destinatariosAlerta(roles: Role[]): Promise<string[]> {
  const { prisma } = await import("./prisma")
  const usuarios = await prisma.user.findMany({
    where: { active: true, role: { in: roles }, email: { not: null } },
    select: { email: true },
  })
  const emails = new Set(EMAIL_ADMINS)
  for (const u of usuarios) if (u.email) emails.add(u.email.trim())
  return [...emails]
}
