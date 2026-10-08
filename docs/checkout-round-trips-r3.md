# Fase 5C.1-R3 — reducción de round trips

## Entorno, archivos y estado

Rama `fase5c1-admin-comercial-backend`. Endpoint directo de Neon verificado, proyecto `dry-pond-23712811`, branch `br-withered-sky-ace0tnfg`, database `fase4b_cutover_empty_20261004`, SSL. No production. La inspección inicial mostró compute idle/suspended; el preflight SELECT read-only confirmó identidad y DB vacía antes de fixtures. No se alteró compute/configuración. Región Neon aws-sa-east-1; región del host ejecutor UNKNOWN (sin AWS_REGION/AWS_DEFAULT_REGION/RENDER_REGION/FLY_REGION). No se extrapolan tiempos a Render.

Cambios R3: `src/repositories/pedido.repository.ts`, `src/repositories/resolucion-comercial.repository.ts`, `src/services/pedido.service.ts`, `src/services/resolucion-comercial.service.ts`; adaptaciones de mocks en `tests/unit/pedido.cutover.test.ts`, `tests/unit/pedido.logistica.test.ts`, `tests/unit/checkout.configuracion-lock.test.ts`; nuevos tests `tests/unit/checkout.lecturas.test.ts`; caso PostgreSQL de snapshots con atributo añadido en `tests/integration/pedido.inventario.postgres.test.ts`; modo diez corridas en `tests/integration/latencia.postgres.test.ts`; este informe. Se preservan los cambios previos de 5C.1/R/R2 sin commit final.

Leyenda: PS = `src/services/pedido.service.ts` (coordinador/transacción y Prisma existente); RC = `src/repositories/resolucion-comercial.repository.ts` (llamado desde service comercial); RP = `src/repositories/pedido.repository.ts`. BEGIN/COMMIT los emite Prisma al ejecutar $transaction. Las tablas enumeran statements reales del escenario de una línea sin atributos; no sólo awaits.

## 1. Round trips antes

| N | Operación | Archivo/capa | Query | Entidad | Correctness | Consolidación | Eliminación |
|---|---|---|---|---|---|---|---|
| 1 | BEGIN | PS | control | transacción | Sí | No | No |
| 2 | Lock carrito | PS | SELECT FOR UPDATE | carrito | Sí | No | No |
| 3 | Carrito | PS | SELECT | carrito | Sí | Junto con carrito/snapshots | No |
| 4 | Líneas | PS | SELECT | carrito_detalle | Sí | Junto con carrito/snapshots | No |
| 5 | SKU | PS | SELECT | producto_variante | Sí | Junto con carrito/snapshots | No |
| 6 | Snapshot producto | PS | SELECT | producto | Sí | Junto con carrito/snapshots | No |
| 7 | Relaciones de atributos | PS | SELECT | variante_atributo | Sí | Junto con carrito/snapshots | No |
| 8 | Stock inicial sin uso | PS | SELECT | inventario | No | No | Sí: stock no usado |
| 9 | Lock variantes | RC | SELECT FOR SHARE | producto_variante | Sí | No | No |
| 10 | Lock presentaciones | RC | SELECT FOR SHARE | presentacion_venta | Sí | No | No |
| 11 | Discovery perfiles efectivos | RC | SELECT | producto_variante + perfil_precio | Sí | No | No |
| 12 | Lock perfiles | RC | SELECT FOR SHARE | perfil_precio | Sí | No | No |
| 13 | Identidad variante | RC | SELECT | producto_variante | Sí | Identidad protegida en 1 SELECT | No |
| 14 | Estado producto | RC | SELECT | producto | Sí | Identidad protegida en 1 SELECT | No |
| 15 | Presentaciones candidatas | RC | SELECT | presentacion_venta | Sí | Identidad protegida en 1 SELECT | No |
| 16 | Perfiles principales | RC | SELECT | perfil_precio | Sí | Identidad protegida en 1 SELECT | No |
| 17 | Discovery IDs listas | RC | SELECT | lista_precio | Sí | No | No |
| 18 | Lock listas | RC | SELECT FOR SHARE | lista_precio | Sí | No | No |
| 19 | Lock reglas | RC | SELECT FOR SHARE | regla_precio_cantidad | Sí | No | No |
| 20 | Listas definitivas | RC | SELECT | lista_precio | Sí | Listas + reglas en 1 SELECT | No |
| 21 | Reglas definitivas | RC | SELECT | regla_precio_cantidad | Sí | Listas + reglas en 1 SELECT | No |
| 22 | Decremento condicional | PS | UPDATE | inventario | Sí | No | No |
| 23 | Stock posterior | PS | SELECT | inventario | Sí | No | No |
| 24 | Pedido | PS | INSERT RETURNING | pedido | Sí | No | No |
| 25 | Detalle | PS | INSERT RETURNING | pedido_detalle | Sí | No | No |
| 26 | Retorno completo pedido | PS | SELECT | pedido | Sí | No | No |
| 27 | Movimientos agrupados | PS | INSERT createMany | movimiento_inventario | Sí | No | No |
| 28 | Vaciar líneas | PS | DELETE | carrito_detalle | Sí | No | No |
| 29 | COMMIT | PS | control | transacción | Sí | No | No |

29 statements de R2, corrida 1. Con atributos reales pueden aparecer lecturas adicionales de valor_atributo/atributo; un perfil explícito también puede añadir consulta. SELECT 1 de comprobación de conexión del engine se reporta aparte (no es lógica comercial).

## 2. Round trips después

| N | Operación | Archivo/capa | Query | Entidad | Correctness | Consolidación | Eliminación |
|---|---|---|---|---|---|---|---|
| 1 | BEGIN | PS | control | transacción | Sí | Sin cambio | No |
| 2 | Lock carrito | PS | SELECT FOR UPDATE | carrito | Sí | Sin cambio | No |
| 3 | Carrito y snapshots consolidados | RP | SELECT JSON parametrizado | carrito/líneas/variantes/producto/atributos | Sí | Ya consolidada | No |
| 4 | Lock variantes | RC | SELECT FOR SHARE | producto_variante | Sí | Sin cambio | No |
| 5 | Lock presentaciones | RC | SELECT FOR SHARE | presentacion_venta | Sí | Sin cambio | No |
| 6 | Discovery perfiles efectivos | RC | SELECT | producto_variante + perfil_precio | Sí | Sin cambio | No |
| 7 | Lock perfiles | RC | SELECT FOR SHARE | perfil_precio | Sí | Sin cambio | No |
| 8 | Identidad comercial protegida consolidada | RC | SELECT JSON parametrizado | variantes/producto/presentaciones/perfiles | Sí | Ya consolidada | No |
| 9 | Discovery IDs listas | RC | SELECT | lista_precio | Sí | Sin cambio | No |
| 10 | Lock listas | RC | SELECT FOR SHARE | lista_precio | Sí | Sin cambio | No |
| 11 | Lock reglas | RC | SELECT FOR SHARE | regla_precio_cantidad | Sí | Sin cambio | No |
| 12 | Listas y reglas definitivas consolidadas | RC | SELECT JSON parametrizado | lista_precio + regla_precio_cantidad | Sí | Ya consolidada | No |
| 13 | Decremento condicional | PS | UPDATE | inventario | Sí | Sin cambio | No |
| 14 | Stock posterior | PS | SELECT | inventario | Sí | Sin cambio | No |
| 15 | Pedido | PS | INSERT RETURNING | pedido | Sí | Sin cambio | No |
| 16 | Detalle | PS | INSERT RETURNING | pedido_detalle | Sí | Sin cambio | No |
| 17 | Retorno completo pedido | PS | SELECT | pedido | Sí | Sin cambio | No |
| 18 | Movimientos agrupados | PS | INSERT createMany | movimiento_inventario | Sí | Sin cambio | No |
| 19 | Vaciar líneas | PS | DELETE | carrito_detalle | Sí | Sin cambio | No |
| 20 | COMMIT | PS | control | transacción | Sí | Sin cambio | No |

20 statements en cada checkout exitoso, excluyendo health-check SELECT 1. Reducción de 9/29 = 31.03%. La compra fallida abortó antes de completar el flujo: sus statements parciales no se usan para declarar una reducción mayor.

## 3. Queries eliminadas

