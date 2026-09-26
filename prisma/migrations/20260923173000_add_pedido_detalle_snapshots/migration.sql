-- AlterTable
ALTER TABLE "pedido_detalle" ADD COLUMN     "nombre_atributo_principal_snapshot" VARCHAR(100),
ADD COLUMN     "nombre_producto_snapshot" VARCHAR(150),
ADD COLUMN     "sku_snapshot" VARCHAR(50),
ADD COLUMN     "valor_atributo_principal_snapshot" VARCHAR(100);

