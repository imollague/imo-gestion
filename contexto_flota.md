# Módulo Gestión de Flota
> **Estado:** Diseño completo — listo para codificar Fase 1
> **Rama:** `modulo/flota`
> **Rol requerido:** `FLOTA` (conductor / encargado) + `ADMIN`

Gestión del parque vehicular municipal: vehículos, proceso de uso digital (solicitud → aprobación → checklist → orden de servicio → bitácora → cierre), mantenciones y alertas documentales.

---

## Contexto operativo

- ~15 vehículos entre livianos y maquinaria pesada (camioneta, camión aljibe, recolector de basura, retroexcavadora, etc.)
- Conductores son siempre funcionarios municipales → FK a `Funcionario` del módulo RRHH
- Actualmente el proceso es 100% en papel (bitácora, checklist, orden de servicio)
- Autorización requiere firma de Administrador, Alcalde o subrogante
- Encargado de vehículos, Control, Administrador y Alcalde deben poder auditar

---

## Requisitos formales del encargado de vehículos

1. **Auditable por patente** — historial filtrable por vehículo
2. **Retención mínima 5 años** — sin hard delete en datos operativos
3. **Operable desde celulares** — diseño responsive (Tailwind ya lo cubre)
4. **Control de acceso** — roles y autenticación (ya resuelto con NextAuth)
5. **Proceso cerrado = inmutable** — correcciones son registros nuevos asociados, no edición directa
6. **Múltiples auditores** — Mayor, Control, Admin, Encargado de vehículos
7. **Sistema modificable** — checklist configurable desde panel admin
8. **Demo a stakeholders** — Control, Administrador IMO, Alcalde, Encargado de vehículos

---

## Flujo del proceso (estado digital)

```
PENDIENTE → APROBADA → EN_CURSO → CERRADA
              └→ RECHAZADA
```

Dentro de APROBADA → EN_CURSO ocurren (en orden):
1. Conductor completa **Checklist** del vehículo
2. Conductor genera **Orden de Servicio** → espera firma del autorizante
3. Autorizante firma Orden de Servicio digitalmente (confirma en sistema)
4. Conductor registra **Bitácora** (km salida/llegada, combustible)
5. Conductor agrega observación en **Hoja de Vida** del vehículo
6. Conductor **cierra** el proceso → estado CERRADA (inmutable)

Flujo de actores:
- **Conductor** — solicita, realiza checklist, genera orden, llena bitácora, cierra
- **Administrador / Alcalde / Subrogante** — aprueba solicitud, firma orden de servicio
- **Encargado de vehículos / Control / Admin** — auditan en cualquier punto

---

## Schema Prisma (Fase 1)

### Enum nuevo
```prisma
// Agregar a Role enum:
FLOTA

// Nuevos enums:
enum TipoVehiculo {
  CAMIONETA
  SEDAN
  CAMION
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

enum TipoMantención {
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
  año                   Int
  tipo                  TipoVehiculo
  estado                EstadoVehiculo  @default(OPERATIVO)
  kmActual              Int             @default(0)
  // Vencimientos documentales
  vencimientoSOAP       DateTime?
  vencimientoRevTecnica DateTime?
  vencimientoPermiso    DateTime?
  observaciones         String?
  activo                Boolean         @default(true)
  createdAt             DateTime        @default(now())

  solicitudes    SolicitudVehiculo[]
  mantenciones   MantencionVehiculo[]
  hojaVida       HojaVidaVehiculo[]
}

model SolicitudVehiculo {
  id              Int             @id @default(autoincrement())
  vehiculoId      Int
  vehiculo        Vehiculo        @relation(...)
  conductorId     Int             // FK Funcionario
  conductor       Funcionario     @relation(...)
  estado          EstadoSolicitud @default(PENDIENTE)
  destino         String
  proposito       String
  fechaSolicitud  DateTime        @default(now())
  // Aprobación
  aprobadoPorId   Int?            // FK User (Admin/Alcalde)
  aprobadoPor     User?           @relation(...)
  fechaAprobacion DateTime?
  motivoRechazo   String?
  // Cierre
  fechaCierre     DateTime?
  cerradoPorId    Int?

  checklist       ChecklistSolicitud?
  ordenServicio   OrdenServicio?
  bitacora        BitacoraViaje?
  observaciones   HojaVidaVehiculo[]
}

model ChecklistSolicitud {
  id            Int               @id @default(autoincrement())
  solicitudId   Int               @unique
  solicitud     SolicitudVehiculo @relation(...)
  completadoEn  DateTime          @default(now())
  respuestas    ChecklistRespuesta[]
}

model ChecklistItem {
  // Configurable desde admin
  id         Int      @id @default(autoincrement())
  categoria  String   // DOCUMENTACION | NIVELES | ELECTRICO | SISTEMAS | GENERAL
  descripcion String
  orden      Int
  activo     Boolean  @default(true)
  respuestas ChecklistRespuesta[]
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
  id              Int               @id @default(autoincrement())
  solicitudId     Int               @unique
  solicitud       SolicitudVehiculo @relation(...)
  horaSalida      DateTime
  horaRetornoEst  DateTime?
  firmadaPorId    Int?              // FK User que autoriza
  firmadaPor      User?             @relation(...)
  fechaFirma      DateTime?
  firmada         Boolean           @default(false)
}

model BitacoraViaje {
  id               Int               @id @default(autoincrement())
  solicitudId      Int               @unique
  solicitud        SolicitudVehiculo @relation(...)
  kmSalida         Int
  kmLlegada        Int
  litrosCombustible Float?
  comprobanteRef   String?
  horaRetornoReal  DateTime?
  observacion      String?
  registradoEn     DateTime          @default(now())
}

model HojaVidaVehiculo {
  id          Int      @id @default(autoincrement())
  vehiculoId  Int
  vehiculo    Vehiculo @relation(...)
  solicitudId Int?     // null si es mantención u otro evento
  tipo        String   // USO | MANTENCION | CORRECCION | ALERTA
  descripcion String
  usuarioId   Int
  usuario     User     @relation(...)
  fecha       DateTime @default(now())
}

model MantencionVehiculo {
  id          Int            @id @default(autoincrement())
  vehiculoId  Int
  vehiculo    Vehiculo       @relation(...)
  tipo        TipoMantención
  fecha       DateTime
  taller      String?
  costo       Float?
  kmAlMomento Int?
  descripcion String?
  registradoEn DateTime      @default(now())
  usuarioId   Int
  usuario     User           @relation(...)
}
```

