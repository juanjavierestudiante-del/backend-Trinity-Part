#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Falta $ENV_FILE" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "No se encontró psql en PATH" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL_TARGET:-}" ]]; then
  echo "Define DATABASE_URL_TARGET con la URL del destino antes de ejecutar este script." >&2
  exit 1
fi

SRC_URL="$(sed -n 's/^DATABASE_URL=//p' "$ENV_FILE" | head -n 1)"
TGT_URL="$DATABASE_URL_TARGET"

if [[ -z "$SRC_URL" ]]; then
  echo "No se pudo leer DATABASE_URL desde $ENV_FILE" >&2
  exit 1
fi

run_src_psql() {
  psql "$SRC_URL" -X -v ON_ERROR_STOP=1 "$@"
}

run_tgt_psql() {
  psql "$TGT_URL" -X -v ON_ERROR_STOP=1 "$@"
}

copy_table_csv() {
  local table_name="$1"
  local file_path="$2"

  run_src_psql -c "\\copy (SELECT * FROM public.\"${table_name}\") TO '${file_path}' WITH (FORMAT csv, NULL '\\N')"
  run_tgt_psql -c "\\copy public.\"${table_name}\" FROM '${file_path}' WITH (FORMAT csv, NULL '\\N')"
}

copy_categoria_csv() {
  local file_path="$1"

  run_src_psql -c "\\copy (
WITH RECURSIVE categoria_tree AS (
  SELECT
    c.id_categoria,
    c.id_categoria_padre,
    c.nombre,
    c.slug,
    c.descripcion,
    c.imagen_public_id,
    c.imagen_url,
    c.orden,
    c.estado,
    ARRAY[c.id_categoria] AS path
  FROM public.categoria c
  WHERE c.id_categoria_padre IS NULL
  UNION ALL
  SELECT
    c.id_categoria,
    c.id_categoria_padre,
    c.nombre,
    c.slug,
    c.descripcion,
    c.imagen_public_id,
    c.imagen_url,
    c.orden,
    c.estado,
    categoria_tree.path || c.id_categoria
  FROM public.categoria c
  JOIN categoria_tree ON c.id_categoria_padre = categoria_tree.id_categoria
)
SELECT
  id_categoria,
  id_categoria_padre,
  nombre,
  slug,
  descripcion,
  imagen_public_id,
  imagen_url,
  orden,
  estado
FROM categoria_tree
ORDER BY path
) TO '${file_path}' WITH (FORMAT csv, NULL '\\N')"

  run_tgt_psql -c "\\copy public.\"categoria\" FROM '${file_path}' WITH (FORMAT csv, NULL '\\N')"
}

reset_sequences() {
  run_tgt_psql <<'SQL'
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      table_name,
      column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (column_default LIKE 'nextval(%' OR is_identity = 'YES')
  LOOP
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(%L, %L), COALESCE(MAX(%I), 1), MAX(%I) IS NOT NULL) FROM %I.%I',
      'public.' || r.table_name,
      r.column_name,
      r.column_name,
      r.column_name,
      'public',
      r.table_name
    );
  END LOOP;
END $$;
SQL
}

main() {
  local tmpdir
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' EXIT

  pushd "$ROOT_DIR" >/dev/null

  echo "Aplicando migraciones Prisma en el destino..."
  DATABASE_URL="$TGT_URL" npx prisma migrate deploy

  echo "Vaciando tablas de datos en el destino..."
  run_tgt_psql <<'SQL'
SELECT format(
  'TRUNCATE TABLE %I.%I RESTART IDENTITY CASCADE;',
  schemaname,
  tablename
)
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename <> '_prisma_migrations'
ORDER BY tablename
\gexec
SQL

  echo "Copiando datos..."
  copy_categoria_csv "$tmpdir/categoria.csv"
  copy_table_csv "usuario" "$tmpdir/usuario.csv"
  copy_table_csv "marca" "$tmpdir/marca.csv"
  copy_table_csv "unidad_medida" "$tmpdir/unidad_medida.csv"
  copy_table_csv "proveedor" "$tmpdir/proveedor.csv"
  copy_table_csv "atributo" "$tmpdir/atributo.csv"
  copy_table_csv "valor_atributo" "$tmpdir/valor_atributo.csv"
  copy_table_csv "producto" "$tmpdir/producto.csv"
  copy_table_csv "imagen_producto" "$tmpdir/imagen_producto.csv"
  copy_table_csv "producto_variante" "$tmpdir/producto_variante.csv"
  copy_table_csv "imagen_variante" "$tmpdir/imagen_variante.csv"
  copy_table_csv "inventario" "$tmpdir/inventario.csv"
  copy_table_csv "movimiento_inventario" "$tmpdir/movimiento_inventario.csv"
  copy_table_csv "variante_atributo" "$tmpdir/variante_atributo.csv"
  copy_table_csv "variante_proveedor" "$tmpdir/variante_proveedor.csv"
  copy_table_csv "carrito" "$tmpdir/carrito.csv"
  copy_table_csv "carrito_detalle" "$tmpdir/carrito_detalle.csv"
  copy_table_csv "pedido" "$tmpdir/pedido.csv"
  copy_table_csv "pedido_detalle" "$tmpdir/pedido_detalle.csv"

  echo "Recalculando secuencias..."
  reset_sequences

  popd >/dev/null
  echo "Migración completada."
}

main "$@"
