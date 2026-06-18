# Módulo Gestión de Flota
> **Estado:** En producción (main). Fase 1 completa + extensiones aplicadas. Rama `modulo/flota` activa para desarrollo.
> **Rama activa desarrollo:** `modulo/flota` (rebased sobre main 2026-06-02)
> **Roles:** `FLOTA` (Conductor) · `ENCARGADO` (Encargado de Vehículos) · `ADMIN`

Gestión del parque vehicular municipal: vehículos, proceso de uso digital (solicitud → aprobación → checklist → orden de servicio → bitácora → cierre), mantenciones y alertas documentales.

---

## Contexto operativo

- ~15 vehículos entre livianos y maquinaria pesada (camioneta, camión aljibe, recolector de basura, retroexcavadora, etc.)
- Conductores son siempre funcionarios municipales → FK a `Funcionario` del módulo RRHH (nullable mientras RRHH no esté migrado)
- El flujo es el mismo para movimientos dentro y fuera de la comuna
- Actualmente el proceso es 100% en papel (bitácora, checklist, orden de servicio)
- Autorización requiere firma de Administrador, Alcalde o subrogante
- Encargado de vehículos, Control, Administrador y Alcalde deben poder auditar
- Conductores son en su mayoría 50+ años → UX simple, botones grandes, pasos claros, mobile-first

---

## Requisitos formales del encargado de vehículos

1. **Auditable por patente** — historial filtrable por vehículo
2. **Retención mínima 5 años** — sin hard delete en datos operativos
3. **Operable desde celulares** — diseño responsive (Tailwind)
4. **Control de acceso** — roles y autenticación (NextAuth)
5. **Proceso cerrado = inmutable** — correcciones son registros nuevos, no edición directa
6. **Múltiples auditores** — Mayor, Control, Admin, Encargado de vehículos
7. **Sistema modificable** — ítems de checklist configurables desde panel admin
8. **Demo a stakeholders** — Control, Administrador IMO, Alcalde, Encargado de vehículos
9. **Encargado puede adjuntar archivos** — SOAP, permiso circulación, seguro, etc. directamente al vehículo (almacenado en Supabase Storage)

---

## Flujo del proceso (estado digital — v2)

```
PENDIENTE → APROBADA → EN_CURSO → CERRADA (auto)
              └→ RECHAZADA
```

**Flujo completo desde creación:**
1. Conductor crea solicitud → estado PENDIENTE
2. Conductor completa **Checklist** (20 ítems + fotos del vehículo opcionales)
3. Conductor genera **Orden de Servicio** (hora estimada, folio FEDOKS opcional)
4. **Encargado/Admin** revisa y autoriza la OS → estado APROBADA
5. Conductor registra **km de salida** → estado EN_CURSO
6. Conductor registra **paradas** durante el viaje (km + motivo + combustible opcional)
7. Conductor registra **km de llegada + observaciones** → estado CERRADA **automáticamente** (inmutable, crea HojaVida)

Actores:
- **Conductor** — solicita, checklist, genera OS, registra km y combustible, cierra
- **Administrador / Alcalde / Subrogante** — aprueba solicitud, confirma OS
- **Encargado / Control / Admin** — auditan, adjuntan documentos al vehículo

---

## Integración FEDOKS

**Enfoque híbrido pragmático** — nuestro sistema controla el flujo operativo en tiempo real; FEDOKS queda como archivo documental oficial cuando el proceso lo exige formalmente.

### Orden de Servicio
- El sistema genera la OS con todos los datos precargados (conductor, vehículo, destino, propósito, hora estimada)
- Se puede exportar como **PDF** (via jspdf) listo para subir a FEDOKS
- El conductor registra el **folio FEDOKS** en el sistema (campo opcional, para trazabilidad)
- El autorizante **confirma en nuestro sistema** (usuario + timestamp) → desbloquea el paso operativo
- FEDOKS queda como respaldo documental cuando el proceso formal lo requiera

### Documentos que sí van a FEDOKS
- Actas de entrega/recepción de vehículo
- Informes de accidente o incidente
- Bajas de flota

### Lo que NO va a FEDOKS en operación diaria
- Solicitudes de uso (demasiado lento para operación diaria)
- Bitácora, checklist (datos operativos internos)

---

## Schema Prisma (Fase 1)

