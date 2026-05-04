import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function proxy(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Si es BODEGA intentando acceder a farmacia, bloquear
    if (token?.role === "BODEGA" && pathname.startsWith("/farmacia")) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    // Si es FARMACIA intentando acceder a bodega, bloquear
    if (token?.role === "FARMACIA" && pathname.startsWith("/bodega")) {
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