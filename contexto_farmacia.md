# Módulo Farmacia Posta Rural
> **Estado:** Producción  
> **Rol requerido:** `FARMACIA` o `ADMIN`

Gestión de inventario de medicamentos con control de lotes, vencimientos y despacho a pacientes.

---

## Modelos Prisma

```prisma
model CategoriaFarmacia {
  id           Int           @id @default(autoincrement())
  nombre       String        @unique
  medicamentos Medicamento[]
}

model Medicamento {
  id           Int                    @id @default(autoincrement())
  codigo       String                 @unique
  nombre       String
  descripcion  String?
  unidad       String
  stock        Int                    @default(0)
  stockMinimo  Int                    @default(0)
  categoriaId  Int
  activo       Boolean                @default(true)
  validoDesde  DateTime               @default(now())
  validoHasta  DateTime?
  createdAt    DateTime               @default(now())
  categoria    CategoriaFarmacia      @relation(...)
  movimientos  MovimientoFarmacia[]
  lotes        LoteFarmacia[]
  historial    MedicamentoHistorial[]
}

model MedicamentoHistorial {
  // SCD: snapshot del medicamento al momento de cada cambio
  id            Int      @id @default(autoincrement())
  medicamentoId Int
  campo         String
  valorAntes    String
  valorDespues  String
  cambiadoPor   Int      // FK User
  createdAt     DateTime @default(now())
}

model LoteFarmacia {
  id            Int      @id @default(autoincrement())
  medicamentoId Int
  numeroLote    String
  fechaVenc     DateTime
  fechaIngreso  DateTime @default(now())
  stockInicial  Int
  stockActual   Int
  retirado      Boolean  @default(false)
  motivoRetiro  String?
  createdAt     DateTime @default(now())
}

model MovimientoFarmacia {
  id            Int      @id @default(autoincrement())
  medicamentoId Int
  tipo          TipoMovimientoFarmacia  // ENTRADA | SALIDA | AJUSTE | RETIRO
  cantidad      Int
  loteId        Int?     // Lote afectado (en SALIDA: lote FIFO descontado)
  pacienteId    Int?     // FK Paciente (solo en SALIDA/despacho)
  observacion   String?
  anulado       Boolean  @default(false)
  anulacionDeId Int?
  usuarioId     Int      // FK User
  createdAt     DateTime @default(now())
}

model Paciente {
  id          Int      @id @default(autoincrement())
  rut         String   @unique
  nombres     String
  apellidos   String
  telefono    String?
  activo      Boolean  @default(true)
  createdAt   DateTime @default(now())
  despachos   MovimientoFarmacia[]
}

enum TipoMovimientoFarmacia {
  ENTRADA
  SALIDA
  AJUSTE
  RETIRO
}
```

---

## Rutas

### API (`/api/farmacia/`)
| Ruta | Métodos | Descripción |
|------|---------|-------------|
| `/api/farmacia/categorias` | GET, POST | CRUD categorías |
| `/api/farmacia/medicamentos` | GET, POST | Lista + crear medicamento |
| `/api/farmacia/medicamentos/[id]` | GET, PUT, DELETE | Detalle + editar + desactivar |
| `/api/farmacia/medicamentos/[id]/kardex` | GET | Kardex del medicamento |
| `/api/farmacia/medicamentos/buscar` | GET | Autocomplete por código o nombre |
| `/api/farmacia/lotes` | GET, POST | Lista lotes + crear lote |
| `/api/farmacia/lotes/[id]` | PUT | Retirar lote (alerta sanitaria) |
| `/api/farmacia/movimientos` | GET, POST | Lista con filtros + crear movimiento |
| `/api/farmacia/movimientos/[id]` | GET, PUT | Detalle + anular |
| `/api/farmacia/pacientes` | GET, POST | Lista + crear paciente |
| `/api/farmacia/pacientes/[id]` | GET, PUT | Detalle + editar |
| `/api/farmacia/pacientes/buscar` | GET | Autocomplete por RUT o nombre |
| `/api/reportes/farmacia` | GET | Exportar Excel/PDF |

### Páginas (`/farmacia/`)
| Ruta | Descripción |
|------|-------------|
| `/farmacia/medicamentos` | Lista con filtros, stock crítico y lotes vencidos destacados |
| `/farmacia/medicamentos/nuevo` | Formulario alta de medicamento |
| `/farmacia/medicamentos/[id]` | Detalle + Lotes activos + tabs Movimientos / Kardex |
| `/farmacia/movimientos` | Lista con filtros y acción de anulación |
| `/farmacia/movimientos/nuevo` | Formulario de movimiento (BuscadorCodigo + BuscadorPaciente) |
| `/farmacia/pacientes` | Registro y búsqueda de pacientes con historial de despachos |
| `/farmacia/categorias` | CRUD de categorías |

---

## Funcionalidades implementadas

- CRUD medicamentos con historial SCD
- **Control de lotes FIFO:** las salidas descuentan del lote con `fechaIngreso` más antigua que tenga stock disponible
- **Retiro de lotes** (alerta sanitaria o vencimiento): genera movimiento tipo RETIRO automáticamente
- Alertas de lotes vencidos en la ficha del medicamento
- Movimientos vinculados a **Paciente** (autocomplete + creación inline desde el formulario)
- **Kardex** por medicamento: saldo acumulado con detalle de lote y paciente por línea
- **Registro de pacientes**: RUT validado con dígito verificador, historial completo de despachos
- Exportar inventario a **Excel y PDF**
- Alertas de stock bajo y lotes por vencer (badge en nav)

---

## Decisiones técnicas específicas

- **FIFO automático:** al crear una SALIDA, el sistema selecciona automáticamente el lote más antiguo con stock suficiente. Si el stock está distribuido en varios lotes, descuenta en orden hasta cubrir la cantidad total.
- **Retiro de lote:** cambia `retirado=true` en el lote y genera un `MovimientoFarmacia` tipo RETIRO con la cantidad que quedaba. El stock del medicamento se reduce.
- **Anulación con lotes:** al anular una SALIDA, el stock se devuelve al lote original referenciado por `loteId`.
- **Paciente inline:** `BuscadorPaciente.tsx` permite crear el paciente sin salir del formulario de movimiento si no existe en el sistema.

---

## Pendientes

| Feature | Prioridad | Descripción |
|---------|-----------|-------------|
| **Recetas/prescripciones** | Baja | Número de receta al despachar. Depende de si hay médicos asociados a la posta |
| **Cierre de mes farmacia** | Baja | Snapshot oficial del inventario al fin de período |
| **Dashboard por rol** | Media | Farmacéutico ve solo métricas de farmacia, sin bodega |