### Enums nuevos / modificados
```prisma
// Agregar a Role enum existente:
FLOTA

enum TipoVehiculo {
  CAMIONETA
  SEDAN
  CAMION_LIVIANO
  CAMION_PESADO
  MAQUINARIA
  BUS
  OTRO
}

enum EstadoVehiculo {
  OPERATIVO
  EN_MANTENCION
  FUERA_SERVICIO
  DADO_DE_BAJA
}

enum EstadoSolicitud {
  PENDIENTE
  APROBADA
  RECHAZADA
  EN_CURSO
  CERRADA
}

enum TipoMantencion {
  PREVENTIVA
  CORRECTIVA
  EMERGENCIA
}
```

### Modelos principales

```prisma
model Vehiculo {
  id                    Int             @id @default(autoincrement())
  patente               String          @unique
  marca                 String
  modelo                String
  anio                  Int
  tipo                  TipoVehiculo
  estado                EstadoVehiculo  @default(OPERATIVO)
  kmActual              Int             @default(0)
  vencimientoSOAP       DateTime?
  vencimientoRevTecnica DateTime?
  vencimientoPermiso    DateTime?
  observaciones         String?
  activo                Boolean         @default(true)
  createdAt             DateTime        @default(now())

  solicitudes    SolicitudVehiculo[]
  mantenciones   MantencionVehiculo[]
  hojaVida       HojaVidaVehiculo[]
  documentos     DocumentoVehiculo[]   // archivos adjuntos
}

// Archivos adjuntos al vehículo (SOAP, seguro, permiso, etc.)
model DocumentoVehiculo {
  id          Int      @id @default(autoincrement())
  vehiculoId  Int
  vehiculo    Vehiculo @relation(...)
  nombre      String
  tipo        String   // SOAP | PERMISO | SEGURO | REVISION_TECNICA | OTRO
  url         String   // URL en Supabase Storage
  subidoPorId Int
  subidoPor   User     @relation(...)
  fecha       DateTime @default(now())
}

model SolicitudVehiculo {
  id              Int             @id @default(autoincrement())
  vehiculoId      Int
  vehiculo        Vehiculo        @relation(...)
  conductorId     Int?            // nullable mientras RRHH no esté migrado
  conductor       Funcionario?    @relation(...)
  conductorNombre String          // nombre libre como fallback hasta integrar RRHH
  estado          EstadoSolicitud @default(PENDIENTE)
  destino         String
  proposito       String
  fechaSolicitud  DateTime        @default(now())
  // Aprobación
  aprobadoPorId   Int?
  aprobadoPor     User?           @relation("AprobacionFlota", ...)
  fechaAprobacion DateTime?
  motivoRechazo   String?
  // Cierre
  fechaCierre     DateTime?
  cerradoPorId    Int?
  cerradoPor      User?           @relation("CierreFlota", ...)

  checklist       ChecklistSolicitud?
  ordenServicio   OrdenServicio?
  bitacora        BitacoraViaje?
  hojaVida        HojaVidaVehiculo[]
}

model ChecklistSolicitud {
  id            Int               @id @default(autoincrement())
  solicitudId   Int               @unique
  solicitud     SolicitudVehiculo @relation(...)
  completadoEn  DateTime          @default(now())
  respuestas    ChecklistRespuesta[]
}

// Items configurables desde panel admin — genéricos, solo cambia imagen por TipoVehiculo
model ChecklistItem {
  id          Int      @id @default(autoincrement())
  categoria   String   // DOCUMENTACION | NIVELES | ELECTRICO | SISTEMAS | GENERAL
  descripcion String
  orden       Int
  activo      Boolean  @default(true)
  respuestas  ChecklistRespuesta[]
}

model ChecklistRespuesta {
  id          Int                @id @default(autoincrement())
  checklistId Int
  checklist   ChecklistSolicitud @relation(...)
  itemId      Int
  item        ChecklistItem      @relation(...)
  valor       String             // OK | NO_OK | NA
  observacion String?
}

model OrdenServicio {
  id             Int               @id @default(autoincrement())
  solicitudId    Int               @unique
  solicitud      SolicitudVehiculo @relation(...)
  horaSalidaEst  DateTime
  horaRetornoEst DateTime?
  folioFedoks    String?           // referencia opcional al expediente FEDOKS
  firmadaPorId   Int?
  firmadaPor     User?             @relation(...)
  fechaFirma     DateTime?
  firmada        Boolean           @default(false)
}

model BitacoraViaje {
  id              Int               @id @default(autoincrement())
  solicitudId     Int               @unique
  solicitud       SolicitudVehiculo @relation(...)
  kmSalida        Int
  kmLlegada       Int?              // null hasta el retorno
  horaRetornoReal DateTime?
  observacion     String?
  registradoEn    DateTime          @default(now())

  paradas         ParadaViaje[]
}

// Parada durante el viaje — km obligatorio, motivo + combustible opcionales, pasajeros opcionales
model ParadaViaje {
  id             Int             @id @default(autoincrement())
  bitacoraId     Int
  bitacora       BitacoraViaje   @relation(...)
  km             Int
  descripcion    String?
  litros         Float?
  comprobanteRef String?
  fecha          DateTime        @default(now())
  pasajeros      PasajeroViaje[]
}

// Pasajeros por parada — con RUT opcional para autocompletado en futuros viajes
model PasajeroViaje {
  id        Int         @id @default(autoincrement())
  paradaId  Int
  parada    ParadaViaje @relation(..., onDelete: Cascade)
  nombre    String
  rut       String?
}

model HojaVidaVehiculo {
  id          Int               @id @default(autoincrement())
  vehiculoId  Int
  vehiculo    Vehiculo          @relation(...)
  solicitudId Int?
  solicitud   SolicitudVehiculo? @relation(...)
  tipo        String            // USO | MANTENCION | CORRECCION | ALERTA | DOCUMENTO
  descripcion String
  usuarioId   Int
  usuario     User              @relation(...)
  fecha       DateTime          @default(now())
}

model MantencionVehiculo {
  id           Int            @id @default(autoincrement())
  vehiculoId   Int
  vehiculo     Vehiculo       @relation(...)
  tipo         TipoMantencion
  fecha        DateTime
  taller       String?
  costo        Float?
  kmAlMomento  Int?
  descripcion  String?
  registradoEn DateTime       @default(now())
  usuarioId    Int
  usuario      User           @relation(...)
}
```