Sólo se elimina contenido innecesario: la lectura inicial de inventario. La búsqueda de crear() confirma que ese dato no interviene en cálculo, error, retorno ni descuento. El inventario autoritativo sigue siendo UPDATE condicional + relectura dentro de la misma transacción. Las otras ocho queries ahorradas conservan su contenido dentro de lecturas consolidadas.

## 4. Queries consolidadas

Carrito/snapshots: 6→1; variante/producto/presentaciones/perfiles después de locks: 4→1; listas/reglas definitivas: 2→1. Raw SQL parametrizado mediante $queryRaw/Prisma.join/Prisma.sql, tipos explícitos y JSONB, sin concatenar IDs externos. No se cambia el algoritmo de umbrales ni se adelanta resolución definitiva.

## 5. Include inventario

Retirado del camino de creación de pedido. El helper nuevo proyecta únicamente idCarrito, líneas y campos de snapshots existentes. El helper legacy findCarritoWithItems no se modifica. API carrito/checkout y retorno de Pedido permanecen iguales.

## 6. Lectura comercial

Discovery de IDs perfiles → SHARE perfiles → lectura consolidada de identidad; conserva perfil explícito, principales activos (hasta dos candidatos) y todas las presentaciones para las mismas validaciones. Después: discovery IDs listas → SHARE listas → SHARE reglas → lectura consolidada definitiva. Se mantienen comprobaciones de IDs protegidos contra TOCTOU. Precios se seleccionan como texto SQL y convierten a Prisma.Decimal, nunca Number. Candidatos cruzados/inactivos/ausentes siguen rechazados por el mismo service.

## 7. Locks

Carrito FOR UPDATE → variantes SHARE → presentaciones SHARE → perfiles SHARE → listas SHARE → reglas SHARE → inventario condicional, IDs deduplicados/ordenados como antes. Ninguna query de lock fue fusionada o eliminada. Escritura Admin de reglas sigue NO KEY UPDATE sobre ListaPrecio padre, protegiendo también INSERT.

## 8. Escrituras

Sin cambios: nested create Pedido/Detalles y relectura de Pedido; movimientos createMany agrupados por variante; un deleteMany de líneas por carrito. Para múltiples detalles Prisma puede emitir más de un INSERT. No se cambió a bulk porque no es necesario para conseguir reducción material y se prioriza conservar retorno/snapshots. Consumo agregado por idVariante ASC, UPDATE condicional y snapshots históricos intactos.

## 9. Benchmark

| Corrida | Total ms | Resultado |
|---|---:|---|
| 1 | 5685.64 | Éxito |
| 2 | 20039.01 | P2028 + rollback |
| 3 | 4697.68 | Éxito |
| 4 | 4508.79 | Éxito |
| 5 | 7948.87 | Éxito |
| 6 | 6974.78 | Éxito |
| 7 | 11695.10 | Éxito |
| 8 | 2648.12 | Éxito |
| 9 | 2689.00 | Éxito |
| 10 | 2658.15 | Éxito |

Muestra completa: mínimo 2648.12 ms; máximo 20039.01 ms; promedio 6954.51 ms; mediana 5191.66 ms; p95 nearest-rank 20039.01 ms; 1 P2028 de 10.

Referencia R2 cinco corridas: promedio 7042.67 ms, mediana 6368.37 ms, máximo/p95 11345.29 ms. El promedio R3 sólo baja 1.25%; la cola empeora por un timeout. No se compara sólo las compras exitosas para ocultar el fallo. Reducción de statements demostrada; mejora de estabilidad NO demostrada. Diferentes condiciones de transporte impiden atribuir todo el delta de tiempo al código.

La corrida 2 terminó a 20039.01 ms. Tras lock carrito (2742 ms) y lectura consolidada (2888 ms), el siguiente raw de lock variantes estuvo pendiente 13994 ms y acabó en P2028: el error reporta transacción expirada a 19613 ms con límite 15000. ROLLBACK se registró con 4612 ms. No hubo blockers; muestras idle in transaction/ClientRead o idle/ClientRead. No se prueba que la ejecución del lock SQL fuera lenta; no existe evento de ejecución exitosa de ese statement.

El proceso ya había completado las diez corridas al recibir la interrupción solicitada tras detectar el fallo. No se inicia otra optimización ni suite completa. El test diagnóstico captura errores y mide: su estado passed NO significa diez compras exitosas.

