CREATE TYPE "MetodoEntrega" AS ENUM ('PUNTO_ENTREGA', 'RECOJO_TIENDA', 'DELIVERY');
CREATE TYPE "TipoPuntoEntrega" AS ENUM ('PUNTO_ENTREGA', 'RECOJO_TIENDA');

CREATE TABLE "punto_entrega" (
  "id_punto_entrega" SERIAL NOT NULL,
  "nombre" VARCHAR(150) NOT NULL,
  "descripcion" TEXT,
  "referencia" VARCHAR(255),
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "tipo" "TipoPuntoEntrega" NOT NULL,
  "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "punto_entrega_pkey" PRIMARY KEY ("id_punto_entrega")
);
CREATE UNIQUE INDEX "punto_entrega_nombre_key" ON "punto_entrega"("nombre");
CREATE INDEX "punto_entrega_activo_tipo_orden_idx" ON "punto_entrega"("activo", "tipo", "orden");

CREATE TABLE "configuracion_entrega" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "delivery_habilitado" BOOLEAN NOT NULL DEFAULT true,
  "monto_minimo_delivery" DECIMAL(10,2) NOT NULL DEFAULT 150,
  "mensaje_delivery" VARCHAR(255),
  "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "configuracion_entrega_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "pedido" ADD COLUMN "metodo_entrega" "MetodoEntrega", ADD COLUMN "id_punto_entrega" INTEGER, ADD COLUMN "punto_entrega_nombre" VARCHAR(150), ADD COLUMN "punto_entrega_referencia" VARCHAR(255), ADD COLUMN "delivery_zona" VARCHAR(150), ADD COLUMN "delivery_direccion" VARCHAR(255), ADD COLUMN "delivery_referencia" VARCHAR(255);
CREATE INDEX "pedido_id_punto_entrega_idx" ON "pedido"("id_punto_entrega");
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_id_punto_entrega_fkey" FOREIGN KEY ("id_punto_entrega") REFERENCES "punto_entrega"("id_punto_entrega") ON DELETE SET NULL ON UPDATE CASCADE;