---

## Decisiones de diseño UX (conductores 50+)

- Pasos del proceso como **stepper grande** — siempre visible en qué etapa está
- Cada paso tiene **una sola acción principal** — botón grande y claro
- Checklist con botones grandes OK / NO OK / N/A (no checkboxes pequeños)
- Imagen referencial del vehículo/maquinaria en el checklist (cambia según `TipoVehiculo`)
- Registro de km y combustible con inputs numéricos grandes, teclado numérico en móvil (`inputMode="numeric"`)
- Textos de estado claros: "Esperando aprobación", "Listo para salir", "En viaje", "Cerrado"

---

## Roadmap

### Fase 1 — Proceso digital completo
- [x] Schema Prisma + migración + `FLOTA` en enum Role
- [x] CRUD vehículos + alertas documentales en listado
- [x] Hoja de vida del vehículo (vista detalle)
- [x] Links navbar (Flota para ADMIN+FLOTA, Mis Solicitudes para FLOTA)
- [x] Subida de archivos al vehículo (Supabase Storage — bucket `flota-docs`, server-side con service role key)
- [x] Solicitud de uso + aprobación/rechazo
- [x] Checklist digital (20 ítems en 5 categorías, seed en prisma/seed-checklist.ts)
- [x] Orden de Servicio + confirmación + PDF descargable
- [x] Bitácora: km salida, paradas múltiples (km + motivo + combustible opcional), km llegada
- [x] Cierre de proceso (inmutable, auto-registra en hoja de vida)
- [x] Links en campana de alertas (vencidos en rojo, por vencer en amarillo)
- [x] Roles FLOTA (Conductor) + ENCARGADO (Encargado Vehículos) en src/lib/roles.ts
- [x] ENCARGADO: firma OS, crea vehículos, ve todas las solicitudes
- [x] Imagen por vehículo (upload/delete Supabase Storage, visible en checklist)
- [x] Observaciones en todos los ítems checklist (obligatoria para NO OK)
- [x] Navbar responsive con hamburger menu móvil
- [x] Hardening: validaciones km, estado vehículo, alertas por rol, tipos TypeScript
- [x] **Flujo v2 (2026-06-08):** checklist + OS disponibles desde creación (sin aprobación previa); encargado autoriza OS; km llegada auto-cierra proceso; fotos del vehículo en checklist (FRONTAL/LATERAL x2/POSTERIOR, captura cámara móvil)
- [x] **Pasajeros por parada (2026-06-17):** campo opcional en cada parada del viaje; autocompletado por nombre/RUT desde historial de viajes anteriores; modelo `PasajeroViaje` con `onDelete: Cascade` desde `ParadaViaje`; API `GET /api/flota/pasajeros/buscar?q=`

