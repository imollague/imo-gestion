import nodemailer from "nodemailer"

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
