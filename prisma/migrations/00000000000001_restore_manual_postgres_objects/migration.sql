-- Objetos PostgreSQL que Prisma no representa con fidelidad completa.

-- Las funciones se copian sin cambiar su lógica.

ALTER TABLE "producto" ALTER COLUMN "fecha_actualizacion" SET DEFAULT now();

ALTER INDEX "lista_precio_id_producto_activo_idx" RENAME TO "lista_precio_producto_activo_idx";

ALTER INDEX "regla_precio_cantidad_id_lista_precio_activo_orden_idx" RENAME TO "regla_precio_cantidad_lista_activo_orden_idx";

CREATE UNIQUE INDEX "lista_precio_producto_principal_activa_key" ON "lista_precio"("id_producto") WHERE "principal" = true AND "activo" = true;

CREATE UNIQUE INDEX "regla_precio_cantidad_lista_cantidad_minima_key" ON "regla_precio_cantidad"("id_lista_precio", "cantidad_minima");

CREATE UNIQUE INDEX "regla_precio_cantidad_lista_principal_activa_key" ON "regla_precio_cantidad"("id_lista_precio") WHERE "principal" = true AND "activo" = true;

ALTER TABLE "regla_precio_cantidad" RENAME CONSTRAINT "regla_precio_cantidad_cantidad_minima_not_null" TO "regla_precio_cantidad_cantidad_base_not_null";

ALTER TABLE "regla_precio_cantidad" RENAME CONSTRAINT "regla_precio_cantidad_precio_por_presentacion_not_null" TO "regla_precio_cantidad_precio_total_not_null";

ALTER TABLE "regla_precio_cantidad" ADD CONSTRAINT "regla_precio_cantidad_cantidad_minima_positive_check" CHECK ("cantidad_minima" > 0);

ALTER TABLE "regla_precio_cantidad" ADD CONSTRAINT "regla_precio_cantidad_precio_por_presentacion_positive_check" CHECK ("precio_por_presentacion" > 0);

CREATE OR REPLACE FUNCTION public.agregar_item_carrito(p_usuario_id integer, p_variante_id integer, p_cantidad integer)
 RETURNS TABLE("idDetalle" integer, "idCarrito" integer, "idVariante" integer, cantidad integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_carrito_id INTEGER;
  v_stock INTEGER;
  v_detalle_id INTEGER;
  v_cantidad_final INTEGER;
BEGIN
  IF p_cantidad < 1 THEN
    RAISE EXCEPTION 'CART_INVALID_QUANTITY' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO "carrito" ("id_usuario")
  VALUES (p_usuario_id)
  ON CONFLICT ("id_usuario") DO UPDATE SET "id_usuario" = EXCLUDED."id_usuario"
  RETURNING "id_carrito" INTO v_carrito_id;

  SELECT COALESCE(i."stock_actual", 0)
  INTO v_stock
  FROM "producto_variante" pv
  INNER JOIN "producto" p ON p."id_producto" = pv."id_producto"
  LEFT JOIN "inventario" i ON i."id_variante" = pv."id_variante"
  WHERE pv."id_variante" = p_variante_id
    AND pv."estado" = 'Activo'
    AND p."estado" = 'Activo';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CART_VARIANT_NOT_AVAILABLE' USING ERRCODE = 'P0001';
  END IF;
  IF p_cantidad > v_stock THEN
    RAISE EXCEPTION 'CART_INSUFFICIENT_STOCK' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO "carrito_detalle" ("id_carrito", "id_variante", "cantidad")
  VALUES (v_carrito_id, p_variante_id, p_cantidad)
  ON CONFLICT ("id_carrito", "id_variante") DO UPDATE
    SET "cantidad" = "carrito_detalle"."cantidad" + EXCLUDED."cantidad"
    WHERE "carrito_detalle"."cantidad" + EXCLUDED."cantidad" <= v_stock
  RETURNING "carrito_detalle"."id_detalle", "carrito_detalle"."cantidad"
    INTO v_detalle_id, v_cantidad_final;

  IF FOUND THEN
    RETURN QUERY SELECT v_detalle_id, v_carrito_id, p_variante_id, v_cantidad_final;
    RETURN;
  END IF;

  RAISE EXCEPTION 'CART_INSUFFICIENT_STOCK' USING ERRCODE = 'P0001';
END;
$function$;

CREATE OR REPLACE FUNCTION public.generar_sku_variante()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  prefijo TEXT;
  siguiente_num INT;
BEGIN
  IF NEW.sku IS NULL OR NEW.sku = '' THEN

    SELECT UPPER(slug) INTO prefijo
    FROM producto
    WHERE id_producto = NEW.id_producto;

    SELECT COUNT(*) + 1 INTO siguiente_num
    FROM producto_variante
    WHERE id_producto = NEW.id_producto;

    NEW.sku := prefijo || '-' || LPAD(siguiente_num::TEXT, 3, '0');
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.show_db_tree()
 RETURNS TABLE(tree_structure text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- First show all databases
    RETURN QUERY
    SELECT ':file_folder: ' || datname || ' (DATABASE)'
    FROM pg_database
    WHERE datistemplate = false;

    -- Then show current database structure
    RETURN QUERY
    WITH RECURSIVE
    -- Get schemas
    schemas AS (
        SELECT
            n.nspname AS object_name,
            1 AS level,
            n.nspname AS path,
            'SCHEMA' AS object_type
        FROM pg_namespace n
        WHERE n.nspname NOT LIKE 'pg_%'
        AND n.nspname != 'information_schema'
    ),

    -- Get all objects (tables, views, functions, etc.)
    objects AS (
        SELECT
            c.relname AS object_name,
            2 AS level,
            s.path || ' → ' || c.relname AS path,
            CASE c.relkind
                WHEN 'r' THEN 'TABLE'
                WHEN 'v' THEN 'VIEW'
                WHEN 'm' THEN 'MATERIALIZED VIEW'
                WHEN 'i' THEN 'INDEX'
                WHEN 'S' THEN 'SEQUENCE'
                WHEN 'f' THEN 'FOREIGN TABLE'
            END AS object_type
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN schemas s ON n.nspname = s.object_name
        WHERE c.relkind IN ('r','v','m','i','S','f')

        UNION ALL

        SELECT
            p.proname AS object_name,
            2 AS level,
            s.path || ' → ' || p.proname AS path,
            'FUNCTION' AS object_type
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        JOIN schemas s ON n.nspname = s.object_name
    ),

    -- Combine schemas and objects
    combined AS (
        SELECT * FROM schemas
        UNION ALL
        SELECT * FROM objects
    )

    -- Final output with tree-like formatting
    SELECT
        REPEAT('    ', level) ||
        CASE
            WHEN level = 1 THEN '└── :open_file_folder: '
            ELSE '    └── ' ||
                CASE object_type
                    WHEN 'TABLE' THEN ':bar_chart: '
                    WHEN 'VIEW' THEN ':eye: '
                    WHEN 'MATERIALIZED VIEW' THEN ':newspaper: '
                    WHEN 'FUNCTION' THEN ':zap: '
                    WHEN 'INDEX' THEN ':mag: '
                    WHEN 'SEQUENCE' THEN ':1234: '
                    WHEN 'FOREIGN TABLE' THEN ':globe_with_meridians: '
                    ELSE ''
                END
        END || object_name || ' (' || object_type || ')'
    FROM combined
    ORDER BY path;
END;
$function$;

CREATE TRIGGER trg_generar_sku BEFORE INSERT ON public.producto_variante FOR EACH ROW EXECUTE FUNCTION public.generar_sku_variante();
