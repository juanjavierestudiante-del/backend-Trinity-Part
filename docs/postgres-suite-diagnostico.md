# Recuperación PostgreSQL de Fase 5C.1-R

## Entorno y límites

Proyecto `dry-pond-23712811`, branch `br-withered-sky-ace0tnfg`, database
`fase4b_cutover_empty_20261004`, endpoint directo autorizado, SSL obligatorio.
Identidad y PostgreSQL 18.6 verificados con Neon MCP antes de las escrituras.
No se utiliza production. No cambia schema, historial, timeout comercial
de 15 segundos, capacidad del pool ni lógica de negocio.

## Evidencia y ajustes del harness

- Vitest ejecuta un único archivo PostgreSQL. La instrumentación confirmó
  un máximo de un test activo: el paralelismo entre tests no explica el fallo.
  Las transacciones concurrentes dentro de cada caso son intencionales.
- Antes había un PrismaClient de fixtures y el singleton del servicio.
  Se observaron seis conexiones propias estables, idle entre casos; no crecimiento
  ni transacciones residuales. Esto no demuestra una fuga.
- Ahora se reutiliza sólo el singleton, con `$connect` antes de la primera
  operación y `$disconnect` en finally. En el segundo ensayo abrió en 931 ms;
  en el histórico, 1205 ms. No apareció P2024 en estos ensayos.
- El P2024 anterior apareció en apertura/primera lectura, antes de fixtures.
  No se ha demostrado su causa exacta; atribuirlo a fuga o saturación sería
  especulativo. No se amplía el límite del pool ni su espera por defecto.
- Los tests históricos de configuración usan una barrera después de adquirir
  los locks comerciales reales, en vez de sostener inventario y encadenar dos
  esperas. `pg_blocking_pids` confirma el bloqueo antes de liberar la barrera;
  todos los participantes terminan mediante `Promise.allSettled` en finally.
  El polling de 30 ms observa el estado; no impone una pausa larga.
- Limpieza por IDs propios, comprobación de fixtures/constraint temporal y de
  transacciones abiertas después de cada caso. El diagnóstico es sólo de tests.

## Resultados

1. Trece casos Admin con dos clientes: 12 pasan, 1 falla; 319.48 s.
   Checkout de edición de regla: 15167 ms, P2028 en creación de Pedido.
   Bloqueo observado en 1649 ms; no se mantuvo artificialmente 8–12 segundos.
2. Trece casos Admin con un cliente: 12 pasan, 1 falla; 215.98 s.
   `Admin editar regla espera a checkout y conserva su precio completo`:
   llamada `pedido.crear` de 15307 ms; P2028 en Inventario.findUniqueOrThrow,
   transacción expirada a 15143 ms. Lecturas del contexto de 1960 y 3404 ms;
   una operación raw de 3149 ms. El bloqueo se observó en 3904 ms.
   INSERT concurrente y carrito/desactivación en ambos órdenes pasan;
   carrito/cantidadBase en ambos órdenes también pasan.
3. Históricos aislados: primer caso normal, sin escritor concurrente ni barrera,
   `stock 2000 / pack50 / cantidad 3`, falla con P2028 al crear el pedido:
   llamada de 15066 ms. Lecturas Carrito 1611 ms, variantes 2744 ms, listas
   2160 ms; query raw 2279 ms; actualización inventario 936 ms, lectura
   inventario 1405 ms, creación Pedido 904 ms. El siguiente caso normal
   `stock 149 / pack50 / cantidad 2` pasa, llamada de 11099 ms.

Son tiempos de cliente (red, driver y servidor incluidos), no tiempos exclusivos
del motor SQL. No se ha probado un índice faltante ni un plan SQL costoso.
La variación también afecta lecturas simples y fixtures fuera de checkout.

## Decisión y limpieza

Se detiene por performance según el límite explícito: una operación normal
superó 15 segundos después de corregir lifecycle y coordinación del harness.
No se incrementa el timeout ni se modifica checkout sin aislar la causa de esa
latencia. No se ejecutan dos suites completas para declarar una estabilidad
que no existe. No hay commit final, merge, push ni deploy.

Se interrumpió el ensayo histórico tras demostrar el fallo; esto dejó el fixture
del tercer caso. Se identificó por sus IDs y UUID propios y se eliminó únicamente
ese fixture en la DB autorizada. Neon MCP confirmó posteriormente cero filas
en las trece tablas de fixtures inspeccionadas, cero constraints temporales,
cero transacciones abiertas y cero conexiones `trinity-5c1-service`.

Gates locales posteriores: Prisma validate/generate, typecheck, build y
`git diff --check` pasan. Tests habituales: 307 pasan, 37 PostgreSQL omitidos,
33 archivos aprobados. El primer intento habitual dentro del sandbox falló
por EPERM al abrir sockets Supertest; fuera del sandbox pasó en 9.90 s.

Pendiente: separar latencia de transporte de ejecución SQL y demostrar el
checkout normal dentro de 15 s, luego históricos completos, dos ejecuciones
completas consecutivas y gates habituales. Los cambios mínimos del harness
no constituyen aprobación de Fase 5C.1.
