# Fase 5C.1-R2: diagnóstico de latencia

## Entorno y método

Branch Git `fase5c1-admin-comercial-backend`. Proyecto Neon `dry-pond-23712811`, branch `br-withered-sky-ace0tnfg`, database `fase4b_cutover_empty_20261004`. Endpoint directo verificado mediante MCP, SSL obligatorio y guard estricto del test. PostgreSQL 18.6. Nunca se conecta a production.

El test optativo `tests/integration/latencia.postgres.test.ts` sustituye únicamente en Vitest la fábrica del módulo singleton para habilitar eventos query de Prisma. Un solo cliente sirve a fixtures y servicio. El observador usa otra sesión del mismo pool; no cambia tamaño ni lock order. No se modifica código de producción. Los eventos se emiten sin params; las lecturas se explican con sus parámetros del fixture. Los SQL completos y muestras se conservan en la salida del diagnóstico; este informe resume medidas.

T0 es entrada al servicio, no una petición HTTP instrumentada. Las muestras del observador incluyen state, wait_event_type, wait_event, query_start, xact_start, backend_start, query, backend_xid, pg_blocking_pids y pg_locks. Son observaciones discretas: no descartan un bloqueo corto entre muestras. La observación añade carga de lectura; el control warm posterior no observa la segunda compra.

## 1. Baseline SELECT 1

Diez consultas secuenciales fuera y diez dentro de una transacción. Todas reutilizaron PID 1196. p95 por nearest rank. Milisegundos:

| Contexto | Min | Max | Promedio | Mediana | p95 |
|---|---:|---:|---:|---:|---:|
| Fuera | 124.28 | 295.66 | 210.03 | 191.44 | 295.66 |
| Dentro | 115.61 | 131.61 | 123.12 | 121.91 | 131.61 |

Apertura inicial `$connect`: 1532.74 ms. Esto mide conexión inicial completa, no sólo espera de pool.

| Inicio UTC | Fin UTC | Duración ms | Transacción | PID |
|---|---|---:|---|---:|
| 2026-10-05T02:30:32.622+00:00 | 2026-10-05T02:30:32.914+00:00 | 292.16 | False | 1196 |
| 2026-10-05T02:30:32.915+00:00 | 2026-10-05T02:30:33.094+00:00 | 179.69 | False | 1196 |
| 2026-10-05T02:30:33.095+00:00 | 2026-10-05T02:30:33.391+00:00 | 295.66 | False | 1196 |
| 2026-10-05T02:30:33.392+00:00 | 2026-10-05T02:30:33.665+00:00 | 273.21 | False | 1196 |
| 2026-10-05T02:30:33.666+00:00 | 2026-10-05T02:30:33.791+00:00 | 124.28 | False | 1196 |
| 2026-10-05T02:30:33.791+00:00 | 2026-10-05T02:30:33.942+00:00 | 150.64 | False | 1196 |
| 2026-10-05T02:30:33.943+00:00 | 2026-10-05T02:30:34.124+00:00 | 181.04 | False | 1196 |
| 2026-10-05T02:30:34.124+00:00 | 2026-10-05T02:30:34.326+00:00 | 201.84 | False | 1196 |
| 2026-10-05T02:30:34.328+00:00 | 2026-10-05T02:30:34.554+00:00 | 226.19 | False | 1196 |
| 2026-10-05T02:30:34.555+00:00 | 2026-10-05T02:30:34.731+00:00 | 175.59 | False | 1196 |
| 2026-10-05T02:30:34.865+00:00 | 2026-10-05T02:30:34.996+00:00 | 131.61 | True | 1196 |
| 2026-10-05T02:30:34.997+00:00 | 2026-10-05T02:30:35.116+00:00 | 119.77 | True | 1196 |
| 2026-10-05T02:30:35.117+00:00 | 2026-10-05T02:30:35.239+00:00 | 122.22 | True | 1196 |
| 2026-10-05T02:30:35.240+00:00 | 2026-10-05T02:30:35.355+00:00 | 115.61 | True | 1196 |
| 2026-10-05T02:30:35.355+00:00 | 2026-10-05T02:30:35.473+00:00 | 117.59 | True | 1196 |
| 2026-10-05T02:30:35.474+00:00 | 2026-10-05T02:30:35.599+00:00 | 124.97 | True | 1196 |
| 2026-10-05T02:30:35.599+00:00 | 2026-10-05T02:30:35.721+00:00 | 121.60 | True | 1196 |
| 2026-10-05T02:30:35.722+00:00 | 2026-10-05T02:30:35.853+00:00 | 131.53 | True | 1196 |
| 2026-10-05T02:30:35.854+00:00 | 2026-10-05T02:30:35.971+00:00 | 117.30 | True | 1196 |
| 2026-10-05T02:30:35.972+00:00 | 2026-10-05T02:30:36.101+00:00 | 129.06 | True | 1196 |

