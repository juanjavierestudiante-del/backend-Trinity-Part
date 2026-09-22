-- CreateTable
CREATE TABLE "carrito" (
    "id_carrito" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carrito_pkey" PRIMARY KEY ("id_carrito")
);

-- CreateTable
CREATE TABLE "carrito_detalle" (
    "id_detalle" SERIAL NOT NULL,
    "id_carrito" INTEGER NOT NULL,
    "id_variante" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "carrito_detalle_pkey" PRIMARY KEY ("id_detalle")
);

-- CreateTable
CREATE TABLE "pedido" (
    "id_pedido" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "estado" VARCHAR(50) NOT NULL DEFAULT 'pendiente',
    "total" DECIMAL(10,2) NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedido_pkey" PRIMARY KEY ("id_pedido")
);

-- CreateTable
CREATE TABLE "pedido_detalle" (
    "id_detalle" SERIAL NOT NULL,
    "id_pedido" INTEGER NOT NULL,
    "id_variante" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "pedido_detalle_pkey" PRIMARY KEY ("id_detalle")
);

-- CreateIndex
CREATE UNIQUE INDEX "carrito_id_usuario_key" ON "carrito"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "carrito_detalle_id_carrito_id_variante_key" ON "carrito_detalle"("id_carrito", "id_variante");

-- CreateIndex
CREATE INDEX "pedido_id_usuario_fecha_creacion_idx" ON "pedido"("id_usuario", "fecha_creacion");

-- AddForeignKey
ALTER TABLE "carrito" ADD CONSTRAINT "carrito_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrito_detalle" ADD CONSTRAINT "carrito_detalle_id_carrito_fkey" FOREIGN KEY ("id_carrito") REFERENCES "carrito"("id_carrito") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrito_detalle" ADD CONSTRAINT "carrito_detalle_id_variante_fkey" FOREIGN KEY ("id_variante") REFERENCES "producto_variante"("id_variante") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_detalle" ADD CONSTRAINT "pedido_detalle_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedido"("id_pedido") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_detalle" ADD CONSTRAINT "pedido_detalle_id_variante_fkey" FOREIGN KEY ("id_variante") REFERENCES "producto_variante"("id_variante") ON DELETE RESTRICT ON UPDATE CASCADE;
