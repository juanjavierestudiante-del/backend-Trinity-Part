-- CreateEnum
CREATE TYPE "TipoVisualizacionAtributo" AS ENUM ('text', 'color', 'image');

-- AlterTable
ALTER TABLE "atributo" ADD COLUMN     "tipo_visualizacion" "TipoVisualizacionAtributo" NOT NULL DEFAULT 'text';

-- AlterTable
ALTER TABLE "producto" ADD COLUMN     "id_atributo_principal" INTEGER;

-- AlterTable
ALTER TABLE "valor_atributo" ADD COLUMN     "visual_value" VARCHAR(255);

-- CreateIndex
CREATE INDEX "producto_id_atributo_principal_idx" ON "producto"("id_atributo_principal");

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_id_atributo_principal_fkey" FOREIGN KEY ("id_atributo_principal") REFERENCES "atributo"("id_atributo") ON DELETE SET NULL ON UPDATE CASCADE;
