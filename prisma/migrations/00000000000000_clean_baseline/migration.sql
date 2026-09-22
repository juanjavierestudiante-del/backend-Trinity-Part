-- CreateEnum
CREATE TYPE "ProveedorAuth" AS ENUM ('LOCAL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'EMPLEADO', 'CLIENTE');

-- CreateEnum
CREATE TYPE "EstadoGenerico" AS ENUM ('Activo', 'Inactivo');

-- CreateEnum
CREATE TYPE "TipoVisualizacionAtributo" AS ENUM ('text', 'color', 'image');

-- CreateEnum
CREATE TYPE "EstadoProducto" AS ENUM ('Borrador', 'Activo', 'Inactivo', 'Descontinuado');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('Entrada', 'Salida', 'Ajuste');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "MetodoEntrega" AS ENUM ('PUNTO_ENTREGA', 'RECOJO_TIENDA', 'DELIVERY');

-- CreateEnum
CREATE TYPE "TipoPuntoEntrega" AS ENUM ('PUNTO_ENTREGA', 'RECOJO_TIENDA');

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" SERIAL NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "apellido" VARCHAR(150),
    "email" VARCHAR(150) NOT NULL,
    "telefono" VARCHAR(20),
    "password" VARCHAR(255),
    "avatar_url" VARCHAR(500),
    "rol" "RolUsuario" NOT NULL DEFAULT 'ADMIN',
    "estado" "EstadoGenerico" NOT NULL DEFAULT 'Activo',
    "email_verificado" BOOLEAN NOT NULL DEFAULT false,
    "telefono_verificado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "auth_account" (
    "id_auth_account" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "provider" "ProveedorAuth" NOT NULL,
    "provider_user_id" VARCHAR(255) NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_account_pkey" PRIMARY KEY ("id_auth_account")
);

-- CreateTable
CREATE TABLE "categoria" (
    "id_categoria" SERIAL NOT NULL,
    "id_categoria_padre" INTEGER,
    "nombre" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "imagen_public_id" VARCHAR(255),
    "imagen_url" VARCHAR(500),
    "orden" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoGenerico" NOT NULL DEFAULT 'Activo',

    CONSTRAINT "categoria_pkey" PRIMARY KEY ("id_categoria")
);

-- CreateTable
CREATE TABLE "marca" (
    "id_marca" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,

    CONSTRAINT "marca_pkey" PRIMARY KEY ("id_marca")
);

-- CreateTable
CREATE TABLE "unidad_medida" (
    "id_unidad" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "abreviatura" VARCHAR(10) NOT NULL,

    CONSTRAINT "unidad_medida_pkey" PRIMARY KEY ("id_unidad")
);

-- CreateTable
CREATE TABLE "proveedor" (
    "id_proveedor" SERIAL NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "telefono" VARCHAR(20),
    "correo" VARCHAR(150),

    CONSTRAINT "proveedor_pkey" PRIMARY KEY ("id_proveedor")
);

-- CreateTable
CREATE TABLE "atributo" (
    "id_atributo" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "tipo_visualizacion" "TipoVisualizacionAtributo" NOT NULL DEFAULT 'text',

    CONSTRAINT "atributo_pkey" PRIMARY KEY ("id_atributo")
);

-- CreateTable
CREATE TABLE "valor_atributo" (
    "id_valor" SERIAL NOT NULL,
    "id_atributo" INTEGER NOT NULL,
    "valor" VARCHAR(100) NOT NULL,
    "visual_value" VARCHAR(255),

    CONSTRAINT "valor_atributo_pkey" PRIMARY KEY ("id_valor")
);

-- CreateTable
CREATE TABLE "producto" (
    "id_producto" SERIAL NOT NULL,
    "id_categoria" INTEGER NOT NULL,
    "id_atributo_principal" INTEGER,
    "nombre" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "rating" DECIMAL(2,1) NOT NULL DEFAULT 4.0,
    "descripcion_corta" VARCHAR(255),
    "descripcion" TEXT,
    "destacado" BOOLEAN NOT NULL DEFAULT false,
    "meta_titulo" VARCHAR(160),
    "meta_descripcion" VARCHAR(255),
    "estado" "EstadoProducto" NOT NULL DEFAULT 'Borrador',
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_publicacion" TIMESTAMP(3),

    CONSTRAINT "producto_pkey" PRIMARY KEY ("id_producto")
);

-- CreateTable
CREATE TABLE "imagen_producto" (
    "id_imagen" SERIAL NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "public_id" VARCHAR(255) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "orden_imagen" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "imagen_producto_pkey" PRIMARY KEY ("id_imagen")
);

