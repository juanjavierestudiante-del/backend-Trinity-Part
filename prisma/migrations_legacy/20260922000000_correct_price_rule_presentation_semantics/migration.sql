-- Corrección PC-3.1: cantidad_base cuenta presentaciones vendibles,
-- no las unidades físicas contenidas en cada presentación.
--
-- La actualización es deliberadamente estricta. Solo corrige una regla
-- general si todavía coincide exactamente con el bootstrap de PC-1:
-- una única regla general, sin reglas de variante, con nombre/precio/base
-- derivados de la presentación legacy uniforme. Si el administrador ya
-- modificó o amplió ese conjunto, la migración falla para evitar alterar
-- configuración posterior de forma silenciosa.
DO $$
DECLARE
  candidatos INTEGER;
  corregidos INTEGER;
BEGIN
  SELECT COUNT(*) INTO candidatos
  FROM (
    SELECT p."id_producto"
    FROM "producto" p
    JOIN "producto_variante" pv ON pv."id_producto" = p."id_producto"
    JOIN "regla_precio_cantidad" rpc ON rpc."id_producto" = p."id_producto"
    LEFT JOIN "regla_precio_cantidad" rpc_all ON rpc_all."id_producto" = p."id_producto"
    LEFT JOIN "regla_precio_cantidad" rv ON rv."id_variante" = pv."id_variante"
    WHERE rpc."id_variante" IS NULL
    GROUP BY p."id_producto", rpc."id_regla_precio", rpc."nombre", rpc."cantidad_base", rpc."precio_total"
    HAVING COUNT(DISTINCT pv."cantidad_contenido") = 1
       AND COUNT(DISTINCT pv."precio_venta") = 1
       AND COUNT(DISTINCT rpc_all."id_regla_precio") = 1
       AND COUNT(DISTINCT rv."id_regla_precio") = 0
       AND rpc."nombre" = CASE
         WHEN MIN(pv."cantidad_contenido") = 1 THEN 'Unidad'
         ELSE 'Paquete x' || MIN(pv."cantidad_contenido")::integer::text
       END
       AND rpc."cantidad_base" = MIN(pv."cantidad_contenido")::integer
       AND rpc."precio_total" = MIN(pv."precio_venta")
  ) bootstrap;

  IF candidatos <> 6 THEN
    RAISE EXCEPTION
      'PRICE_RULE_PRESENTATION_SEMANTICS_AMBIGUOUS: expected 6 untouched bootstrap rules, found %',
      candidatos;
  END IF;

  UPDATE "regla_precio_cantidad" rpc
  SET "cantidad_base" = 1,
      "fecha_actualizacion" = CURRENT_TIMESTAMP
  FROM (
    SELECT rpc2."id_regla_precio"
    FROM "regla_precio_cantidad" rpc2
    JOIN "producto_variante" pv ON pv."id_producto" = rpc2."id_producto"
    LEFT JOIN "regla_precio_cantidad" rpc_all ON rpc_all."id_producto" = rpc2."id_producto"
    LEFT JOIN "regla_precio_cantidad" rv ON rv."id_variante" = pv."id_variante"
    WHERE rpc2."id_producto" IS NOT NULL
      AND rpc2."id_variante" IS NULL
    GROUP BY rpc2."id_regla_precio", rpc2."nombre", rpc2."cantidad_base", rpc2."precio_total"
    HAVING COUNT(DISTINCT pv."cantidad_contenido") = 1
       AND COUNT(DISTINCT pv."precio_venta") = 1
       AND COUNT(DISTINCT rpc_all."id_regla_precio") = 1
       AND COUNT(DISTINCT rv."id_regla_precio") = 0
       AND rpc2."nombre" = CASE
         WHEN MIN(pv."cantidad_contenido") = 1 THEN 'Unidad'
         ELSE 'Paquete x' || MIN(pv."cantidad_contenido")::integer::text
       END
       AND rpc2."cantidad_base" = MIN(pv."cantidad_contenido")::integer
       AND rpc2."precio_total" = MIN(pv."precio_venta")
  ) bootstrap
  WHERE rpc."id_regla_precio" = bootstrap."id_regla_precio";

  GET DIAGNOSTICS corregidos = ROW_COUNT;
  IF corregidos <> 6 THEN
    RAISE EXCEPTION 'PRICE_RULE_PRESENTATION_SEMANTICS_UPDATE_INCOMPLETE: updated % of 6', corregidos;
  END IF;
END
$$;
