# Módulo Gestión de Flota
> **Estado:** Flujo v2 en producción (main). Flujo v3 (sin doble-aprobación + licencias + documentos configurables + observaciones) en rama `modulo/flota-v3`, commiteado localmente, pendiente de push/merge.
> **Rama activa desarrollo:** `modulo/flota-v3` (creada desde main 2026-06-18)
> **Roles:** `FLOTA` (Conductor) · `ENCARGADO` (Encargado de Vehículos) · `ADMIN`

Gestión del parque vehicular municipal: vehículos, proceso de uso digital (solicitud+OS → firma encargado → checklist → bitácora → cierre), roster de conductores con tipo de licencia, documentos configurables con alertas, observaciones del vehículo y mantenciones.

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

## Flujo del proceso (estado digital — v3)

```
PENDIENTE → APROBADA → EN_CURSO → CERRADA (auto)
              └→ RECHAZADA
```

**Flujo completo desde creación (sin doble-aprobación):**
1. Conductor elige **vehículo** (lista filtrada según su tipo de licencia, vía roster de conductores) y crea **solicitud + Orden de Servicio en un solo paso** (destino, propósito, hora salida/retorno estimada, folio FEDOKS opcional) → estado PENDIENTE
2. **Encargado/Admin** autoriza o rechaza la OS directamente (ya no requiere que el checklist exista primero) → estado APROBADA
3. Conductor completa el **Checklist** (20 ítems, todos parten en **OK por defecto** — solo cambia los que detecte con problemas — + fotos del vehículo opcionales). Cada ítem NO_OK genera automáticamente una **Observación** del vehículo
4. Conductor registra **km de salida** (sugerido automáticamente desde el último km registrado del vehículo) → estado EN_CURSO
5. Conductor registra **paradas** durante el viaje (km + motivo + pasajeros opcionales con autocompletado + combustible opcional)
6. Conductor registra **km de llegada + observaciones** → estado CERRADA **automáticamente** (inmutable, crea HojaVida)

Actores:
- **Conductor** — crea solicitud+OS, completa checklist, registra km/paradas/combustible, cierra
- **Encargado / Admin** — autoriza o rechaza la OS, gestiona roster de conductores, catálogo de documentos, y observaciones del vehículo (cerrar, anotar, adjuntar archivo)

### Bug corregido en v3
El flujo v2 (checklist + generar OS mientras la solicitud seguía `PENDIENTE`) nunca pudo guardar el checklist en producción: la API `checklist/route.ts` exigía `estado === "APROBADA"` pero el frontend lo pedía antes de la firma. v3 resuelve esto moviendo el checklist a después de la firma, donde la validación de estado ya es coherente con el flujo real.

### Licencias de conductor → restricción de vehículos
- `ConductorFlota`: nombre, rut, numeroCaucion, numeroLicencia, tipoLicencia, fechaLicencia, vínculo opcional a un `User` (rol FLOTA) vía `userId`
- `Vehiculo.licenciasPermitidas String[]`: tipos de licencia habilitados para ese vehículo (vacío = sin restricción)
- Al crear una solicitud: si el usuario logueado tiene un conductor vinculado, se detecta automático (vía `session.user.conductorFlotaId`); si no, autocomplete por nombre/RUT (mismo patrón que `PasajerosInput`)
- El `<select>` de vehículo en "nueva solicitud" se filtra client-side por `licenciasPermitidas.includes(conductor.tipoLicencia)`
- Gestión del roster en `/flota/conductores` (ENCARGADO/ADMIN)

### Documentos configurables por vehículo
- Las 3 columnas fijas (`vencimientoSOAP`, `vencimientoRevTecnica`, `vencimientoPermiso`) se reemplazaron por un catálogo `TipoDocumentoVehiculo` (nombre, díasAlertaDefault, esDefault) + `VencimientoDocumentoVehiculo` (fecha por vehículo, override opcional de días de alerta)
- Los 3 tipos default (SOAP, Revisión técnica, Permiso de circulación) se sembraron con 30 días de alerta y no se pueden eliminar, solo editar el umbral
- Encargado/Admin puede agregar nuevos tipos desde `/flota/documentos-config`
- El cron `/api/cron/alertas-email` incluye una sección de vencimientos de flota usando el umbral configurado por tipo

