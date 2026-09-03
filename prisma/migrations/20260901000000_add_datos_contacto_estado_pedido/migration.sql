-- AlterTable
-- Columnas de contacto/entrega. Se agregan nullable para poder hacer backfill
-- de los pedidos existentes antes de imponer NOT NULL.
ALTER TABLE "pedido" ADD COLUMN "nombre_contacto" VARCHAR(150);
ALTER TABLE "pedido" ADD COLUMN "telefono_contacto" VARCHAR(50);
ALTER TABLE "pedido" ADD COLUMN "direccion_entrega" VARCHAR(255);
ALTER TABLE "pedido" ADD COLUMN "notas" TEXT;

-- Backfill: pedidos históricos toman el nombre registrado del usuario.
-- telefono_contacto queda vacío (''), aceptado para pedidos históricos.
UPDATE "pedido" p
SET "nombre_contacto" = u."nombre",
    "telefono_contacto" = ''
FROM "usuario" u
WHERE p."id_usuario" = u."id_usuario";

ALTER TABLE "pedido" ALTER COLUMN "nombre_contacto" SET NOT NULL;
ALTER TABLE "pedido" ALTER COLUMN "telefono_contacto" SET NOT NULL;

-- AlterEnum: VARCHAR(50) -> enum EstadoPedido
CREATE TYPE "EstadoPedido" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'CANCELADO');

-- Normaliza los registros históricos antes del cast (el enum es case-sensitive).
UPDATE "pedido" SET "estado" = 'PENDIENTE' WHERE "estado" = 'pendiente';

ALTER TABLE "pedido" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "pedido" ALTER COLUMN "estado" SET DATA TYPE "EstadoPedido" USING ("estado"::"EstadoPedido");
ALTER TABLE "pedido" ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE';