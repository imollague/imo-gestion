# Módulo Farmacia Posta Rural
> **Estado:** En desarrollo (rama `modulo/bodega-farmacia`). Se prepara su puesta en marcha con datos reales.
> **Roles:** `FARMACIA` opera; `ADMIN` opera y firma como jefe; `VIEWER` solo lectura (sin datos de pacientes).

Inventario de medicamentos con lotes y vencimientos, despacho a pacientes, y actas firmadas con FirmaGob (inventario, merma, retiro sanitario).

---

## Modelos (resumen, ver `prisma/schema.prisma`)

- `Medicamento`: `codigo` único, `nombreGenerico`, `nombreComercial?`, `formaFarmaceutica`, `concentracion?`, `unidad`, `stockActual`, `stockMinimo`, `categoriaId`, `activo`. Historial SCD en `MedicamentoHistorial`.
- `LoteFarmacia`: `numeroLote`, `fechaVencimiento?`, `stockInicial`, `stockActual`, `fechaIngreso`, `proveedor?`, `retirado`, `motivoRetiro?`, `fechaRetiro?`.
- `MovimientoFarmacia`: `tipo` (`TipoMovimiento` compartido con Bodega: ENTRADA, SALIDA, AJUSTE, MERMA, RETIRO_SANITARIO), `cantidad`, `lote?` (número de lote como texto), `fechaVencimiento?`, `proveedor?`, `rutPaciente?`, `pacienteId?`, `observacion?`, `anulado`, `motivoAnulacion?`, `anulacionDeId?`.
- `Paciente`: `rut` único, `nombre`, `apellido`, `telefono?`, `activo`.
- Actas (compartidas con Bodega, campo `modulo = "FARMACIA"`): `ActaInventario`, `ActaMerma`, `ActaRetiroSanitario` + sus ítems. Los ítems referencian `medicamentoId` sin FK.

> Los ítems de acta de merma e inventario **no tienen campo de lote**. La baja se reparte entre lotes de forma automática (ver "Lotes").

---

## Lotes: cómo se mueve el stock

El stock del medicamento (`Medicamento.stockActual`) y el de cada lote se mueven juntos. La parte del stock que no pertenece a ningún lote (entradas antiguas sin lote) se calcula como `stockActual − suma de lotes vigentes` y se llama "sin lote".

Implementado en `src/lib/farmaciaLotes.ts` (`descontarStockLotes`):

| Operación | De dónde descuenta |
|-----------|--------------------|
| **Despacho (SALIDA)** | FEFO: primero el lote que vence antes. **Nunca toca lotes vencidos** (vencen al terminar el día de su fecha). Lo "sin lote" va al final. Se crea **un movimiento por lote usado**, con `lote` y `fechaVencimiento`. |
| Ajuste a la baja, merma, inventario con diferencia negativa, retiro sanitario sin lote | Primero lo "sin lote", luego los lotes por vencimiento (los vencidos salen primero). |
| Retiro sanitario con lote indicado | El lote queda `retirado` y con `stockActual = 0`. |
| Ajuste/inventario al alza | No toca lotes: el aumento queda como "sin lote". |
| ENTRADA | Crea el lote, o suma al existente con el mismo número (sin importar mayúsculas: no se normaliza). |

Si el stock despachable (sin vencidos) no alcanza, el despacho falla indicando cuánto hay sin vencer y cuánto en lotes vencidos.

## Anulación de movimientos

- Solo se anulan **ENTRADA y SALIDA**. Ajustes, mermas y retiros sanitarios se corrigen con un nuevo ajuste.
- No se puede anular una anulación.
- Anular una SALIDA devuelve el stock **al lote del que salió** (falla si ese lote fue retirado). Las salidas antiguas sin lote solo devuelven al stock total.
- Anular una ENTRADA exige que su lote siga disponible y con al menos esa cantidad (si ya se despachó parte, no se puede).
- El descuento y la marca de anulado son condicionales dentro de la transacción (sin stock negativo ni doble anulación por clics simultáneos).

## Kardex

`/api/farmacia/medicamentos/[id]/kardex`: el saldo cuenta ENTRADA (+), SALIDA, MERMA y RETIRO_SANITARIO (−) y AJUSTE (signo leído del texto `Stock anterior: X → Stock real: Y` de la observación). Mermas y retiros aparecen en la columna "salidas".

---

## Permisos

- Lecturas de farmacia (medicamentos, lotes, categorías, movimientos, kardex, actas pendientes): `ADMIN`, `FARMACIA`, `VIEWER`.
- Pacientes (`/api/farmacia/pacientes*`): solo `ADMIN` y `FARMACIA`. En movimientos, kardex y ficha del medicamento el `rutPaciente` se oculta para `VIEWER`.
- Páginas (`src/proxy.ts`): `/farmacia` solo ADMIN/FARMACIA/VIEWER, `/farmacia/pacientes` sin VIEWER. `/bodega` análogo con BODEGA.
- Escrituras: `ADMIN` y `FARMACIA`. Firma de actas como jefe: solo `ADMIN`.

## Rutas API (`/api/farmacia/`)

