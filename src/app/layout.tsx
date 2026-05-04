import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import Providers from "@/components/Providers"

const geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Sistema IMO - Municipalidad de Ollagüe",
  description: "Sistema de inventario municipal",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={geist.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