### Observaciones del vehículo
- Cada respuesta NO_OK del checklist crea una `ObservacionVehiculo` (origen CHECKLIST) + una entrada en `HojaVidaVehiculo` (tipo OBSERVACION) para la línea de tiempo
- Encargado/Admin también puede crear observaciones manuales desde la ficha del vehículo (origen MANUAL)
- Panel "Observaciones" en `/flota/vehiculos/[id]`: abiertas primero con botones para cerrar/reabrir, agregar nota o adjuntar archivo (reutiliza `src/lib/storage.ts`); cerradas colapsadas como historial

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
  licenciasPermitidas   String[]        @default([]) // vacío = sin restricción
  observaciones         String?
  activo                Boolean         @default(true)
  createdAt             DateTime        @default(now())

  solicitudes    SolicitudVehiculo[]
  mantenciones   MantencionVehiculo[]
  hojaVida       HojaVidaVehiculo[]
  documentos     DocumentoVehiculo[]   // archivos adjuntos
  vencimientos   VencimientoDocumentoVehiculo[]
  observacionesVehiculo ObservacionVehiculo[]
}

// Roster de choferes — independiente del login, vinculable opcionalmente a un User
model ConductorFlota {
  id             Int       @id @default(autoincrement())
  nombre         String
  rut            String?
  numeroCaucion  String?
  numeroLicencia String?
  tipoLicencia   String    // B | A1 | A2 | A3 | A4 | A5 | C | D | F
  fechaLicencia  DateTime?
  activo         Boolean   @default(true)
  userId         Int?      @unique
  user           User?     @relation(...)

  solicitudes SolicitudVehiculo[]
}

// Catálogo configurable de documentos (SOAP/Rev.Técnica/Permiso vienen por defecto)
model TipoDocumentoVehiculo {
  id                Int     @id @default(autoincrement())
  nombre            String
  diasAlertaDefault Int     @default(30)
  esDefault         Boolean @default(false)
  activo            Boolean @default(true)

  vencimientos VencimientoDocumentoVehiculo[]
}

model VencimientoDocumentoVehiculo {
  id               Int                   @id @default(autoincrement())
  vehiculoId       Int
  vehiculo         Vehiculo              @relation(...)
  tipoDocumentoId  Int
  tipoDocumento    TipoDocumentoVehiculo @relation(...)
  fechaVencimiento DateTime
  diasAlerta       Int?                  // override de diasAlertaDefault

  @@unique([vehiculoId, tipoDocumentoId])
}

// Observación rastreable del vehículo (daño, neumático, etc.)
model ObservacionVehiculo {
  id           Int                 @id @default(autoincrement())
  vehiculoId   Int
  vehiculo     Vehiculo            @relation(...)
  solicitudId  Int?
  solicitud    SolicitudVehiculo?  @relation(...)
  origen       String              // CHECKLIST | MANUAL
  descripcion  String
  estado       String              @default("ABIERTA") // ABIERTA | CERRADA
  creadoPorId  Int?
  cerradoPorId Int?
  fechaCierre  DateTime?

  notas    ObservacionNota[]
  archivos ObservacionArchivo[]
}

model ObservacionNota {
  id            Int                 @id @default(autoincrement())
  observacionId Int
  observacion   ObservacionVehiculo @relation(..., onDelete: Cascade)
  texto         String
  autorId       Int
}

