import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireRole } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { TipoMovimiento, TipoDocumento } from "@/generated/prisma/client"

/* GET */
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get("tipo")
  const desde = searchParams.get("desde")
  const hasta = searchParams.get("hasta")
  const productoId = searchParams.get("productoId")
  const busqueda = searchParams.get("busqueda")
  const pagina = parseInt(searchParams.get("pagina") ?? "1")
  const limite = parseInt(searchParams.get("limite") ?? "50")
  const skip = (pagina - 1) * limite

  const where = {
    ...(tipo && { tipo: tipo as TipoMovimiento }),
    ...(productoId && { productoId: parseInt(productoId) }),
    ...(desde || hasta ? {
      fecha: {
        ...(desde && { gte: new Date(desde) }),
        ...(hasta && { lte: new Date(hasta + "T23:59:59") }),
      }
    } : {}),
    ...(busqueda ? {
      OR: [
        { producto: { nombre: { contains: busqueda, mode: "insensitive" as const } } },
        { producto: { codigo: { contains: busqueda, mode: "insensitive" as const } } },
        { proveedor: { contains: busqueda, mode: "insensitive" as const } },
        { destinatario: { contains: busqueda, mode: "insensitive" as const } },
      ]
    } : {}),
  }

  const [movimientos, total, totalVigentes] = await Promise.all([
    prisma.movimientoBodega.findMany({
      where,
      include: {
        producto: {
          select: { id: true, codigo: true, nombre: true, unidad: true },
        },
        usuario: {
          select: { id: true, name: true, username: true },
        },
      },
      orderBy: { fecha: "desc" },
      skip,
      take: limite,
    }),
    prisma.movimientoBodega.count({ where }),
    prisma.movimientoBodega.count({
      where: { ...where, anulado: false, anulacionDeId: null }
    })
  ])

  return NextResponse.json({
    movimientos,
    total,
    totalVigentes,
    pagina,
    limite,
    totalPaginas: Math.ceil(total / limite),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN", "BODEGA")
  if (!auth.ok) return auth.response
  const { session } = auth

  const body = await req.json()
  const {
    tipo, cantidad, stockReal, documento, numeroDocumento,
    proveedor, destinatario, area, observacion, productoId
  } = body

  if (!tipo || !productoId) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
  }

  if (tipo === TipoMovimiento.AJUSTE) {
    if (stockReal === undefined || stockReal === null || stockReal < 0) {
      return NextResponse.json({ error: "El stock real contado es requerido y debe ser mayor o igual a 0" }, { status: 400 })
    }
    if (!observacion) {
      return NextResponse.json({ error: "El motivo del ajuste es obligatorio" }, { status: 400 })
    }
  } else {
    if (!cantidad || cantidad <= 0) {
      return NextResponse.json({ error: "La cantidad debe ser mayor a 0" }, { status: 400 })
    }
    if (!documento) {
      return NextResponse.json({ error: "El tipo de documento es requerido" }, { status: 400 })
    }
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const producto = await tx.productoBodega.findUnique({ where: { id: productoId } })

      if (!producto || !producto.activo) {
        throw new Error("Producto no encontrado o inactivo")
      }

      if (tipo === TipoMovimiento.AJUSTE) {
        const diferencia = stockReal - producto.stockActual

        if (diferencia === 0) {
          throw new Error("El stock real coincide con el sistema, no es necesario ajustar")
        }

        const movimiento = await tx.movimientoBodega.create({
          data: {
            tipo: TipoMovimiento.AJUSTE,
            cantidad: Math.abs(diferencia),
            documento: TipoDocumento.SIN_DOCUMENTO,
            observacion: `[AJUSTE] Stock anterior: ${producto.stockActual} → Stock real: ${stockReal}. Motivo: ${observacion}`,
            productoId,
            usuarioId: parseInt(session.user.id),
          },
        })

        await tx.productoBodega.update({
          where: { id: productoId },
          data: { stockActual: stockReal },
        })

        return movimiento
      }

      if (tipo === TipoMovimiento.SALIDA && producto.stockActual < cantidad) {
        throw new Error(`Stock insuficiente. Stock actual: ${producto.stockActual}`)
      }

      const movimiento = await tx.movimientoBodega.create({
        data: {
          tipo,
          cantidad,
          documento,
          numeroDocumento,
          proveedor,
          destinatario,
          area,
          observacion,
          productoId,
          usuarioId: parseInt(session.user.id),
        },
      })

      await tx.productoBodega.update({
        where: { id: productoId },
        data: {
          stockActual: tipo === TipoMovimiento.ENTRADA
            ? { increment: cantidad }
            : { decrement: cantidad },
        },
      })

      return movimiento
    })

    return NextResponse.json(resultado, { status: 201 })
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error al registrar movimiento"
    return NextResponse.json({ error: mensaje }, { status: 400 })
  }
}
