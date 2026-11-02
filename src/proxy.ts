import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function proxy(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Cada módulo solo admite a su rol, a ADMIN y a VIEWER (solo lectura)
    const role = token?.role as string | undefined
    if (pathname.startsWith("/farmacia") && !(role === "ADMIN" || role === "FARMACIA" || role === "VIEWER")) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
    if (pathname.startsWith("/bodega") && !(role === "ADMIN" || role === "BODEGA" || role === "VIEWER")) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
    // Los datos de pacientes (RUT, teléfono) no son para VIEWER
    if (pathname.startsWith("/farmacia/pacientes") && role === "VIEWER") {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    // Si no es ADMIN intentando acceder a admin, bloquear
    if (token?.role !== "ADMIN" && pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: ["/dashboard/:path*", "/bodega/:path*", "/farmacia/:path*", "/admin/:path*"],
}