## 10. SELECT 1

Conexión inicial separada: 1402.87 ms. Diez llamadas fuera/dentro antes de checkout, secuenciales y con reutilización. No se incluyen esos tiempos ni fixtures/EXPLAIN/observador final en total de crear().

| Contexto | Min ms | Max ms | Promedio ms | Mediana ms | p95 ms |
|---|---:|---:|---:|---:|---:|
| Fuera | 117.20 | 240.24 | 136.51 | 126.23 | 240.24 |
| Dentro | 118.37 | 137.76 | 128.49 | 127.96 | 137.76 |

La primera compra es primer uso de las lecturas consolidadas, pero ya había conexión calentada por SELECT 1. No se presenta como checkout cold-start. psql/libpq está disponible; no se hizo una comparación adicional tras alcanzar la condición explícita de detener por latencia.

## 11. PostgreSQL server-side

73 EXPLAIN de lecturas: Planning 0.011–0.978 ms; Execution 0.012–0.240 ms. Lecturas consolidadas mantienen coste submilisegundo en fixtures. Son replays tras compra/rollback, con las mismas limitaciones de caché y carrito vaciado documentadas en R2. No se modificaron índices ni se atribuye el P2028 a un scan.

## 12. Prisma/Node y etapas

Los includes multi-query se sustituyen sólo en el camino de checkout. El helper no mezcla los timestamps de observers con queries comerciales. Ejemplo corrida 1 (acumulados):

| Etapa | Acumulado ms |
|---|---:|
| BEGIN completado | 122.82 |
| Carrito consolidado | 671.37 |
| Lock variantes | 940.29 |
| Lock presentaciones | 1212.08 |
| Lock perfiles | 1741.88 |
| Identidad consolidada | 2001.59 |
| Lock listas | 2512.93 |
| Lock reglas | 2785.38 |
| Listas y reglas definitivas | 3093.40 |
| Escrituras/limpieza | 5566.37 |
| COMMIT completado | 5685.59 |

## 13. Suite PostgreSQL completa

Ejecución 1: no ejecutada. Ejecución 2: no ejecutada. Se aplica la regla de detener cuando aparece checkout normal >15 s. No se declaran verificados de nuevo los casos de concurrencia/rollback/overflow/locking completos después de este cambio. Suite preparada: 38 casos, incluido uno nuevo para snapshots de atributo principal, pendiente de ejecución.

## 14. Tests habituales

311/311 pasan en 34 archivos; 38 PostgreSQL y un diagnóstico optativo omitidos. Cuatro casos nuevos prueban carrito inexistente/vacío, ausencia de consultas sin IDs, Decimal y preservación de reglas inactivas. Tests existentes conservan asserts de pricing, snapshots, stock, estados y lock order; sólo se adaptan los mocks a los nuevos helpers. No sustituyen la integración real pendiente.

## 15–19. Gates locales

Prisma validate OK; Prisma generate OK; typecheck OK; build OK; git diff --check backend OK. No se modifica whitespace ajeno.

## 20. Timeout

15 segundos sin cambios. maxWait comercial también permanece igual. No se cambia timeout para convertir el fallo en éxito.

## 21. Pool

Sin aumento ni cambios de connection_limit. Mismo singleton/harness de diagnóstico. No se cambiaron settings de Neon.

## 22. Migraciones

Ninguna. schema.prisma y migraciones históricas intactos. PostgreSQL local sigue fuera de alcance.

## 23. Production

Ninguna escritura, sin deploy, merge ni push. Limpieza MCP: cero fixtures (incluidos atributos/relaciones), cero constraint temporal, cero conexiones de test, cero transacciones abiertas.

## 24. Riesgos pendientes

Latencia variable todavía puede expirar transacciones normales, incluso con 20 statements. No está identificado el componente exacto entre transporte, proxy Neon y engine/driver. El observer agrega lectura y no convierte esta muestra en medición de production. Falta gate completo dos veces y pruebas reales adicionales de snapshots/relaciones tras la consolidación. Cambios quedan locales y revisables; no aptos para deploy hasta cerrar gates.

## 25. Resultado

FASE 5C.1-R3 DETENIDA POR LATENCIA.
