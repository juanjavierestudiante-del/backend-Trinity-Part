-- Modelo aditivo de precios por cantidad. El runtime legacy continúa usando
-- producto_variante.precio_venta/precio_oferta hasta una fase posterior.
CREATE TABLE "regla_precio_cantidad" (
    "id_regla_precio" SERIAL NOT NULL,
    "id_producto" INTEGER,
    "id_variante" INTEGER,
    "nombre" VARCHAR(100) NOT NULL,
    "cantidad_base" INTEGER NOT NULL,
    "precio_total" DECIMAL(10,2) NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regla_precio_cantidad_pkey" PRIMARY KEY ("id_regla_precio")
);

ALTER TABLE "regla_precio_cantidad"
  ADD CONSTRAINT "regla_precio_cantidad_id_producto_fkey"
  FOREIGN KEY ("id_producto") REFERENCES "producto"("id_producto") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "regla_precio_cantidad"
  ADD CONSTRAINT "regla_precio_cantidad_id_variante_fkey"
  FOREIGN KEY ("id_variante") REFERENCES "producto_variante"("id_variante") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "regla_precio_cantidad"
  ADD CONSTRAINT "regla_precio_cantidad_owner_xor_check"
  CHECK (num_nonnulls("id_producto", "id_variante") = 1);

ALTER TABLE "regla_precio_cantidad"
  ADD CONSTRAINT "regla_precio_cantidad_cantidad_base_positive_check"
  CHECK ("cantidad_base" > 0);

ALTER TABLE "regla_precio_cantidad"
  ADD CONSTRAINT "regla_precio_cantidad_precio_total_positive_check"
  CHECK ("precio_total" > 0);

CREATE UNIQUE INDEX "regla_precio_cantidad_producto_cantidad_base_key"
  ON "regla_precio_cantidad"("id_producto", "cantidad_base")
  WHERE "id_producto" IS NOT NULL;

CREATE UNIQUE INDEX "regla_precio_cantidad_variante_cantidad_base_key"
  ON "regla_precio_cantidad"("id_variante", "cantidad_base")
  WHERE "id_variante" IS NOT NULL;

CREATE UNIQUE INDEX "regla_precio_cantidad_producto_principal_activa_key"
  ON "regla_precio_cantidad"("id_producto")
  WHERE "id_producto" IS NOT NULL AND "principal" = true AND "activo" = true;

CREATE UNIQUE INDEX "regla_precio_cantidad_variante_principal_activa_key"
  ON "regla_precio_cantidad"("id_variante")
  WHERE "id_variante" IS NOT NULL AND "principal" = true AND "activo" = true;

CREATE INDEX "regla_precio_cantidad_producto_activo_orden_idx"
  ON "regla_precio_cantidad"("id_producto", "activo", "orden")
  WHERE "id_producto" IS NOT NULL;

CREATE INDEX "regla_precio_cantidad_variante_activo_orden_idx"
  ON "regla_precio_cantidad"("id_variante", "activo", "orden")
  WHERE "id_variante" IS NOT NULL;

-- Sólo se generan reglas generales si todas las presentaciones hermanas
-- coinciden. Fallar evita escoger precio o contenido arbitrariamente.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "producto" p
    INNER JOIN "producto_variante" pv ON pv."id_producto" = p."id_producto"
    GROUP BY p."id_producto"
    HAVING COUNT(DISTINCT pv."cantidad_contenido") <> 1
        OR COUNT(DISTINCT pv."precio_venta") <> 1
  ) THEN
    RAISE EXCEPTION 'PRICE_RULE_BOOTSTRAP_NON_UNIFORM_PRODUCT_VARIANTS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "producto_variante"
    WHERE "cantidad_contenido" <= 0
       OR "cantidad_contenido" <> trunc("cantidad_contenido")
       OR "precio_venta" <= 0
  ) THEN
    RAISE EXCEPTION 'PRICE_RULE_BOOTSTRAP_INVALID_LEGACY_PRESENTATION';
  END IF;
END
$$;

INSERT INTO "regla_precio_cantidad" (
  "id_producto",
  "nombre",
  "cantidad_base",
  "precio_total",
  "principal",
  "activo",
  "orden"
)
SELECT
  pv."id_producto",
  CASE
    WHEN MIN(pv."cantidad_contenido") = 1 THEN 'Unidad'
    ELSE 'Paquete x' || MIN(pv."cantidad_contenido")::integer::text
  END,
  MIN(pv."cantidad_contenido")::integer,
  MIN(pv."precio_venta"),
  true,
  true,
  0
FROM "producto_variante" pv
GROUP BY pv."id_producto";
