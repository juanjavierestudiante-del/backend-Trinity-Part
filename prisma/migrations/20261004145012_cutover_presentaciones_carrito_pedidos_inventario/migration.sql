-- Cutover coordinado. Solo se descartan datos operativos de prueba autorizados.
BEGIN;
DELETE FROM "movimiento_inventario";
DELETE FROM "carrito_detalle";
DELETE FROM "carrito";
DELETE FROM "pedido_detalle";
DELETE FROM "pedido";
DELETE FROM "inventario";

ALTER TABLE "carrito_detalle" ADD COLUMN "id_presentacion" INTEGER NOT NULL;
DROP INDEX "carrito_detalle_id_carrito_id_variante_key";
CREATE UNIQUE INDEX "carrito_detalle_id_carrito_id_variante_id_presentacion_key" ON "carrito_detalle"("id_carrito","id_variante","id_presentacion");
CREATE INDEX "carrito_detalle_id_variante_idx" ON "carrito_detalle"("id_variante");
CREATE INDEX "carrito_detalle_id_presentacion_idx" ON "carrito_detalle"("id_presentacion");
ALTER TABLE "carrito_detalle" ADD CONSTRAINT "carrito_detalle_id_presentacion_fkey" FOREIGN KEY("id_presentacion") REFERENCES "presentacion_venta"("id_presentacion") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "carrito_detalle" ADD CONSTRAINT "carrito_detalle_cantidad_positive_check" CHECK (cantidad > 0);

ALTER TABLE "pedido_detalle" ADD COLUMN "id_presentacion" INTEGER,
 ADD COLUMN "presentacion_nombre" VARCHAR(100) NOT NULL,
 ADD COLUMN "cantidad_base_presentacion" INTEGER NOT NULL;
CREATE INDEX "pedido_detalle_id_presentacion_idx" ON "pedido_detalle"("id_presentacion");
ALTER TABLE "pedido_detalle" ADD CONSTRAINT "pedido_detalle_id_presentacion_fkey" FOREIGN KEY("id_presentacion") REFERENCES "presentacion_venta"("id_presentacion") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pedido_detalle" ADD CONSTRAINT "pedido_detalle_cantidad_base_positive_check" CHECK (cantidad_base_presentacion > 0);
ALTER TABLE "pedido_detalle" ADD CONSTRAINT "pedido_detalle_cantidad_positive_check" CHECK (cantidad > 0);
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_stock_actual_nonnegative_check" CHECK (stock_actual >= 0);
INSERT INTO "inventario" ("id_variante") SELECT "id_variante" FROM "producto_variante" ORDER BY "id_variante";

-- Retirar únicamente la firma obsoleta, nunca tablas/datos prioritarios.
DROP FUNCTION public.agregar_item_carrito(integer,integer,integer);
CREATE FUNCTION public.agregar_item_carrito(p_usuario_id integer,p_variante_id integer,p_presentacion_id integer,p_cantidad integer)
RETURNS TABLE("idDetalle" integer,"idCarrito" integer,"idVariante" integer,"idPresentacion" integer,cantidad integer)
LANGUAGE plpgsql AS $function$
DECLARE
 v_carrito_id integer; v_stock integer; v_base integer; v_consumo bigint;
 v_detalle_id integer; v_cantidad_final integer;
BEGIN
 IF p_cantidad IS NULL OR p_cantidad < 1 THEN RAISE EXCEPTION 'CART_INVALID_QUANTITY' USING ERRCODE='P0001'; END IF;
 INSERT INTO carrito(id_usuario) VALUES(p_usuario_id)
 ON CONFLICT(id_usuario) DO UPDATE SET id_usuario=EXCLUDED.id_usuario
 RETURNING id_carrito INTO v_carrito_id;
 -- El upsert bloquea la fila del carrito; altas/update/checkout comparten ese lock.
 SELECT COALESCE(i.stock_actual,0),pres.cantidad_base INTO v_stock,v_base
 FROM producto_variante v JOIN producto p ON p.id_producto=v.id_producto
 JOIN presentacion_venta pres ON pres.id_presentacion=p_presentacion_id AND pres.id_producto=v.id_producto AND pres.activo
 LEFT JOIN inventario i ON i.id_variante=v.id_variante
 WHERE v.id_variante=p_variante_id AND v.estado='Activo' AND p.estado='Activo';
 IF NOT FOUND THEN RAISE EXCEPTION 'CART_VARIANT_NOT_AVAILABLE' USING ERRCODE='P0001'; END IF;
 SELECT COALESCE(SUM(cd.cantidad::bigint*pres.cantidad_base),0) INTO v_consumo
 FROM carrito_detalle cd JOIN presentacion_venta pres ON pres.id_presentacion=cd.id_presentacion
 WHERE cd.id_carrito=v_carrito_id AND cd.id_variante=p_variante_id;
 IF v_consumo+p_cantidad::bigint*v_base > v_stock THEN RAISE EXCEPTION 'CART_INSUFFICIENT_STOCK' USING ERRCODE='P0001'; END IF;
 INSERT INTO carrito_detalle(id_carrito,id_variante,id_presentacion,cantidad)
 VALUES(v_carrito_id,p_variante_id,p_presentacion_id,p_cantidad)
 ON CONFLICT(id_carrito,id_variante,id_presentacion) DO UPDATE SET cantidad=carrito_detalle.cantidad+EXCLUDED.cantidad
 RETURNING carrito_detalle.id_detalle,carrito_detalle.cantidad INTO v_detalle_id,v_cantidad_final;
 RETURN QUERY SELECT v_detalle_id,v_carrito_id,p_variante_id,p_presentacion_id,v_cantidad_final;
END;
$function$;
COMMIT;