model ObservacionArchivo {
  id            Int                 @id @default(autoincrement())
  observacionId Int
  observacion   ObservacionVehiculo @relation(..., onDelete: Cascade)
  nombre        String
  url           String
  subidoPorId   Int
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
  conductorId      Int?            // reservado para FK a Funcionario cuando RRHH esté migrado
  conductorFlotaId Int?            // FK al roster ConductorFlota (licencias)
  conductorFlota   ConductorFlota? @relation(...)
  conductorNombre  String          // snapshot denormalizado del nombre al crear la solicitud
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
  tipo        String            // USO | MANTENCION | CORRECCION | ALERTA | DOCUMENTO | CHECKLIST | OBSERVACION
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
- [x] **Flujo v3 (2026-06-18, rama `modulo/flota-v3`):** solicitud+OS se crean juntas (un solo paso, vehículo por `<select>`); encargado autoriza directo sin checklist previo; checklist se mueve después de la firma con todos los ítems en OK por defecto; corrige bug donde el checklist nunca podía guardarse en v2; km salida sugerido desde último km del vehículo
- [x] **Roster de conductores + licencias (2026-06-18):** modelo `ConductorFlota` (nombre, rut, caución, licencia, tipo, fecha), vínculo opcional a `User`; `Vehiculo.licenciasPermitidas` filtra el selector de vehículo en nueva solicitud; gestión en `/flota/conductores`
- [x] **Documentos configurables (2026-06-18):** catálogo `TipoDocumentoVehiculo` con plazo de alerta editable reemplaza los 3 campos fijos de vencimiento; migración con backfill de datos existentes; gestión en `/flota/documentos-config`; cron de alertas extendido
- [x] **Observaciones del vehículo (2026-06-18):** cada NO_OK del checklist genera una `ObservacionVehiculo` rastreable; panel consolidado en la ficha del vehículo con cerrar/reabrir, notas y archivos adjuntos

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
- [ ] **Merge pendiente:** `modulo/flota-v3` está commiteado localmente (commit `91cded7`) pero sin push — el usuario pidió revisar el diff antes de subirlo
- [ ] **Vista checklist completado:** mostrar respuestas item por item en el detalle de la solicitud cerrada (actualmente solo se ve el resumen en hoja de vida)
- [ ] **Vincular cross-reference:** las entradas de Hoja de Vida tipo OBSERVACION no enlazan directamente al registro `ObservacionVehiculo` correspondiente (coinciden por texto/fecha, no por FK) — posible mejora futura

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
      nueva/page.tsx                  ← crea solicitud+OS junto (conductor + vehículo filtrado por licencia)
      [id]/page.tsx                   ← detalle + stepper del proceso (5 pasos v3)
    vehiculos/
      nuevo/page.tsx                  ← incluye licenciasPermitidas + vencimientos dinámicos
      [id]/
        page.tsx                      ← hoja de vida + docs adjuntos + panel Observaciones
        editar/page.tsx
    conductores/
      page.tsx                        ← roster (ENCARGADO/ADMIN)
      nuevo/page.tsx
      [id]/editar/page.tsx
    documentos-config/page.tsx        ← catálogo TipoDocumentoVehiculo (ENCARGADO/ADMIN)

src/app/api/flota/
  vehiculos/route.ts
  vehiculos/[id]/route.ts             ← PATCH acepta licenciasPermitidas + vencimientos[] en transacción
  vehiculos/[id]/documentos/route.ts
  vehiculos/[id]/observaciones/route.ts
  conductores/route.ts
  conductores/[id]/route.ts
  conductores/buscar/route.ts        ← autocomplete nombre/RUT
  conductores/usuarios-flota/route.ts ← Users rol FLOTA para vincular
  tipos-documento/route.ts
  tipos-documento/[id]/route.ts
  observaciones/[id]/route.ts        ← PATCH cerrar/reabrir
  observaciones/[id]/notas/route.ts
  observaciones/[id]/archivos/route.ts
  solicitudes/route.ts                ← POST crea SolicitudVehiculo + OrdenServicioFlota juntos
  solicitudes/[id]/route.ts
  solicitudes/[id]/rechazar/route.ts
  solicitudes/[id]/checklist/route.ts ← NO_OK genera ObservacionVehiculo + HojaVidaVehiculo
  solicitudes/[id]/orden/firmar/route.ts
  solicitudes/[id]/bitacora/route.ts
  solicitudes/[id]/bitacora/parada/route.ts
  solicitudes/[id]/cerrar/route.ts
  ../alertas/route.ts
  ../cron/alertas-email/route.ts      ← incluye vencimientos de documentos de flota
```

---

## Notas técnicas

- **Inmutabilidad:** Al cerrar, todas las rutas PATCH/POST verifican `estado !== CERRADA`
- **Correcciones post-cierre:** Nuevos registros en `HojaVidaVehiculo` tipo `CORRECCION`
- **Archivos adjuntos:** Supabase Storage bucket `flota-docs`, URL pública guardada en `DocumentoVehiculo.url`
- **Checklist imagen referencial:** componente muestra imagen según `vehiculo.tipo` (`/images/flota/camioneta.png`, `/images/flota/maquinaria.png`, etc.)
- **Combustible múltiple:** `CargaCombustible[]` relación desde `BitacoraViaje` — la bitácora se crea al registrar km salida y se cierra con km llegada
- **Conductor:** `conductorNombre` es snapshot denormalizado (se llena desde `ConductorFlota.nombre` o nombre libre si no hay roster); `conductorId` queda reservado para la futura FK a `Funcionario` de RRHH; `conductorFlotaId` es el nuevo vínculo al roster de licencias
- **Alertas documentales:** se integran en `/api/alertas` existente con nuevos campos `vehiculosDocVencidos` y `vehiculosDocPorVencer`, ahora calculados desde `VencimientoDocumentoVehiculo` con umbral configurable por tipo (no más 30 días fijo)
- **Detección automática de conductor:** `session.user.conductorFlotaId` se resuelve en el callback `jwt`/`session` de NextAuth (`src/app/api/auth/[...nextauth]/route.ts`) a partir de `User.conductorFlota` — requiere relogin si se vincula/desvincula después de iniciar sesión
