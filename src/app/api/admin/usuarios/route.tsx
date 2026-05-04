import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// GET - Listar todos los usuarios
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const usuarios = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      roleAnterior: true,
      roleExpiration: true,
      active: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(usuarios)
}

// POST - Crear nuevo usuario
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const body = await req.json()
  const { username, name, password, role } = body

  if (!username || !name || !password) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
  }

  const existe = await prisma.user.findUnique({ where: { username } })
  if (existe) {
    return NextResponse.json({ error: "El nombre de usuario ya existe" }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const usuario = await prisma.user.create({
    data: {
      username,
      name,
      password: hashedPassword,
      role: role || "VIEWER",
    },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      roleAnterior: true,
      roleExpiration: true,
      active: true,
      createdAt: true,
    },
  })

  return NextResponse.json(usuario, { status: 201 })
}

// PUT - Actualizar usuario (rol o estado activo)
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const body = await req.json()
  const { id, role, active, password, nombre, roleExpiration } = body

  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 })

  // Evitar que el admin se desactive a sí mismo
  if (parseInt(session.user.id) === id && active === false) {
    return NextResponse.json({ error: "No puedes desactivarte a ti mismo" }, { status: 400 })
  }

  if (password !== undefined && password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
  }

  const usuarioActual = await prisma.user.findUnique({where: {id}})

  const datosActualizar: Record<string, unknown> = {}
  if (active !== undefined) datosActualizar.active = active
  if (password) datosActualizar.password = await bcrypt.hash(password, 10)
  if (nombre) datosActualizar.name = nombre
  if (role) {
    datosActualizar.role = role
    if (roleExpiration) {
      datosActualizar.roleExpiration = new Date(roleExpiration)
      datosActualizar.roleAnterior = usuarioActual?.role
    } else {
      datosActualizar.roleExpiration = null
      datosActualizar.roleAnterior = null
    }
  }

  const usuario = await prisma.user.update({
    where: { id },
    data: datosActualizar,
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      roleAnterior: true,
      roleExpiration: true,
      active: true,
      createdAt: true,
    },
  })

  return NextResponse.json(usuario)
}