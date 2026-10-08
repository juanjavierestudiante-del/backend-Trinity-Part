# Admin comercial — Fase 5C.1

## Auditoría previa

| Entidad | Estado previo | Extensión |
| --- | --- | --- |
| PresentacionVenta | Resolver/checkout, sin CRUD Admin | Crear borrador, editar, activar, principal, orden |
| PerfilPrecio | Resolver/checkout, sin CRUD Admin | Crear, editar, principal, orden, desactivar |
| ListaPrecio | CRUD en precios-cantidad, selección legacy | Mismas rutas POST/PUT/DELETE, combinación presentación/perfil |
| ReglaPrecioCantidad | Guardado conjunto y preview | Reutilizar sincronización; agregar CRUD individual |
| Variante | Asignación legacy de lista | Asignación individual/masiva de perfil, NULL hereda |
| Configuración | GET precios-cantidad legacy | GET configuración-comercial consolidado |

Todos los endpoints se montan bajo `/api/admin` con sesión Activa y rol ADMIN.
No se agregan tablas, migraciones, precios ni configuraciones de production.

## Contratos

Prefijo por producto: `/api/admin/productos/:idProducto`.

| Método | Sufijo | Entrada |
| --- | --- | --- |
| GET | /configuracion-comercial | — |
| POST | /presentaciones | nombre, cantidadBase, principal?, activo?, orden? |
| PATCH | /presentaciones/:idPresentacion | campos parciales |
| POST | /perfiles-precio | nombre, principal?, activo?, orden? |
| PATCH | /perfiles-precio/:idPerfilPrecio | campos parciales |
| PATCH | /variantes/:idVariante/perfil | idPerfilPrecio: ID o null |
| PATCH | /variantes/perfiles | asignaciones: [{idVariante,idPerfilPrecio}] |
| POST | /listas-precio | nombre, idPresentacion?, idPerfilPrecio?, activo?, principal?, reglas? |
| PUT | /listas-precio/:idListaPrecio | configuración completa de la misma combinación |
| DELETE | /listas-precio/:idListaPrecio | desactivar, no borrar físicamente |
| POST | /listas-precio/:idListaPrecio/reglas | nombre, cantidadMinima, precioPorPresentacion, activo?, orden? |
| PATCH | /listas-precio/:idListaPrecio/reglas/:idReglaPrecio | campos parciales |
| DELETE | /listas-precio/:idListaPrecio/reglas/:idReglaPrecio | eliminar regla secundaria o regla de borrador |

Los precios entran/salen como strings decimales, con hasta 2 decimales y máximo
99999999.99 conforme a Decimal(10,2). Cantidades base y umbrales son Int positivos.
El constraint físico impide umbrales duplicados incluso entre reglas inactivas.
No se crea un stock por presentación.

## Configuración por etapas

Una presentación nueva es inactiva por defecto. Un perfil nuevo es activo pero
no principal por defecto; el primer perfil activo debe marcarse principal.
Las listas nuevas son borradores inactivos por defecto y pueden tener cero reglas.
No se genera automáticamente la matriz: no se inventan precios.

Configurar: crear presentación borrador, crear perfil, crear lista inactiva,
agregar regla 1, activar lista y finalmente activar presentación. Una lista
activa puede prepararse para padres inactivos, pero `vendible` seguirá false.
La combinación de una lista existente es inmutable.
Omitir `principal` al editar una lista conserva su valor anterior; al crearla
se utiliza false. El indicador principal de lista sigue siendo metadata legacy:
la resolución nueva utiliza la combinación exacta de presentación y perfil.

Para activar presentación o usar perfil (principal o asignado) deben existir
listas activas desde 1 para todas sus combinaciones efectivas. Cambiar el
principal demueve el anterior y promueve el nuevo en una sola transacción.
No se permite quitar/desactivar el principal directamente.
Los perfiles asignados no se pueden desactivar, incluso si la variante está inactiva.

No hay borrado físico de presentaciones/perfiles. Para presentación con líneas
de carrito se rechaza desactivación/cambio de cantidadBase. Renombrar/ordenar
conserva los snapshots de pedidos. Cancelación sigue usando esos snapshots.

## Locks y carrera con agregar al carrito

Cada escritura Admin serializa editores del producto con Producto NO KEY UPDATE,
después toma variantes -> presentaciones -> perfiles -> listas, cada entidad por
ID ASC. Son locks NO KEY UPDATE que entran en conflicto con SHARE de checkout.
Las listas usan el helper existente `bloquearListasParaEscrituraReglas` antes
de cualquier escritura de reglas, incluido INSERT y reemplazo conjunto.
Se bloquea el conjunto del producto para validar la matriz completa. Esto
reduce concurrencia de edición por producto a cambio de invariantes simples.

Agregar al carrito ahora usa la misma transacción para: resolver/crear carrito,
Carrito FOR UPDATE -> Variante SHARE -> PresentacionVenta SHARE -> función
`agregar_item_carrito`. La función existente revalida actividad, propiedad,
cantidad base y stock después de los locks. No cambia API, pricing, cantidades,
consumo ni reserva de stock. Checkout no se modifica.

Si carrito entra primero, Admin espera y detecta la referencia comprometida.
Si Admin entra primero, carrito espera y revalida configuración ya comprometida.
Toda falla de validación revierte la operación completa.

Las rutas antiguas de lectura, preview y asignación de lista permanecen por
compatibilidad; el nuevo Admin no lee ni escribe idListaPrecio de variante,
idUnidad ni cantidadContenido. Las operaciones futuras deben cumplir también
`checkout-configuracion-locking.md`; SQL externo no queda cubierto automáticamente.

## Verificación PostgreSQL

La suite `tests/integration/pedido.inventario.postgres.test.ts` sólo se habilita
con `VENTAS_POSTGRES_TEST=1`. Antes de escribir valida el endpoint directo
autorizado y la base `fase4b_cutover_empty_20261004`, exige SSL y comprueba que
no existan productos/usuarios ajenos. Sólo limpia los IDs de sus fixtures.
No admite un bypass local del control de endpoint. El entorno Neon verificado
utiliza PostgreSQL 18.6. La reconstrucción local anterior sobre PostgreSQL 16
falló en `00000000000001_restore_manual_postgres_objects`, al renombrar
`regla_precio_cantidad_cantidad_minima_not_null`: PostgreSQL 16 no representa
el NOT NULL automático mediante ese constraint con nombre. Es un problema
independiente; no se modifica el historial para adaptarlo.

Para observar concurrencia se usan los helpers de locking reales y
`pg_blocking_pids`. Las pausas controladas del harness no sustituyen SQL ni
introducen hooks en producción. Fixtures, servicios y observador comparten un
único PrismaClient; las transacciones concurrentes siguen utilizando sesiones
PostgreSQL independientes. El tamaño del pool y el timeout transaccional
comercial de 15 segundos no se alteran.

El diagnóstico optativo `VENTAS_POSTGRES_DIAGNOSTICO=1` mide operaciones sin
imprimir argumentos, credenciales ni URLs. Comprueba fixtures y transacciones
abiertas después de cada caso. El estado de recuperación y sus límites se
documentan en `postgres-suite-diagnostico.md`.
