# IMO Gestión — Contexto Core

Sistema de gestión municipal para la **Municipalidad de Ollagüe**. Integra múltiples módulos sobre una única base técnica y base de datos.

## Módulos
| Módulo | Estado | Contexto detallado |
|--------|--------|--------------------|
| **Bodega Municipal** | ✅ Producción | `contexto_bodega.md` |
| **Farmacia Posta Rural** | ✅ Producción | `contexto_farmacia.md` |
| **RRHH** | 🔧 En desarrollo (Fase 1) | `contexto_rrhh.md` |
| **Gestión de Flota** | 📋 Planificación futura | `contexto_flota.md` |

---

## Stack técnico
- **Framework:** Next.js 16 (App Router, RSC + "use client")
- **ORM:** Prisma 7 con PostgreSQL
- **Auth:** NextAuth.js v4 (JWT, credentials)
- **UI:** Tailwind CSS v4
- **Gráficos:** Recharts
- **Exportación:** jsPDF + xlsx
- **Email:** nodemailer

---

## Autenticación y Roles

### Roles del sistema
| Rol | Cantidad | Acceso |
|-----|----------|--------|
| ADMIN | 2 | Todo el sistema + gestión de usuarios |
| BODEGA | 2 | Solo módulo bodega |
| FARMACIA | 3-4 | Solo módulo farmacia + pacientes |
| RRHH | 2-3 | Solo módulo RRHH |
| FLOTA | — | Solo módulo flota *(futuro)* |
| VIEWER | — | Solo lectura |

**Subrogancia temporal:** un admin puede asignar un rol distinto con fecha de expiración; un cron (`/api/cron/revertir-roles`) revierte automáticamente al rol original.

### Auth centralizada
Todas las rutas API usan `requireAuth()` o `requireRole(...roles)` de `src/lib/apiAuth.ts`. No hay acceso directo a sesión en rutas API.

---

## Infraestructura compartida

### `src/lib/`
| Archivo | Propósito |
|---------|-----------|
| `apiAuth.ts` | `requireAuth()` / `requireRole()` — guard centralizado para todas las rutas API |
| `prisma.ts` | Prisma client singleton |
| `mailer.ts` | nodemailer transporter + constantes EMAIL_FROM / EMAIL_ADMINS |
| `types.ts` | Enums compartidos entre módulos |
| `validarRut.ts` | Validación y formateo de RUT chileno (usado en farmacia, RRHH) |

### `src/components/`
| Componente | Propósito |
|------------|-----------|
| `Layout.tsx` | Nav principal con badge de alertas, menú condicional por rol |
| `BuscadorCodigo.tsx` | Autocomplete por código/nombre (bodega y farmacia) |
| `BuscadorPaciente.tsx` | Autocomplete paciente + creación inline (farmacia) |
| `ModalAnular.tsx` | Modal de confirmación para anulación de movimientos |
| `ModalConfirmar.tsx` | Modal genérico de confirmación |

### Rutas compartidas
```
/api/auth/[...nextauth]/   — NextAuth config + authOptions
/api/admin/usuarios/       — CRUD usuarios + subrogancia
/api/admin/actividad/      — Informe actividad por usuario
/api/alertas/              — Contadores de alertas activas (badge del nav)
/api/cron/revertir-roles/  — Revierte subrogancias expiradas
/api/cron/alertas-email/   — Email HTML con alertas críticas (protegido por CRON_SECRET)
/api/dashboard/stats/      — KPIs del dashboard principal
```

---

## Patrones y decisiones técnicas transversales

- **Anulación de movimientos:** nunca se borra — se crea movimiento inverso vinculado. `anulado=true` + `anulacionDeId` en el original.
- **SCD (Slowly Changing Dimension):** cambios en productos/medicamentos cierran el registro anterior (`validoHasta`) y crean uno nuevo.
- **Soft delete:** entidades principales se desactivan (`activo=false`), nunca se eliminan físicamente.
- **Auth en API:** 100% via `requireAuth()` / `requireRole()` — no hay rutas públicas excepto `/api/auth/`.
- **RUT chileno:** `validarRut.ts` — validación con dígito verificador + formateo `XX.XXX.XXX-X`.
- **Cron jobs:** protegidos por header `Authorization: Bearer CRON_SECRET`. Ejecutables externamente (Vercel Cron, cURL, etc.).
- **Exportación:** patrón uniforme con xlsx para Excel y jsPDF + autotable para PDF en todos los módulos.

---

## Variables de entorno
```
DATABASE_URL=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...

# Email (alertas automáticas)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
ALERT_EMAILS=admin1@...,admin2@...
CRON_SECRET=...
```

---

## Modelo de datos — User (compartido)
```prisma
model User {
  id             Int       @id @default(autoincrement())
  email          String    @unique
  password       String
  nombre         String
  rol            Role
  rolOriginal    Role?
  subroganciafin DateTime?
  activo         Boolean   @default(true)
  createdAt      DateTime  @default(now())
}

enum Role {
  ADMIN
  BODEGA
  FARMACIA
  RRHH
  FLOTA
  VIEWER
}
```