`categorias`, `medicamentos` (+ `[id]`, `[id]/kardex`, `[id]/lotes`, `buscar`), `lotes` (GET) y `lotes/[id]/retirar`, `movimientos` (+ `[id]/anular`), `pacientes` (+ `buscar`), `inventario` (+ `[id]/jefe`), `merma` (+ `[id]/jefe`), `retiro-sanitario` (+ `[id]/jefe`), `acta-inventario` (obsoleta). Reportes: `/api/reportes/farmacia`.

## Páginas (`/farmacia/`)

Inicio (inventario + paneles de actas pendientes del jefe), `medicamentos/nuevo`, `medicamentos/[id]` (ficha, lotes, movimientos, kardex), `movimientos`, `movimientos/nuevo`, `pacientes`, `categorias`, `inventario/nuevo`, `merma/nueva`, `retiro-sanitario/nueva`.

---

## Pendientes

Origen: revisión de funcionalidad y UX. ✅ = hecho, ⏳ = pendiente.

### Seguridad y consistencia de datos
- ✅ Datos de pacientes y listados exigen rol; proxy bloquea módulos ajenos.
- ✅ Despacho FEFO sin lotes vencidos, registrando el lote usado.
- ✅ Merma, ajuste, inventario, retiro y anulación mueven también el stock del lote.
- ✅ Kardex cuenta mermas y retiros sanitarios (Bodega y Farmacia).
- ✅ Anulación: solo ENTRADA/SALIDA, no anular anulaciones, verificaciones dentro de la transacción.
- ⏳ **Dos formas de retirar un lote con distinto control:** el botón "Retirar lote" (`lotes/[id]/retirar`) lo hace FARMACIA solo con un motivo, sin acta ni firma del jefe; el acta de retiro sanitario sí exige firma. Decidir si el botón debe llevar al acta.
- ⏳ **Elegir el lote en merma e inventario.** Hoy el reparto es automático (ver tabla de Lotes). Para elegirlo hay que agregar `lote` a `ActaMermaItem` y `ActaInventarioItem` (migración) y tocar los formularios.
- ⏳ Las rutas de firma del jefe llaman a FirmaGob **antes** de la transacción: si la base falla, el documento queda firmado y el stock sin descontar. También un doble clic podría firmar dos veces (la UI deshabilita el botón, la API no). Conviene reservar el acta (`PENDIENTE_JEFE` → en proceso) antes de firmar.
- ⏳ El stock se recorta a 0 en silencio (`Math.max(0, …)`) al aplicar merma/retiro si el stock actual es menor al del acta.
- ⏳ Ninguna ruta de firma comprueba que quien firma sea el `jefeId` elegido en el acta (cualquier ADMIN firma cualquier acta).
- ⏳ El saldo del kardex lee el signo del AJUSTE desde un texto libre (regex). Guardar el delta firmado en el movimiento.
- ⏳ Retiro sanitario con lote: si el lote tenía más stock que la cantidad del acta, esa diferencia queda "sin lote" en el total.

### Funcionalidad para operar farmacia
- ⏳ **Despacho con paciente obligatorio**, y con número de receta y prescriptor (hoy el paciente es opcional). Prioridad subida a Media/Alta.
- ⏳ **Psicotrópicos / estupefacientes:** libro de control y receta retenida. **Por consultar** si la posta maneja alguno antes de implementar.
- ⏳ Mostrar vencimiento y lote de salida en el formulario de despacho, y alertas de lotes por vencer en la lista principal.
- ⏳ ENTRADA con lote y vencimiento obligatorios, y lista de lotes existentes en vez de texto libre (evita lotes duplicados por error de tipeo).
- ⏳ Reportes: consumo mensual por medicamento / paciente / prescriptor, y cierre de mes (snapshot oficial).
- ⏳ Unidades: conversión caja ↔ comprimido si se recibe y despacha en unidades distintas.
- ⏳ Dashboard por rol (farmacia ve solo farmacia).

### UI/UX
- ⏳ Pantalla principal: 9 botones al mismo nivel; reducir a acciones frecuentes (despacho, entrada) y agrupar las demás.
- ⏳ Alerta de stock bajo lista todo sin tope; tablas no pensadas para móvil; enlaces `<a href>` en vez de `Link`.
- ⏳ Los tres paneles de actas pendientes son copias de un mismo componente.
- ⏳ Formulario de movimiento: éxito de 2 s y limpieza automática; confirmación con colores inconsistentes.
- ⏳ Faltan tildes en textos de farmacia ("Codigo", "Categorias", "Observacion").
- ⏳ Los botones "Anular" se muestran también a VIEWER (la API los rechaza, pero conviene ocultarlos).

---

## Decisiones técnicas

- **Un movimiento por lote** en los despachos que cruzan lotes: el kardex y la anulación saben de qué lote salió cada parte sin cambiar el esquema.
- **Sin migraciones** en los cambios de lotes/kardex/permisos: todo se resolvió con lógica.
- **Paciente inline:** `BuscadorPaciente.tsx` permite crear el paciente desde el formulario de movimiento.
- Estas decisiones y pendientes aplican igual a Bodega, salvo lo relativo a lotes y pacientes (Bodega no tiene lotes).
