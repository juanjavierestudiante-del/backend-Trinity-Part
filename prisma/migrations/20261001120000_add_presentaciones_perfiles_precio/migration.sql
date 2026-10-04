-- AlterTable
ALTER TABLE "producto_variante" ADD COLUMN     "id_perfil_precio" INTEGER;

-- AlterTable
ALTER TABLE "lista_precio" ADD COLUMN     "id_perfil_precio" INTEGER,
ADD COLUMN     "id_presentacion" INTEGER;

-- CreateTable
CREATE TABLE "presentacion_venta" (
    "id_presentacion" SERIAL NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "cantidad_base" INTEGER NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presentacion_venta_pkey" PRIMARY KEY ("id_presentacion")
);

-- CreateTable
CREATE TABLE "perfil_precio" (
    "id_perfil_precio" SERIAL NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perfil_precio_pkey" PRIMARY KEY ("id_perfil_precio")
);

-- CreateIndex
CREATE INDEX "presentacion_venta_id_producto_activo_orden_idx" ON "presentacion_venta"("id_producto", "activo", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "presentacion_venta_id_producto_nombre_key" ON "presentacion_venta"("id_producto", "nombre");

-- CreateIndex
CREATE INDEX "perfil_precio_id_producto_activo_orden_idx" ON "perfil_precio"("id_producto", "activo", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "perfil_precio_id_producto_nombre_key" ON "perfil_precio"("id_producto", "nombre");

-- CreateIndex
CREATE INDEX "producto_variante_id_perfil_precio_idx" ON "producto_variante"("id_perfil_precio");

-- CreateIndex
CREATE INDEX "lista_precio_id_presentacion_idx" ON "lista_precio"("id_presentacion");

-- CreateIndex
CREATE INDEX "lista_precio_id_perfil_precio_idx" ON "lista_precio"("id_perfil_precio");

-- AddForeignKey
ALTER TABLE "producto_variante" ADD CONSTRAINT "producto_variante_id_perfil_precio_fkey" FOREIGN KEY ("id_perfil_precio") REFERENCES "perfil_precio"("id_perfil_precio") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentacion_venta" ADD CONSTRAINT "presentacion_venta_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "producto"("id_producto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil_precio" ADD CONSTRAINT "perfil_precio_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "producto"("id_producto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lista_precio" ADD CONSTRAINT "lista_precio_id_presentacion_fkey" FOREIGN KEY ("id_presentacion") REFERENCES "presentacion_venta"("id_presentacion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lista_precio" ADD CONSTRAINT "lista_precio_id_perfil_precio_fkey" FOREIGN KEY ("id_perfil_precio") REFERENCES "perfil_precio"("id_perfil_precio") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restricciones PostgreSQL que Prisma 5 no representa en el schema.
ALTER TABLE "presentacion_venta"
ADD CONSTRAINT "presentacion_venta_cantidad_base_positive_check"
CHECK ("cantidad_base" > 0);

CREATE UNIQUE INDEX "presentacion_venta_producto_principal_activa_key"
ON "presentacion_venta"("id_producto")
WHERE "principal" = true AND "activo" = true;

CREATE UNIQUE INDEX "perfil_precio_producto_principal_activo_key"
ON "perfil_precio"("id_producto")
WHERE "principal" = true AND "activo" = true;

-- Las listas legacy con alguna FK nueva null quedan fuera de esta restricción.
CREATE UNIQUE INDEX "lista_precio_producto_presentacion_perfil_activa_key"
ON "lista_precio"("id_producto", "id_presentacion", "id_perfil_precio")
WHERE "activo" = true
  AND "id_presentacion" IS NOT NULL
  AND "id_perfil_precio" IS NOT NULL;
