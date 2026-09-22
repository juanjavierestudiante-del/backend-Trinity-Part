-- PC-3.2: las reglas pasan de bloques por owner a umbrales de una lista.
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "regla_precio_cantidad") <> 6
     OR EXISTS (SELECT 1 FROM "regla_precio_cantidad" WHERE "id_variante" IS NOT NULL)
  THEN
    RAISE EXCEPTION 'PRICE_LIST_MIGRATION_AMBIGUOUS_SOURCE_RULES';
  END IF;
END
$$;

CREATE TABLE "lista_precio" (
  "id_lista_precio" SERIAL NOT NULL,
  "id_producto" INTEGER NOT NULL,
  "nombre" VARCHAR(100) NOT NULL,
  "principal" BOOLEAN NOT NULL DEFAULT false,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lista_precio_pkey" PRIMARY KEY ("id_lista_precio")
);

ALTER TABLE "lista_precio"
  ADD CONSTRAINT "lista_precio_id_producto_fkey"
  FOREIGN KEY ("id_producto") REFERENCES "producto"("id_producto") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "lista_precio" ("id_producto", "nombre", "principal", "activo")
SELECT "id_producto", 'Principal', true, true
FROM "regla_precio_cantidad"
GROUP BY "id_producto";

ALTER TABLE "producto_variante" ADD COLUMN "id_lista_precio" INTEGER;
ALTER TABLE "regla_precio_cantidad" ADD COLUMN "id_lista_precio" INTEGER;

UPDATE "regla_precio_cantidad" rpc
SET "id_lista_precio" = lp."id_lista_precio"
FROM "lista_precio" lp
WHERE lp."id_producto" = rpc."id_producto";

ALTER TABLE "regla_precio_cantidad" RENAME COLUMN "cantidad_base" TO "cantidad_minima";
ALTER TABLE "regla_precio_cantidad" RENAME COLUMN "precio_total" TO "precio_por_presentacion";

DROP INDEX "regla_precio_cantidad_producto_cantidad_base_key";
DROP INDEX "regla_precio_cantidad_variante_cantidad_base_key";
DROP INDEX "regla_precio_cantidad_producto_principal_activa_key";
DROP INDEX "regla_precio_cantidad_variante_principal_activa_key";
DROP INDEX "regla_precio_cantidad_producto_activo_orden_idx";
DROP INDEX "regla_precio_cantidad_variante_activo_orden_idx";

ALTER TABLE "regla_precio_cantidad" DROP CONSTRAINT "regla_precio_cantidad_owner_xor_check";
ALTER TABLE "regla_precio_cantidad" DROP CONSTRAINT "regla_precio_cantidad_id_producto_fkey";
ALTER TABLE "regla_precio_cantidad" DROP CONSTRAINT "regla_precio_cantidad_id_variante_fkey";
ALTER TABLE "regla_precio_cantidad" DROP CONSTRAINT "regla_precio_cantidad_cantidad_base_positive_check";
ALTER TABLE "regla_precio_cantidad" DROP CONSTRAINT "regla_precio_cantidad_precio_total_positive_check";

ALTER TABLE "regla_precio_cantidad" DROP COLUMN "id_producto";
ALTER TABLE "regla_precio_cantidad" DROP COLUMN "id_variante";
ALTER TABLE "regla_precio_cantidad" ALTER COLUMN "id_lista_precio" SET NOT NULL;

ALTER TABLE "regla_precio_cantidad"
  ADD CONSTRAINT "regla_precio_cantidad_id_lista_precio_fkey"
  FOREIGN KEY ("id_lista_precio") REFERENCES "lista_precio"("id_lista_precio") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "producto_variante"
  ADD CONSTRAINT "producto_variante_id_lista_precio_fkey"
  FOREIGN KEY ("id_lista_precio") REFERENCES "lista_precio"("id_lista_precio") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "regla_precio_cantidad"
  ADD CONSTRAINT "regla_precio_cantidad_cantidad_minima_positive_check" CHECK ("cantidad_minima" > 0);
ALTER TABLE "regla_precio_cantidad"
  ADD CONSTRAINT "regla_precio_cantidad_precio_por_presentacion_positive_check" CHECK ("precio_por_presentacion" > 0);

CREATE UNIQUE INDEX "lista_precio_producto_principal_activa_key"
  ON "lista_precio"("id_producto") WHERE "principal" = true AND "activo" = true;
CREATE UNIQUE INDEX "regla_precio_cantidad_lista_cantidad_minima_key"
  ON "regla_precio_cantidad"("id_lista_precio", "cantidad_minima");
CREATE UNIQUE INDEX "regla_precio_cantidad_lista_principal_activa_key"
  ON "regla_precio_cantidad"("id_lista_precio") WHERE "principal" = true AND "activo" = true;
CREATE INDEX "lista_precio_producto_activo_idx" ON "lista_precio"("id_producto", "activo");
CREATE INDEX "regla_precio_cantidad_lista_activo_orden_idx"
  ON "regla_precio_cantidad"("id_lista_precio", "activo", "orden");
CREATE INDEX "producto_variante_id_lista_precio_idx" ON "producto_variante"("id_lista_precio");
