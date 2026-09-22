-- El carrito cuenta presentaciones y su límite comercial ya no es 100.
-- El límite autoritativo es el stock disponible de cada variante.
CREATE OR REPLACE FUNCTION agregar_item_carrito(
  p_usuario_id INTEGER,
  p_variante_id INTEGER,
  p_cantidad INTEGER
)
RETURNS TABLE (
  "idDetalle" INTEGER,
  "idCarrito" INTEGER,
  "idVariante" INTEGER,
  cantidad INTEGER
)
LANGUAGE plpgsql
AS $$
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
$$;