### Fase 2 — Mantenciones y reportes
- [ ] Registro de mantenciones (modelo MantencionVehiculo ya existe en schema)
- [ ] Reporte consumo combustible mensual por vehículo (datos ya en ParadaViaje)
- [ ] Reporte costo mensual por vehículo (combustible + mantención)
- [ ] Exportación Excel/PDF

### Fase 3 — Admin avanzado
- [ ] Panel configuración ítems checklist
- [ ] Correcciones formales post-cierre auditadas
- [ ] Historial por conductor/funcionario
- [ ] Integración FK Funcionario cuando RRHH esté migrado
- [ ] Vista del checklist completado en detalle de solicitud (auditoría)

### Tareas de seguridad y UX pendientes
- [ ] **Seguridad:** validar en API GET /solicitudes/[id] que FLOTA solo vea sus propias solicitudes
- [ ] **Notificaciones:** avisar al conductor cuando su solicitud es aprobada/rechazada
- [ ] **Reporte combustible:** resumen mensual litros/viajes por vehículo (datos en ParadaViaje.litros)
- [ ] **UI móvil:** corregir errores visuales en móvil (pendiente pruebas con entorno local)

### Entorno de desarrollo local — CONFIGURADO
- Docker Desktop instalado. docker-compose.yml + .env.local configurados y funcionando
- **Plan:** docker-compose.yml con PostgreSQL local + .env.local con variables locales
- **Storage local:** reemplazar Supabase Storage con filesystem local (`public/uploads/`) en dev
- **Objetivo:** poder iterar UI sin internet ni deploy a Vercel
- `.env.local` creado con `NEXTAUTH_URL=http://localhost:3000` (en .gitignore)

---

## Estructura de archivos prevista

```
src/app/
  flota/
    page.tsx                          ← panel vehículos + alertas doc
    solicitudes/
      page.tsx                        ← mis solicitudes / todas (por rol)
      nueva/page.tsx
      [id]/
        page.tsx                      ← detalle + stepper del proceso
        checklist/page.tsx
        orden/page.tsx
        bitacora/page.tsx
    vehiculos/
      nuevo/page.tsx
      [id]/
        page.tsx                      ← hoja de vida + docs adjuntos
        editar/page.tsx

src/app/api/flota/
  vehiculos/route.ts
  vehiculos/[id]/route.ts
  vehiculos/[id]/documentos/route.ts
  solicitudes/route.ts
  solicitudes/[id]/route.ts
  solicitudes/[id]/aprobar/route.ts
  solicitudes/[id]/rechazar/route.ts
  solicitudes/[id]/checklist/route.ts
  solicitudes/[id]/orden/route.ts
  solicitudes/[id]/orden/firmar/route.ts
  solicitudes/[id]/bitacora/route.ts
  solicitudes/[id]/bitacora/carga/route.ts
  solicitudes/[id]/cerrar/route.ts
  alertas/route.ts
```

---

## Notas técnicas

- **Inmutabilidad:** Al cerrar, todas las rutas PATCH/POST verifican `estado !== CERRADA`
- **Correcciones post-cierre:** Nuevos registros en `HojaVidaVehiculo` tipo `CORRECCION`
- **Archivos adjuntos:** Supabase Storage bucket `flota-docs`, URL pública guardada en `DocumentoVehiculo.url`
- **Checklist imagen referencial:** componente muestra imagen según `vehiculo.tipo` (`/images/flota/camioneta.png`, `/images/flota/maquinaria.png`, etc.)
- **Combustible múltiple:** `CargaCombustible[]` relación desde `BitacoraViaje` — la bitácora se crea al registrar km salida y se cierra con km llegada
- **Conductor fallback:** `conductorNombre` (texto libre) mientras RRHH no esté migrado; cuando se integre RRHH, `conductorId` pasa a required
- **Alertas documentales:** se integran en `/api/alertas` existente con nuevos campos `vehiculosDocVencidos` y `vehiculosDocPorVencer`
