-- CreateIndex
CREATE INDEX "producto_id_categoria_idx" ON "producto"("id_categoria");
-- CreateIndex
CREATE INDEX "producto_variante_id_producto_idx" ON "producto_variante"("id_producto");
