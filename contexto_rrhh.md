# Módulo RRHH — IMO Stock
> **Estado:** Planificación activa — Módulo integrado en imo-gestion, arquitectura definida  
> **Proyecto:** `D:\DEV\imo-gestion` (módulo dentro del proyecto existente, no repo separado)  
> **Usuarios objetivo:** 2 operadores RRHH + 1 administrador  
> **Funcionarios gestionados:** ~40  
> **Fecha inicio:** Abril 2026

---

## 1. Visión General

Módulo de RRHH integrado al sistema `imo-gestion` (bodega + farmacia municipal). Reutiliza toda la infraestructura existente: autenticación, roles, UI components, exportación Excel/PDF y base de datos PostgreSQL. **No es un proyecto separado.**

**Flujo operativo real:**
1. Funcionario envía solicitud de horas extras por **FEDOKS** (sistema documental externo)
2. Documento aprobado (memo/expediente) llega al equipo RRHH
3. Operador RRHH **registra en este sistema** → calcula tipo y saldo automáticamente
4. RRHH genera decreto en **FEDOKS**
5. Sistema registra el **folio/expediente del memo** como referencia para cerrar el ciclo

---

## 2. Por qué módulo integrado (no proyecto separado)

| Factor | Situación actual | Conclusión |
|--------|-----------------|------------|
| Stack | imo-gestion ya usa Next.js 16 + Prisma + PostgreSQL + NextAuth | Mismo stack → zero overhead |
| Autenticación | `requireAuth()` / `requireRole()` centralizado en `/lib/apiAuth.ts` | Reutilizar sin cambios |
| Roles | Enum `Role` ya existe → solo agregar `RRHH` | 1 línea en schema.prisma |
| UI | Layout.tsx con menú dinámico por rol, Paginador, BotonExportar | Reutilizar directamente |
| Exportación | xlsx + jsPDF ya instalados | Sin dependencias nuevas |
| BD | Una sola instancia PostgreSQL ya configurada | Agregar tablas via migración |
| Mantenimiento | 3 módulos en un repo vs. 2 repos separados | Mucho más simple |

---

## 3. Módulos de RRHH

### Módulo 0 — Parámetros RRHH *(base para los cálculos)*
- Configuración de jornada ordinaria (hora inicio/fin)
- Porcentajes de recargo por tipo (default: 40% / 100%)
- Hora de corte nocturno (default: 21:00)
- Calendario de feriados: **nacionales y locales/municipales** (carga anual manual)
- Tabla de grados y valor hora base por grado (requerido — hay escalas según grado)

### Módulo 1 — Ficha de Funcionarios
- RUT (validado con `validarRut.ts`), nombre completo, cargo
- **Grado** (define la escala de remuneración y valor hora)
- Unidad/departamento, jefatura directa
- Tipo de contrato: Planta / Contrata / Honorarios
- Fecha de ingreso, estado (activo / inactivo / con licencia)
- Datos de contacto
- Soft delete (nunca se elimina, se desactiva)

### Módulo 2 — Horas Extras ⭐ *(PRIMER MÓDULO A DESARROLLAR)*
> Ver Sección 4 para diseño completo.

### Módulo 3 — Licencias y Permisos *(Fase 2)*
- Licencias médicas: tipo, días, COMPIN, entidad pagadora
- Permisos administrativos (con/sin goce de sueldo)
- Días administrativos
- Registro vinculado al funcionario con trazabilidad

### Módulo 4 — Vacaciones *(Fase 2)*
- Cálculo automático de días según antigüedad (proporcional)
- Saldo disponible, usado, pendiente
- Registro de períodos de vacaciones
- Alerta de saldos próximos a vencer

### Módulo 5 — Reportes RRHH *(transversal)*
- Resumen mensual de horas extras por unidad
- Saldo de horas pendientes por funcionario
- Costo estimado de horas extras del período (usando valor hora por grado)
- Exportar a Excel y PDF

---

## 4. Módulo de Horas Extras — Diseño Detallado

### 4.1 Reglas de Cálculo (parámetros configurables)

| Situación | Recargo por defecto | Condición |
|-----------|---------------------|-----------|
| Lunes a viernes (diurno) | **40%** | Después de fin de jornada ordinaria |
| Sábado (diurno) | **40%** | Hasta la hora de corte nocturno |
| Lunes a sábado (nocturno) | **40%** *(parametrizable)* | Desde hora de corte (default 21:00) |
| Domingo o festivo (todo el día) | **100%** | Incluye feriados nacionales y locales/municipales |

> Todos los porcentajes y horas de corte viven en tabla `ParametroRRHH` y son editables por el administrador sin tocar código.

### 4.2 Cálculo automático del tipo

```
Al ingresar fecha + hora_inicio + hora_fin:
  1. ¿La fecha es feriado (nacional o local) o domingo? → 100%
  2. ¿Alguna fracción cae después de hora_corte_nocturno?
       → Si el parámetro "nocturno diferenciado" está activo, split por tramos
  3. Resto → 40%
  4. Total horas = (hora_fin - hora_inicio) en minutos / 60
```

