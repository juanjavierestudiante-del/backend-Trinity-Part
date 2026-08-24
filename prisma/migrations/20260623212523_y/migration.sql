-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'EMPLEADO');

-- CreateEnum
CREATE TYPE "EstadoGenerico" AS ENUM ('Activo', 'Inactivo');

-- CreateEnum
CREATE TYPE "EstadoProducto" AS ENUM ('Borrador', 'Activo', 'Inactivo', 'Descontinuado');

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" SERIAL NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'ADMIN',
    "estado" "EstadoGenerico" NOT NULL DEFAULT 'Activo',
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
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

    CONSTRAINT "atributo_pkey" PRIMARY KEY ("id_atributo")
);

-- CreateTable
CREATE TABLE "valor_atributo" (
    "id_valor" SERIAL NOT NULL,
    "id_atributo" INTEGER NOT NULL,
    "valor" VARCHAR(100) NOT NULL,

    CONSTRAINT "valor_atributo_pkey" PRIMARY KEY ("id_valor")
);

-- CreateTable
CREATE TABLE "producto" (
    "id_producto" SERIAL NOT NULL,
    "id_categoria" INTEGER NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "descripcion_corta" VARCHAR(255),
    "descripcion" TEXT,
    "destacado" BOOLEAN NOT NULL DEFAULT false,
    "meta_titulo" VARCHAR(160),
    "meta_descripcion" VARCHAR(255),
    "estado" "EstadoProducto" NOT NULL DEFAULT 'Borrador',
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,
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
    "cantidad_contenido" DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    "sku" VARCHAR(50) NOT NULL,
    "codigo_barras" VARCHAR(100),
    "precio_venta" DECIMAL(10,2) NOT NULL,
    "precio_oferta" DECIMAL(10,2),
    "peso" DECIMAL(10,2),
    "estado" "EstadoGenerico" NOT NULL DEFAULT 'Activo',

    CONSTRAINT "producto_variante_pkey" PRIMARY KEY ("id_variante")
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

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

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
CREATE UNIQUE INDEX "producto_variante_sku_key" ON "producto_variante"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "producto_variante_codigo_barras_key" ON "producto_variante"("codigo_barras");

-- CreateIndex
CREATE UNIQUE INDEX "inventario_id_variante_key" ON "inventario"("id_variante");

-- AddForeignKey
ALTER TABLE "categoria" ADD CONSTRAINT "categoria_id_categoria_padre_fkey" FOREIGN KEY ("id_categoria_padre") REFERENCES "categoria"("id_categoria") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valor_atributo" ADD CONSTRAINT "valor_atributo_id_atributo_fkey" FOREIGN KEY ("id_atributo") REFERENCES "atributo"("id_atributo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categoria"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imagen_producto" ADD CONSTRAINT "imagen_producto_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "producto"("id_producto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_variante" ADD CONSTRAINT "producto_variante_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "producto"("id_producto") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_variante" ADD CONSTRAINT "producto_variante_id_marca_fkey" FOREIGN KEY ("id_marca") REFERENCES "marca"("id_marca") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_variante" ADD CONSTRAINT "producto_variante_id_unidad_fkey" FOREIGN KEY ("id_unidad") REFERENCES "unidad_medida"("id_unidad") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imagen_variante" ADD CONSTRAINT "imagen_variante_id_variante_fkey" FOREIGN KEY ("id_variante") REFERENCES "producto_variante"("id_variante") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_id_variante_fkey" FOREIGN KEY ("id_variante") REFERENCES "producto_variante"("id_variante") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variante_atributo" ADD CONSTRAINT "variante_atributo_id_variante_fkey" FOREIGN KEY ("id_variante") REFERENCES "producto_variante"("id_variante") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variante_atributo" ADD CONSTRAINT "variante_atributo_id_valor_fkey" FOREIGN KEY ("id_valor") REFERENCES "valor_atributo"("id_valor") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variante_proveedor" ADD CONSTRAINT "variante_proveedor_id_variante_fkey" FOREIGN KEY ("id_variante") REFERENCES "producto_variante"("id_variante") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variante_proveedor" ADD CONSTRAINT "variante_proveedor_id_proveedor_fkey" FOREIGN KEY ("id_proveedor") REFERENCES "proveedor"("id_proveedor") ON DELETE CASCADE ON UPDATE CASCADE;