## 2. Cinco checkouts normales

| Corrida | Total ms | Resultado |
|---|---:|---|
| 1 | 11345.29 | Éxito |
| 2 | 6368.37 | Éxito |
| 3 | 9755.70 | Éxito |
| 4 | 3786.68 | Éxito |
| 5 | 3957.33 | Éxito |

Fixtures separados por corrida, stock 2000, Pack x50, cantidad 3; sin escritor concurrente. Diagnóstico completo: 128.05 s. No se interpreta como estabilidad de la suite completa.

## 3. T0–T11

El orden real no consiste en consultas separadas por entidad: el include de carrito carga variantes y snapshots; después se bloquean entidades y se relee configuración definitivamente. Para no inventar etapas, T3–T7 señalan finalización del lock respectivo. La carga de identidad comercial definitiva ocurre después de proteger perfiles y antes de T6; la lectura definitiva de listas/reglas y pricing ocurre después de T7, antes de T8.

Acumulados ms desde T0:

| Hito | R1 | R2 | R3 | R4 | R5 |
|---|---:|---:|---:|---:|---:|
| T0 entrada servicio | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| T1 BEGIN completado | 184.48 | 444.48 | 402.10 | 118.27 | 120.06 |
| T2 carrito e includes obtenidos | 4316.40 | 2105.98 | 2815.95 | 992.84 | 1020.12 |
| T3 variantes bloqueadas | 4858.54 | 2388.18 | 3098.58 | 1119.74 | 1140.47 |
| T4 presentaciones bloqueadas | 5414.34 | 2524.85 | 3366.08 | 1240.21 | 1259.31 |
| T5 perfiles bloqueados | 6382.51 | 2886.31 | 3893.29 | 1498.19 | 1518.10 |
| T6 listas bloqueadas | 8342.56 | 4176.86 | 5467.05 | 2247.05 | 2289.18 |
| T7 reglas bloqueadas | 8811.27 | 4303.11 | 5729.27 | 2373.05 | 2531.87 |
| T8 inventario actualizado y releído | 9881.61 | 5052.72 | 6800.23 | 2911.12 | 3031.74 |
| T9 escrituras y limpieza completadas | 11220.77 | 6243.92 | 9630.82 | 3666.26 | 3836.74 |
| T10 COMMIT completado | 11345.21 | 6368.28 | 9755.62 | 3786.60 | 3957.27 |
| T11 retorno | 11345.29 | 6368.37 | 9755.70 | 3786.68 | 3957.33 |

Delta desde hito anterior (ms):

| Hito | R1 | R2 | R3 | R4 | R5 |
|---|---:|---:|---:|---:|---:|
| T1 BEGIN completado | 184.48 | 444.48 | 402.10 | 118.27 | 120.06 |
| T2 carrito e includes obtenidos | 4131.92 | 1661.51 | 2413.86 | 874.57 | 900.07 |
| T3 variantes bloqueadas | 542.14 | 282.20 | 282.63 | 126.91 | 120.34 |
| T4 presentaciones bloqueadas | 555.80 | 136.67 | 267.50 | 120.47 | 118.85 |
| T5 perfiles bloqueados | 968.17 | 361.46 | 527.21 | 257.98 | 258.78 |
| T6 listas bloqueadas | 1960.06 | 1290.56 | 1573.76 | 748.86 | 771.08 |
| T7 reglas bloqueadas | 468.71 | 126.25 | 262.22 | 126.00 | 242.69 |
| T8 inventario actualizado y releído | 1070.34 | 749.61 | 1070.97 | 538.07 | 499.87 |
| T9 escrituras y limpieza completadas | 1339.16 | 1191.20 | 2830.59 | 755.14 | 805.00 |
| T10 COMMIT completado | 124.44 | 124.36 | 124.80 | 120.34 | 120.53 |
| T11 retorno | 0.07 | 0.09 | 0.08 | 0.08 | 0.06 |