### 4.3 Comportamiento de acumulación

- Las horas extras se registran y compensan **preferentemente el mismo mes**
- Es posible **acumular 1-2 meses** en casos justificados
- El sistema no bloquea la acumulación, pero la vista de saldos muestra antigüedad de los registros pendientes para alertar

### 4.4 Modelo de datos (nuevos en schema.prisma)

```prisma
model GradoEscala {
  id              Int       @id @default(autoincrement())
  grado           String    @unique  // Ej: "A", "B", "C1", "8", etc.
  descripcion     String?
  valorHora       Decimal   // Valor en pesos por hora trabajada extra
  activo          Boolean   @default(true)
  updatedAt       DateTime  @updatedAt
  funcionarios    Funcionario[]
}

model Funcionario {
  id              Int          @id @default(autoincrement())
  rut             String       @unique
  nombres         String
  apellidos       String
  cargo           String
  gradoId         Int          // FK a GradoEscala
  unidad          String
  jefatura        String?
  tipoContrato    TipoContrato
  fechaIngreso    DateTime
  telefono        String?
  email           String?
  estado          EstadoFuncionario @default(ACTIVO)
  activo          Boolean      @default(true)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  grado           GradoEscala  @relation(fields: [gradoId], references: [id])
  horasExtras     HoraExtra[]
}

model HoraExtra {
  id              Int       @id @default(autoincrement())
  funcionarioId   Int
  fecha           DateTime  // Fecha en que se hicieron las horas
  horaInicio      String    // "HH:mm"
  horaFin         String    // "HH:mm"
  totalMinutos    Int       // Calculado automáticamente
  tipoRecargo     Int       // 40 o 100 (según parámetro)
  motivo          String
  estado          EstadoHoraExtra @default(PENDIENTE)
  formaCompensa   FormaCompensacion?
  folioMemo       String?   // N° folio/expediente del memo aprobado en FEDOKS
  registradoPor   Int       // FK a User (operador RRHH)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  funcionario     Funcionario @relation(fields: [funcionarioId], references: [id])
  registrador     User      @relation(fields: [registradoPor], references: [id])
}

model ParametroRRHH {
  id              Int       @id @default(autoincrement())
  clave           String    @unique  // "recargo_normal" | "recargo_festivo" | "hora_corte" | "jornada_inicio" | "jornada_fin"
  valor           String            // "40" | "100" | "21:00" | "08:00" | "17:00"
  descripcion     String
  updatedAt       DateTime  @updatedAt
}

model FeriadoRRHH {
  id              Int       @id @default(autoincrement())
  fecha           DateTime
  descripcion     String
  tipo            String    // "nacional" | "local"
  anio            Int       // Para filtrar rápido por año
}

enum TipoContrato {
  PLANTA
  CONTRATA
  HONORARIOS
}

enum EstadoFuncionario {
  ACTIVO
  INACTIVO
  CON_LICENCIA
}

enum EstadoHoraExtra {
  PENDIENTE   // Ingresado, esperando confirmación
  APROBADO    // Confirmado por RRHH, saldo activo
  RECHAZADO   // No procede
  COMPENSADO  // Se tomó como tiempo libre
  PAGADO      // Se pagó monetariamente
}

enum FormaCompensacion {
  TIEMPO_LIBRE
  PAGO_MONETARIO
}
```

### 4.5 Flujo de trabajo real

```
Funcionario solicita por FEDOKS
        ↓
Memo/expediente aprobado llega a RRHH
        ↓
Operador RRHH ingresa en sistema:
  - Selecciona funcionario (autocomplete por RUT/nombre)
  - Ingresa fecha, hora inicio, hora fin, motivo
  - Sistema calcula tipo (40%/100%) y total horas automáticamente
        ↓
Registro queda en estado PENDIENTE
        ↓
Operador confirma → estado APROBADO
Saldo del funcionario se actualiza
        ↓
Se decide: ¿Tiempo libre o pago?
        ↓
Operador registra resolución en FEDOKS
Ingresa folio/N° expediente del memo → estado COMPENSADO o PAGADO
        ↓
Historial cerrado con referencia documental
```

### 4.6 Vistas del módulo

| Ruta | Descripción |
|------|-------------|
| `/rrhh/funcionarios` | Lista con filtros, estado, búsqueda por RUT/nombre |
| `/rrhh/funcionarios/nuevo` | Formulario alta de funcionario |
| `/rrhh/funcionarios/[id]` | Ficha completa + historial horas extras |
| `/rrhh/horas-extras` | Lista global con filtros: período, unidad, estado, funcionario |
| `/rrhh/horas-extras/nueva` | Formulario ingreso (autocomplete funcionario, cálculo automático) |
| `/rrhh/horas-extras/saldos` | Vista resumen: horas pendientes/acumuladas por funcionario |
| `/rrhh/parametros` | Configuración porcentajes, hora corte, feriados, grados (solo ADMIN) |
| `/rrhh/reportes` | Exportar Excel/PDF mensual por unidad o funcionario |