---

## Roadmap

### Fase 1 — Proceso digital completo *(próximo a codificar)*
- [ ] Schema Prisma + migración
- [ ] CRUD vehículos (con alertas documentales en listado)
- [ ] Solicitud de uso + aprobación/rechazo
- [ ] Checklist digital (items configurables)
- [ ] Orden de Servicio + firma digital
- [ ] Bitácora de viaje
- [ ] Cierre de proceso (inmutable)
- [ ] Hoja de vida del vehículo
- [ ] Vista de auditoría por patente

### Fase 2 — Mantenciones y reportes
- [ ] Registro de mantenciones
- [ ] Reporte costo mensual por vehículo
- [ ] Vehículos con mantención/doc próxima a vencer
- [ ] Exportación Excel/PDF

### Fase 3 — Admin avanzado
- [ ] Panel de configuración de ítems del checklist
- [ ] Correcciones formales post-cierre (registro auditado)
- [ ] Historial por conductor/funcionario

---

## Estructura de archivos prevista

```
src/app/
  flota/
    page.tsx                    ← listado de vehículos + alertas
    [vehiculoId]/
      page.tsx                  ← hoja de vida del vehículo
    solicitudes/
      page.tsx                  ← mis solicitudes / todas (según rol)
      nueva/page.tsx
      [id]/
        page.tsx                ← detalle solicitud + acciones según estado
        checklist/page.tsx
        orden/page.tsx
        bitacora/page.tsx
    vehiculos/
      nuevo/page.tsx
      [id]/editar/page.tsx
    mantenciones/
      page.tsx

src/app/api/flota/
  vehiculos/route.ts
  vehiculos/[id]/route.ts
  solicitudes/route.ts
  solicitudes/[id]/route.ts
  solicitudes/[id]/aprobar/route.ts
  solicitudes/[id]/rechazar/route.ts
  solicitudes/[id]/checklist/route.ts
  solicitudes/[id]/orden/route.ts
  solicitudes/[id]/orden/firmar/route.ts
  solicitudes/[id]/bitacora/route.ts
  solicitudes/[id]/cerrar/route.ts
  alertas/route.ts              ← documentos por vencer
```

---

## Notas técnicas

- **Inmutabilidad:** API de cierre marca `estado = CERRADA`. Todas las rutas POST/PATCH verifican `estado !== CERRADA` antes de proceder.
- **Correcciones:** Son registros en `HojaVidaVehiculo` de tipo `CORRECCION`, nunca edición directa de bitácora/checklist cerrada.
- **Alertas documentales:** SOAP, revisión técnica y permiso de circulación con alerta a 30 días (se integra en la campana del navbar).
- **Conductor → Funcionario:** Requiere que módulo RRHH tenga Fase 1 desplegada en BD. Para Fase 1 de Flota se puede vincular por `funcionarioId` sin bloquear si RRHH no está migrado aún (campo nullable temporalmente).
- **Responsive:** Prioridad en vistas de checklist y bitácora (se usan en terreno desde celular).