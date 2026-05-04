# Módulo Bodega Municipal
> **Estado:** Producción  
> **Rol requerido:** `BODEGA` o `ADMIN`

Gestión de inventario de insumos, materiales y productos generales de la municipalidad.

---

## Modelos Prisma

```prisma
model CategoriaBodega {
  id        Int              @id @default(autoincrement())
  nombre    String           @unique
  productos ProductoBodega[]
}

model ProductoBodega {
  id           Int                      @id @default(autoincrement())
  codigo       String                   @unique
  nombre       String
  descripcion  String?
  unidad       String
  stock        Int                      @default(0)
  stockMinimo  Int                      @default(0)
  categoriaId  Int
  activo       Boolean                  @default(true)
  validoDesde  DateTime                 @default(now())
  validoHasta  DateTime?
  createdAt    DateTime                 @default(now())
  categoria    CategoriaBodega          @relation(...)
  movimientos  MovimientoBodega[]
  historial    ProductoBodegaHistorial[]
}

model ProductoBodegaHistorial {
  // SCD: snapshot del producto al momento de cada cambio
  id          Int      @id @default(autoincrement())
  productoId  Int
  campo       String
  valorAntes  String
  valorDespues String
  cambiadoPor Int      // FK User
  createdAt   DateTime @default(now())
}

model MovimientoBodega {
  id            Int      @id @default(autoincrement())
  productoId    Int
  tipo          TipoMovimientoBodega   // ENTRADA | SALIDA | AJUSTE
  cantidad      Int
  observacion   String?
  anulado       Boolean  @default(false)
  anulacionDeId Int?     // FK al movimiento original si es inverso
  usuarioId     Int      // FK User
  createdAt     DateTime @default(now())
}

enum TipoMovimientoBodega {
  ENTRADA
  SALIDA
  AJUSTE
}
```

---

## Rutas

### API (`/api/bodega/`)
| Ruta | Métodos | Descripción |
|------|---------|-------------|
| `/api/bodega/categorias` | GET, POST | CRUD categorías |
| `/api/bodega/productos` | GET, POST | Lista + crear producto |
| `/api/bodega/productos/[id]` | GET, PUT, DELETE | Detalle + editar + desactivar |
| `/api/bodega/productos/[id]/kardex` | GET | Kardex del producto (saldo acumulado) |
| `/api/bodega/productos/buscar` | GET | Autocomplete por código o nombre |
| `/api/bodega/movimientos` | GET, POST | Lista con filtros + crear movimiento |
| `/api/bodega/movimientos/[id]` | GET, PUT | Detalle + anular |
| `/api/reportes/bodega` | GET | Exportar Excel/PDF del inventario |

### Páginas (`/bodega/`)
| Ruta | Descripción |
|------|-------------|
| `/bodega/productos` | Lista con filtros, stock crítico destacado |
| `/bodega/productos/nuevo` | Formulario alta de producto |
| `/bodega/productos/[id]` | Detalle + tabs Movimientos / Kardex |
| `/bodega/movimientos` | Lista con filtros y acción de anulación |
| `/bodega/movimientos/nuevo` | Formulario de movimiento (usa BuscadorCodigo) |
| `/bodega/categorias` | CRUD de categorías |

---

## Funcionalidades implementadas

- CRUD productos con historial SCD (cierra registro anterior, crea nuevo)
- Movimientos **ENTRADA / SALIDA / AJUSTE** con validación de stock
- **Anulación** de movimientos: genera movimiento inverso, marca `anulado=true`
- **Ajuste de stock manual**: ingresa stock real → calcula diferencia automáticamente. Guarda en `observacion` como `[AJUSTE] Stock anterior: X → Stock real: Y`
- **Buscador autocomplete** por código o nombre (`BuscadorCodigo.tsx`)
- **Kardex** por producto: saldo acumulado línea a línea, filtro por fechas, saldo inicial calculado antes del período
- Exportar inventario a **Excel y PDF**
- Alertas de stock bajo (badge en nav, conteo via `/api/alertas`)

---

## Decisiones técnicas específicas

- **AJUSTE de stock:** `cantidad = Math.abs(diferencia)`. El signo real se parsea del texto `observacion` en el kardex para calcular el saldo correcto.
- **Kardex con saldo inicial:** la query precalcula el saldo antes de la fecha de inicio del filtro para que el kardex parcial sea siempre correcto.
- **Stock crítico:** producto con `stock <= stockMinimo` aparece destacado y suma al badge de alertas.

---

## Pendientes

| Feature | Prioridad | Descripción |
|---------|-----------|-------------|
| **Órdenes de compra** | Alta | Flujo: bodeguero solicita → admin aprueba → ingreso al stock. Respaldo documental para municipalidad |
| **Inventario físico** | Alta | Conteo masivo, genera acta con diferencias, ajuste masivo. Necesario para auditorías anuales |
| **Stock máximo** | Media | Campo `stockMaximo` en schema, alerta de sobrestock |
| **Cierre de mes** | Baja | Snapshot oficial del inventario al fin de período |