---

## 5. Roles y Permisos

| Rol | Acceso RRHH | Otros módulos |
|-----|-------------|---------------|
| **ADMIN** | Todo + parámetros + feriados + grados | Acceso completo a imo-gestion |
| **RRHH** *(nuevo)* | CRUD funcionarios + horas extras + reportes | Sin acceso a bodega/farmacia |
| **BODEGA / FARMACIA** | Sin acceso a RRHH | Sus módulos respectivos |
| **VIEWER** | Solo lectura dashboard | Sin acceso a RRHH |

Cambio en `schema.prisma`:
```prisma
enum Role {
  ADMIN
  BODEGA
  FARMACIA
  RRHH      // ← nuevo
  VIEWER
}
```

---

## 6. Estructura de archivos a crear en imo-gestion

```
src/
├── app/
│   ├── api/
│   │   └── rrhh/
│   │       ├── funcionarios/        [GET lista, POST nuevo]
│   │       │   └── [id]/            [GET, PUT, DELETE(soft)]
│   │       ├── horas-extras/        [GET lista, POST nuevo]
│   │       │   ├── [id]/            [GET, PUT estado]
│   │       │   └── saldos/          [GET resumen por funcionario]
│   │       ├── parametros/          [GET, PUT — solo ADMIN]
│   │       ├── feriados/            [GET, POST, DELETE]
│   │       ├── grados/              [GET, POST, PUT, DELETE — solo ADMIN]
│   │       └── reportes/            [GET export Excel/PDF]
│   └── rrhh/
│       ├── layout.tsx               (hereda Layout.tsx base)
│       ├── page.tsx                 (redirect a /rrhh/horas-extras)
│       ├── funcionarios/
│       │   ├── page.tsx
│       │   ├── nuevo/page.tsx
│       │   └── [id]/page.tsx
│       ├── horas-extras/
│       │   ├── page.tsx
│       │   ├── nueva/page.tsx
│       │   └── saldos/page.tsx
│       ├── parametros/page.tsx      (incluye grados y feriados)
│       └── reportes/page.tsx
└── lib/
    └── rrhh/
        └── calcularHoraExtra.ts     (lógica pura: tipo 40%/100%, split nocturno)
```

---

## 7. Hoja de Ruta (Roadmap)

### Fase 1 — Horas Extras (Prioridad inmediata)
- [ ] Migración Prisma: GradoEscala, Funcionario, HoraExtra, ParametroRRHH, FeriadoRRHH, enums
- [ ] Agregar rol `RRHH` y actualizar Layout.tsx con menú condicional
- [ ] `/rrhh/parametros` — CRUD parámetros, feriados (nacionales y locales) y grados (ADMIN)
- [ ] `/rrhh/funcionarios` — CRUD completo con validación RUT y selección de grado
- [ ] Función `calcularHoraExtra.ts` — detecta feriados, split nocturno, calcula minutos
- [ ] `/rrhh/horas-extras` — ingreso con cálculo automático, lista, cambio de estado, folio memo
- [ ] `/rrhh/horas-extras/saldos` — vista consolidada con antigüedad del saldo
- [ ] Exportación Excel/PDF del período (reutilizar patrón de reportes/bodega y reportes/farmacia)

### Fase 2 — Licencias y Vacaciones
- [ ] Modelos: Licencia, Vacacion, TipoLicencia
- [ ] CRUD licencias con cálculo de días
- [ ] Cálculo saldo vacaciones por antigüedad
- [ ] Dashboard RRHH con alertas (licencias activas, vacaciones próximas)

### Fase 3 — Reportería Avanzada
- [ ] Costo estimado por período (horas × valor hora por grado)
- [ ] Cierre mensual de horas extras
- [ ] Reportes consolidados para Alcaldía/Control

---

## 8. Consideraciones Técnicas

- **Feriados:** Nacionales + locales/municipales. Carga manual anual desde `/rrhh/parametros`. El campo `tipo` distingue ambos.
- **Acumulación de horas:** El sistema no bloquea acumulación entre meses. La vista de saldos muestra antigüedad para alertar operacionalmente.
- **Folio memo:** Campo `folioMemo` en `HoraExtra` es la referencia al expediente en FEDOKS (no un decreto generado por este sistema).
- **Grados/Escalas:** `GradoEscala` independiente con `valorHora` en pesos. Permite calcular costo estimado en reportes.
- **Auditoría:** Todo cambio registra `registradoPor` (User FK) y `updatedAt`.
- **Normativa:** Estatuto Administrativo Ley 18.834 + Ley 19.280 (municipios).
- **FEDOKS:** Sin integración directa → folio/expediente se ingresa manualmente como referencia.
- **RUT:** Reutilizar `src/lib/validarRut.ts` ya existente.
