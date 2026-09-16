UPDATE "usuario" SET "email" = LOWER(TRIM("email"));

-- CreateEnum
CREATE TYPE "ProveedorAuth" AS ENUM ('LOCAL', 'GOOGLE');

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "apellido" VARCHAR(150),
ADD COLUMN     "avatar_url" VARCHAR(500),
ADD COLUMN     "email_verificado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "telefono" VARCHAR(20),
ADD COLUMN     "telefono_verificado" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "password" DROP NOT NULL;

-- CreateTable
CREATE TABLE "auth_account" (
    "id_auth_account" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "provider" "ProveedorAuth" NOT NULL,
    "provider_user_id" VARCHAR(255) NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_account_pkey" PRIMARY KEY ("id_auth_account")
);

-- CreateIndex
CREATE INDEX "auth_account_id_usuario_idx" ON "auth_account"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "auth_account_provider_provider_user_id_key" ON "auth_account"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_telefono_key" ON "usuario"("telefono");

-- AddForeignKey
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;