## 4. Prisma y pausas fuera de queries

Las duraciones de eventos de Prisma NO equivalen a tiempo SQL del servidor. El include de carrito genera seis statements y el de variantes cuatro: un await no es un único round trip. Ejemplos de R1:

| Operación | Externo ms | Suma eventos ms | Statements |
|---|---:|---:|---:|
| Carrito.findUnique | 3577.29 | 3567 | 6 |
| ProductoVariante.findMany | 1423.51 | 1416 | 4 |
| ListaPrecio.findMany | 276.75 | 274 | 1 |
| ListaPrecio.findMany | 561.47 | 557 | 2 |
| Inventario.updateMany | 254.97 | 253 | 1 |
| Inventario.findUniqueOrThrow | 247.29 | 246 | 1 |
| Pedido.create | 798.23 | 793 | 3 |
| MovimientoInventario.createMany | 279.52 | 277 | 1 |
| CarritoDetalle.deleteMany | 259.63 | 258 | 1 |

La diferencia externa/eventos es pequeña: no se demuestra una pausa de segundos en JavaScript antes/después de recibir resultados. La unión de intervalos query cubre casi toda la llamada; quedan 48–74 ms fuera de esos intervalos en las cinco corridas. No se suman eventos concurrentes como si fueran secuenciales. Se excluyen explícitamente las consultas pg_stat_activity del observador. Hay 29–30 eventos restantes, incluidos BEGIN/COMMIT y comprobaciones de conexión del engine.

## 5. PostgreSQL

84 planes de lectura replay sobre el fixture después del checkout: Planning Time 0.017–0.507 ms; Execution Time 0.022–0.094 ms. Node para esos EXPLAIN: 118.83–1295.63 ms. Máximo observado 5 shared-hit buffers por nodo, 0 shared-read buffers en esos replays. Scans pequeños, nested loop, sort y unique; índice observado `variante_atributo_pkey` en Bitmap Index Scan. Ejemplo carrito: estimadas 1, reales 1, Seq Scan, Execution Time 0.058 ms; Node EXPLAIN 256.89 ms; query original en Prisma 618 ms.

Limitación: EXPLAIN se hace después del checkout, con caches calientes; carrito_detalle ya fue limpiado y sus filas reales pueden ser 0. No se afirma que esos planes midan exactamente cada SQL original en su instante. No hay pg_stat_statements disponible y no se instaló extensión. No hay evidencia para añadir índices.

El UPDATE condicional equivalente se midió en fixture separado dentro de transacción y rollback obligado: Planning Time 0.214 ms, Execution Time 0.117 ms, Node 263.08 ms. Seq Scan de una fila; estimadas 1, reales 1; ModifyTable, shared hit 4, read 0. Se comprobó stock 1850 dentro y 2000 después del rollback. No se midió ejecución servidor individual de INSERT Pedido/Movimiento; sus eventos siguen incluyendo transporte.

## 6. Locks

En las 106 muestras de las cinco compras: pg_blocking_pids vacío, sin locks granted=false observados. Los locks propios de checkout sí existen, pero no hay evidencia de un competidor que los bloquee. No se concluye ausencia absoluta entre muestras.

## 7. Wait events

101 muestras idle in transaction / Client / ClientRead; 4 idle / Client / ClientRead; 1 active / Extension / Neon/PS_ReadIO. No se observó espera Lock. Estas frecuencias no son porcentajes de tiempo: el muestreo tiene latencia variable. ClientRead significa que PostgreSQL espera al cliente, no prueba por sí solo si el tiempo corresponde a red, proxy o driver.

## 8. Transacción y COMMIT

