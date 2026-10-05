# Contrato transaccional de configuración comercial

## Checkout

El descuento ocurre al crear el pedido PENDIENTE. La misma transacción conserva
los locks hasta COMMIT/ROLLBACK y ejecuta este orden:

1. Carrito: `FOR UPDATE`.
2. Variantes utilizadas: `FOR SHARE` (protege la asignación de perfil).
3. Presentaciones utilizadas: `FOR SHARE`.
4. Perfiles efectivos: `FOR SHARE`.
5. Listas efectivas: `FOR SHARE`.
6. Todas las reglas de esas listas, activas e inactivas: `FOR SHARE`.
7. Inventario: decremento condicional, por variante ascendente.

Cada conjunto de IDs se deduplica y se bloquea en orden ascendente. El nombre
real de la PK de reglas es `id_regla_precio`.

El descubrimiento inicial sólo obtiene IDs. No selecciona un umbral ni calcula
precios. La identidad se revalida después del lock de perfiles y las reglas se
leen después de bloquear listas y reglas. Si un perfil/lista efectivo difiere
de los IDs protegidos, el checkout aborta con error de configuración 409.

## Escrituras de reglas: obligatorio para todos los callers

Toda operación CREATE, UPDATE o DELETE de ReglaPrecioCantidad debe:

1. Abrir una transacción.
2. Llamar `bloquearListasParaEscrituraReglas(idsListas, tx)` antes de leer o
   modificar reglas. El helper usa `FOR NO KEY UPDATE` en ListaPrecio padre.
3. Leer/validar/modificar reglas utilizando el mismo `tx`.
4. Mantener el lock hasta COMMIT/ROLLBACK.

Para trasladar una regla entre listas, bloquear ambos padres antes de escribir.
El repository Admin existente cumple este contrato en `sincronizarReglas`.
Además, `guardarLista` bloquea anticipadamente en orden todas las listas que
puede actualizar al cambiar la lista principal.

Una inserción con una FK solamente adquiere KEY SHARE en el padre: es compatible
con SHARE y **no** impide nuevos umbrales. Por eso está prohibido agregar callers
que escriban reglas directamente sin el helper. El contrato es de aplicación;
SQL externo y scripts de mantenimiento también deben cumplirlo. No hay trigger
ni restricción nueva en la base que lo imponga automáticamente.

Las futuras operaciones que escriban varias entidades deben respetar el mismo
orden global. Una modificación de perfil y asignaciones de variantes debe
adquirir primero las variantes; una edición de reglas no debe tomar después
locks de perfiles o presentaciones.

## Cancelación e Int PostgreSQL

La reposición usa exclusivamente snapshots históricos. El repository aplica
un incremento condicional con `stock_actual <= 2147483647 - cantidad`. Si no
hay rango disponible, devuelve AppError 409: "La reposición excede el límite
permitido de inventario." El estado del pedido, otros incrementos y movimientos
se revierten juntos por la transacción existente.

## Verificación

La suite habitual corre con `npm test`. La suite real es opt-in:

```sh
VENTAS_POSTGRES_TEST=1 npx vitest run tests/integration/pedido.inventario.postgres.test.ts
```

DATABASE_URL debe suministrarse temporalmente al proceso. La suite rechaza
cualquier endpoint/database distinta de la base aislada autorizada, y exige
ausencia de productos/usuarios antes de crear sus fixtures. No ejecutar contra
production. Verificar primero la branch mediante Neon MCP.

Las pruebas concurrentes observan `pg_blocking_pids`: comprueban que la escritura
espera realmente al checkout y luego finaliza tras COMMIT. No se amplía el timeout
de checkout (15 segundos).