-- CreateTable
CREATE TABLE "producto_variante" (
    "id_variante" SERIAL NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "id_marca" INTEGER,
    "id_unidad" INTEGER,
    "id_lista_precio" INTEGER,
    "cantidad_contenido" DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    "sku" VARCHAR(50) NOT NULL,
    "codigo_barras" VARCHAR(100),
    "peso" DECIMAL(10,2),
    "estado" "EstadoGenerico" NOT NULL DEFAULT 'Activo',

    CONSTRAINT "producto_variante_pkey" PRIMARY KEY ("id_variante")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "regla_precio_cantidad" (
    "id_regla_precio" SERIAL NOT NULL,
    "id_lista_precio" INTEGER NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "cantidad_minima" INTEGER NOT NULL,
    "precio_por_presentacion" DECIMAL(10,2) NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regla_precio_cantidad_pkey" PRIMARY KEY ("id_regla_precio")
);

-- CreateTable
CREATE TABLE "imagen_variante" (
    "id_imagen" SERIAL NOT NULL,
    "id_variante" INTEGER NOT NULL,
    "public_id" VARCHAR(255) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "orden_imagen" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "imagen_variante_pkey" PRIMARY KEY ("id_imagen")
);

-- CreateTable
CREATE TABLE "inventario" (
    "id_inventario" SERIAL NOT NULL,
    "id_variante" INTEGER NOT NULL,
    "stock_actual" INTEGER NOT NULL DEFAULT 0,
    "stock_minimo" INTEGER NOT NULL DEFAULT 0,
    "stock_maximo" INTEGER,

    CONSTRAINT "inventario_pkey" PRIMARY KEY ("id_inventario")
);

-- CreateTable
CREATE TABLE "movimiento_inventario" (
    "id_movimiento" SERIAL NOT NULL,
    "id_variante" INTEGER NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stock_anterior" INTEGER NOT NULL,
    "stock_nuevo" INTEGER NOT NULL,
    "motivo" VARCHAR(255),
    "id_usuario" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_inventario_pkey" PRIMARY KEY ("id_movimiento")
);

-- CreateTable
CREATE TABLE "variante_atributo" (
    "id_variante" INTEGER NOT NULL,
    "id_valor" INTEGER NOT NULL,

    CONSTRAINT "variante_atributo_pkey" PRIMARY KEY ("id_variante","id_valor")
);

-- CreateTable
CREATE TABLE "variante_proveedor" (
    "id_variante" INTEGER NOT NULL,
    "id_proveedor" INTEGER NOT NULL,
    "precio_compra" DECIMAL(10,2),

    CONSTRAINT "variante_proveedor_pkey" PRIMARY KEY ("id_variante","id_proveedor")
);

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

-- CreateTable
CREATE TABLE "configuracion_entrega" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "delivery_habilitado" BOOLEAN NOT NULL DEFAULT true,
    "monto_minimo_delivery" DECIMAL(10,2) NOT NULL DEFAULT 150,
    "mensaje_delivery" VARCHAR(255),
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracion_entrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido" (
    "id_pedido" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'PENDIENTE',
    "total" DECIMAL(10,2) NOT NULL,
    "nombre_contacto" VARCHAR(150) NOT NULL,
    "telefono_contacto" VARCHAR(50) NOT NULL,
    "direccion_entrega" VARCHAR(255),
    "metodo_entrega" "MetodoEntrega",
    "id_punto_entrega" INTEGER,
    "punto_entrega_nombre" VARCHAR(150),
    "punto_entrega_referencia" VARCHAR(255),
    "delivery_zona" VARCHAR(150),
    "delivery_direccion" VARCHAR(255),
    "delivery_referencia" VARCHAR(255),
    "notas" TEXT,
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
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_telefono_key" ON "usuario"("telefono");

-- CreateIndex
CREATE INDEX "auth_account_id_usuario_idx" ON "auth_account"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "auth_account_provider_provider_user_id_key" ON "auth_account"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_nombre_key" ON "categoria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_slug_key" ON "categoria"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "marca_nombre_key" ON "marca"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "atributo_nombre_key" ON "atributo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "producto_slug_key" ON "producto"("slug");

-- CreateIndex
CREATE INDEX "producto_id_categoria_idx" ON "producto"("id_categoria");

-- CreateIndex
CREATE INDEX "producto_id_atributo_principal_idx" ON "producto"("id_atributo_principal");

-- CreateIndex
CREATE UNIQUE INDEX "producto_variante_sku_key" ON "producto_variante"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "producto_variante_codigo_barras_key" ON "producto_variante"("codigo_barras");

-- CreateIndex
CREATE INDEX "producto_variante_id_producto_idx" ON "producto_variante"("id_producto");

-- CreateIndex
CREATE INDEX "producto_variante_id_lista_precio_idx" ON "producto_variante"("id_lista_precio");

-- CreateIndex
CREATE INDEX "lista_precio_id_producto_activo_idx" ON "lista_precio"("id_producto", "activo");

-- CreateIndex
CREATE INDEX "regla_precio_cantidad_id_lista_precio_activo_orden_idx" ON "regla_precio_cantidad"("id_lista_precio", "activo", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "inventario_id_variante_key" ON "inventario"("id_variante");

-- CreateIndex
CREATE INDEX "movimiento_inventario_id_variante_fecha_idx" ON "movimiento_inventario"("id_variante", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "carrito_id_usuario_key" ON "carrito"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "carrito_detalle_id_carrito_id_variante_key" ON "carrito_detalle"("id_carrito", "id_variante");

-- CreateIndex
CREATE UNIQUE INDEX "punto_entrega_nombre_key" ON "punto_entrega"("nombre");

-- CreateIndex
CREATE INDEX "punto_entrega_activo_tipo_orden_idx" ON "punto_entrega"("activo", "tipo", "orden");

-- CreateIndex
CREATE INDEX "pedido_id_usuario_fecha_creacion_idx" ON "pedido"("id_usuario", "fecha_creacion");

-- CreateIndex
CREATE INDEX "pedido_id_punto_entrega_idx" ON "pedido"("id_punto_entrega");

-- AddForeignKey
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categoria" ADD CONSTRAINT "categoria_id_categoria_padre_fkey" FOREIGN KEY ("id_categoria_padre") REFERENCES "categoria"("id_categoria") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valor_atributo" ADD CONSTRAINT "valor_atributo_id_atributo_fkey" FOREIGN KEY ("id_atributo") REFERENCES "atributo"("id_atributo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categoria"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_id_atributo_principal_fkey" FOREIGN KEY ("id_atributo_principal") REFERENCES "atributo"("id_atributo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imagen_producto" ADD CONSTRAINT "imagen_producto_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "producto"("id_producto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_variante" ADD CONSTRAINT "producto_variante_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "producto"("id_producto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_variante" ADD CONSTRAINT "producto_variante_id_marca_fkey" FOREIGN KEY ("id_marca") REFERENCES "marca"("id_marca") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_variante" ADD CONSTRAINT "producto_variante_id_unidad_fkey" FOREIGN KEY ("id_unidad") REFERENCES "unidad_medida"("id_unidad") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_variante" ADD CONSTRAINT "producto_variante_id_lista_precio_fkey" FOREIGN KEY ("id_lista_precio") REFERENCES "lista_precio"("id_lista_precio") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lista_precio" ADD CONSTRAINT "lista_precio_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "producto"("id_producto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regla_precio_cantidad" ADD CONSTRAINT "regla_precio_cantidad_id_lista_precio_fkey" FOREIGN KEY ("id_lista_precio") REFERENCES "lista_precio"("id_lista_precio") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imagen_variante" ADD CONSTRAINT "imagen_variante_id_variante_fkey" FOREIGN KEY ("id_variante") REFERENCES "producto_variante"("id_variante") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_id_variante_fkey" FOREIGN KEY ("id_variante") REFERENCES "producto_variante"("id_variante") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_id_variante_fkey" FOREIGN KEY ("id_variante") REFERENCES "producto_variante"("id_variante") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variante_atributo" ADD CONSTRAINT "variante_atributo_id_variante_fkey" FOREIGN KEY ("id_variante") REFERENCES "producto_variante"("id_variante") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variante_atributo" ADD CONSTRAINT "variante_atributo_id_valor_fkey" FOREIGN KEY ("id_valor") REFERENCES "valor_atributo"("id_valor") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variante_proveedor" ADD CONSTRAINT "variante_proveedor_id_variante_fkey" FOREIGN KEY ("id_variante") REFERENCES "producto_variante"("id_variante") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variante_proveedor" ADD CONSTRAINT "variante_proveedor_id_proveedor_fkey" FOREIGN KEY ("id_proveedor") REFERENCES "proveedor"("id_proveedor") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrito" ADD CONSTRAINT "carrito_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrito_detalle" ADD CONSTRAINT "carrito_detalle_id_carrito_fkey" FOREIGN KEY ("id_carrito") REFERENCES "carrito"("id_carrito") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrito_detalle" ADD CONSTRAINT "carrito_detalle_id_variante_fkey" FOREIGN KEY ("id_variante") REFERENCES "producto_variante"("id_variante") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_id_punto_entrega_fkey" FOREIGN KEY ("id_punto_entrega") REFERENCES "punto_entrega"("id_punto_entrega") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_detalle" ADD CONSTRAINT "pedido_detalle_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedido"("id_pedido") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_detalle" ADD CONSTRAINT "pedido_detalle_id_variante_fkey" FOREIGN KEY ("id_variante") REFERENCES "producto_variante"("id_variante") ON DELETE RESTRICT ON UPDATE CASCADE;
