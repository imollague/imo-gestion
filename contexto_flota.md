# Módulo Gestión de Flota
> **Estado:** Planificación futura — sin fecha definida  
> **Rol requerido:** `FLOTA` o `ADMIN` *(a definir)*

Gestión del parque vehicular municipal: vehículos, mantenciones, combustible y uso por funcionario/unidad.

---

## Visión General

Módulo integrado en imo-gestion que reutiliza la misma infraestructura (auth, Prisma, UI). Permitirá controlar el estado operativo de la flota, el historial de mantenciones y el consumo de combustible.

---

## Funcionalidades previstas *(borrador inicial)*

### Vehículos
- Registro de vehículos: patente, marca, modelo, año, tipo (camioneta, bus, maquinaria, etc.)
- Estado: operativo / en mantención / fuera de servicio / dado de baja
- Soft delete

### Mantenciones
- Registro de mantenciones preventivas y correctivas
- Fecha, tipo, taller, costo, kilometraje
- Alertas por kilometraje o fecha próxima

### Combustible
- Control de cargas: fecha, litros, precio, kilometraje, conductor
- Cálculo de rendimiento (km/litro) por vehículo

### Uso / Salidas
- Registro de salidas: vehículo, conductor (FK Funcionario de módulo RRHH), destino, fecha salida/retorno, kilometraje
- Vinculación con módulo RRHH para conductor responsable

### Reportes
- Costo mensual por vehículo (combustible + mantención)
- Vehículos con mantención próxima
- Historial de uso por funcionario

---

## Dependencias con otros módulos

- **RRHH:** conductor referencia a `Funcionario` del módulo RRHH
- **Admin:** rol `FLOTA` a agregar en enum `Role` cuando se inicie desarrollo

---

## Preguntas pendientes a resolver antes de codificar

- [ ] ¿Cuántos vehículos tiene la municipalidad?
- [ ] ¿Hay maquinaria pesada además de vehículos livianos?
- [ ] ¿Se necesita control de TAG / peajes?
- [ ] ¿Los conductores son siempre funcionarios municipales o también externos?
- [ ] ¿Se lleva bitácora de salidas actualmente en papel?
- [ ] ¿Hay requerimiento de alertas por SOAP/revisión técnica?
