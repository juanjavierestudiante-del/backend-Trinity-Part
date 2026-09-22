-- Las vistas y funciones PostgreSQL se verificaron antes de este cambio y no
-- dependen de producto_variante.precio_venta ni producto_variante.precio_oferta.
ALTER TABLE "producto_variante"
  DROP COLUMN "precio_venta",
  DROP COLUMN "precio_oferta";