Tiempo T0→BEGIN completado: 118–444 ms; incluye adquisición/comprobación de conexión y apertura. No puede descomponerse de forma exacta entre pool y protocolo con estos eventos. BEGIN registrado en Prisma permite ubicar su intervalo; no se agregan queries de instrumentación dentro de la transacción de negocio.

COMMIT/finalización desde última operación: 120–125 ms en las cinco compras; retorno posterior menor de 0.1 ms. No explica los segundos adicionales. La segunda compra del control warm registra BEGIN 129 ms y COMMIT 133 ms.

## 9. Neon y warm

Compute `ep-patient-sun-acc51t0z`, aws-sa-east-1, activo; autoscaling 0.25–2 CU; suspensión 0; started_at 2026-10-05 02:00:16 UTC, anterior a estas mediciones. MCP no proporciona en esta inspección series CPU/latencia ni historial suficiente para probar saturación. No hay evidencia de suspensión/reactivación durante el diagnóstico. No se cambiaron ajustes.

Control inmediato: SELECT 1 → primer checkout → reposición de línea del fixture (upsert) → segundo checkout → SELECT 1, sin sleeps ni EXPLAIN intermedios. El primer checkout hizo rollback por P2028 a 15508.41 ms; el segundo pasó en 13556.01 ms. El upsert mantiene la línea si la primera compra falla. El primer intento de este control usaba create y encontró duplicado tras rollback; sólo se corrigió ese harness.

En este control $connect tardó 4593.75 ms. Baseline fuera de transacción: mediana 126.71 ms, máximo/p95 3410.76 ms. Dentro: mediana 194.49 ms, máximo/p95 397.78 ms. La mejora de segunda compra no demuestra cold start: compute ya activo, y una consulta trivial reutilizando conexión también tuvo un pico de 3.41 s.

## 10. Conclusión

Clasificación causal precisa: **H. todavía no demostrado** para atribuir el principal responsable a red/transporte frente a engine/driver/proxy Neon. Sí se aisló el recorrido fuera de ejecución SQL como coste dominante en estas mediciones: planes y UPDATE submilisegundo frente a cientos de milisegundos desde Node, sin blockers y con diferencias externas/eventos pequeñas. No se demuestra scan costoso, fuga, saturación del pool ni cold start. La multiplicidad de round trips amplifica ese coste.

No hay paquete pg disponible. No se añadieron dependencias para comparar driver directo; falta esa medición para separar Prisma native engine de transporte/proxy. Los replays y muestreo no reconstruyen retroactivamente toda la ejecución que falló en R1.

## 11. Próximo cambio propuesto — NO aplicado

Primero comparar SELECT 1 con conexión persistente de otro driver/libpq desde el mismo host y desde uno cercano a aws-sa-east-1, usando la misma DB de test. Esto separaría transporte de engine sin tocar ventas. Como mejora funcional mínima candidata, el include de carrito en pedido.service.ts carga inventario aunque crear() no utiliza ese valor (la validación definitiva usa update condicional y relectura). Retirar sólo ese include ahorraría un round trip medido, conservando locks y lógica. Requiere autorización y gates; no elimina por sí solo la variabilidad ni promete resolver el timeout. No se aplicó.

## 12. Estado final

Sólo se añadió el diagnóstico optativo. No cambian schema, migraciones, límites, pool, checkout, pricing, frontend ni datos production. No hay merge, commit final o deploy. PostgreSQL local 16 sigue fuera de alcance por el rename histórico del constraint NOT NULL; no se modifica esa migración.

Prisma validate/generate, typecheck, build y tests habituales pasan (307, 33 archivos; 38 PostgreSQL/diagnóstico omitidos). Diagnósticos: cinco compras medidas; control inmediato medido con fallo real de primera compra y éxito de segunda; UPDATE explicado y rollback comprobado. Un test diagnóstico que captura un P2028 y registra datos no equivale a un checkout exitoso.

Limpieza final verificada mediante MCP: cero filas en tablas de fixtures, cero constraint temporal, cero conexiones de test y cero transacciones abiertas. No se ejecutó la suite completa PostgreSQL para declarar aprobación de 5C.1.

FASE 5C.1-R2 DIAGNÓSTICA COMPLETADA
