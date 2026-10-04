-- Backfill comercial derivado del modelo legacy, sin cambiar su runtime.
-- Un único DO garantiza atomicidad; cualquier excepción revierte toda la sentencia.
-- La base vacía es un NO-OP. Una repetición compatible no duplica configuración.
DO $backfill$
DECLARE
    configuracion RECORD;
    presentacion_id INTEGER;
    perfil_id INTEGER;
BEGIN
    -- Evitar que la configuración de origen cambie durante la validación/backfill.
    LOCK TABLE "producto", "producto_variante", "unidad_medida", "lista_precio",
        "regla_precio_cantidad", "presentacion_venta", "perfil_precio"
        IN SHARE ROW EXCLUSIVE MODE;

    IF EXISTS (
        SELECT 1 FROM "producto" p
        WHERE NOT EXISTS (
            SELECT 1 FROM "producto_variante" v WHERE v."id_producto" = p."id_producto"
        )
    ) THEN
        RAISE EXCEPTION 'Fase 3: producto sin variantes; presentación no inferible';
    END IF;

    IF EXISTS (
        SELECT 1 FROM "producto_variante" v
        LEFT JOIN "unidad_medida" u ON u."id_unidad" = v."id_unidad"
        WHERE u."id_unidad" IS NULL OR btrim(u."nombre") = ''
            OR v."cantidad_contenido" <= 0
            OR v."cantidad_contenido" <> trunc(v."cantidad_contenido")
            OR v."cantidad_contenido" > 2147483647
    ) THEN
        RAISE EXCEPTION 'Fase 3: unidad ausente o contenido no convertible exactamente a Int positivo';
    END IF;

    IF EXISTS (
        SELECT 1 FROM "producto_variante"
        GROUP BY "id_producto"
        HAVING count(DISTINCT ("id_unidad", "cantidad_contenido")) <> 1
    ) THEN
        RAISE EXCEPTION 'Fase 3: presentaciones legacy no uniformes dentro de un producto';
    END IF;

    IF EXISTS (
        SELECT 1 FROM "producto_variante"
        WHERE "id_lista_precio" IS NOT NULL OR "id_perfil_precio" IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Fase 3: override inesperado por variante';
    END IF;

    IF EXISTS (
        SELECT 1 FROM "producto" p
        WHERE (SELECT count(*) FROM "lista_precio" l
               WHERE l."id_producto" = p."id_producto") <> 1
            OR NOT EXISTS (
                SELECT 1 FROM "lista_precio" l
                WHERE l."id_producto" = p."id_producto" AND l."principal" AND l."activo"
            )
    ) THEN
        RAISE EXCEPTION 'Fase 3: se esperaba una única lista principal activa por producto';
    END IF;

    IF EXISTS (
        SELECT 1 FROM "lista_precio" l
        WHERE NOT EXISTS (
            SELECT 1 FROM "regla_precio_cantidad" r
            WHERE r."id_lista_precio" = l."id_lista_precio"
                AND r."activo" AND r."cantidad_minima" = 1
        )
    ) THEN
        RAISE EXCEPTION 'Fase 3: lista sin regla activa desde una presentación';
    END IF;

    -- Admitir solamente configuración previa idéntica, nunca sobreescribir conflictos.
    IF EXISTS (
        SELECT 1 FROM "presentacion_venta" pv
        JOIN "producto_variante" v ON v."id_producto" = pv."id_producto"
        JOIN "unidad_medida" u ON u."id_unidad" = v."id_unidad"
        WHERE pv."nombre" <> u."nombre" OR pv."cantidad_base" <> v."cantidad_contenido"
            OR NOT pv."principal" OR NOT pv."activo" OR pv."orden" <> 0
    ) OR EXISTS (
        SELECT 1 FROM "perfil_precio"
        WHERE "nombre" <> 'Principal' OR NOT "principal" OR NOT "activo" OR "orden" <> 0
    ) THEN
        RAISE EXCEPTION 'Fase 3: configuración nueva preexistente incompatible con el backfill';
    END IF;

    FOR configuracion IN
        SELECT p."id_producto", min(u."nombre") AS nombre_presentacion,
            min(v."cantidad_contenido")::INTEGER AS cantidad_base,
            l."id_lista_precio", l."id_presentacion", l."id_perfil_precio"
        FROM "producto" p
        JOIN "producto_variante" v ON v."id_producto" = p."id_producto"
        JOIN "unidad_medida" u ON u."id_unidad" = v."id_unidad"
        JOIN "lista_precio" l ON l."id_producto" = p."id_producto"
        GROUP BY p."id_producto", l."id_lista_precio", l."id_presentacion", l."id_perfil_precio"
        ORDER BY p."id_producto"
    LOOP
        SELECT "id_presentacion" INTO presentacion_id FROM "presentacion_venta"
        WHERE "id_producto" = configuracion."id_producto"
            AND "nombre" = configuracion.nombre_presentacion;

        IF presentacion_id IS NULL THEN
            INSERT INTO "presentacion_venta"
                ("id_producto", "nombre", "cantidad_base", "principal", "activo", "orden")
            VALUES (configuracion."id_producto", configuracion.nombre_presentacion,
                configuracion.cantidad_base, true, true, 0)
            RETURNING "id_presentacion" INTO presentacion_id;
        END IF;

        SELECT "id_perfil_precio" INTO perfil_id FROM "perfil_precio"
        WHERE "id_producto" = configuracion."id_producto" AND "nombre" = 'Principal';

        IF perfil_id IS NULL THEN
            INSERT INTO "perfil_precio" ("id_producto", "nombre", "principal", "activo", "orden")
            VALUES (configuracion."id_producto", 'Principal', true, true, 0)
            RETURNING "id_perfil_precio" INTO perfil_id;
        END IF;

        IF (configuracion."id_presentacion" IS NOT NULL
                AND configuracion."id_presentacion" <> presentacion_id)
            OR (configuracion."id_perfil_precio" IS NOT NULL
                AND configuracion."id_perfil_precio" <> perfil_id) THEN
            RAISE EXCEPTION 'Fase 3: lista % enlazada a otra configuración', configuracion."id_lista_precio";
        END IF;

        UPDATE "lista_precio"
        SET "id_presentacion" = presentacion_id, "id_perfil_precio" = perfil_id
        WHERE "id_lista_precio" = configuracion."id_lista_precio"
            AND ("id_presentacion" IS DISTINCT FROM presentacion_id
                OR "id_perfil_precio" IS DISTINCT FROM perfil_id);
    END LOOP;

    IF (SELECT count(*) FROM "presentacion_venta") <> (SELECT count(*) FROM "producto")
        OR (SELECT count(*) FROM "perfil_precio") <> (SELECT count(*) FROM "producto")
        OR EXISTS (
            SELECT 1 FROM "lista_precio" l
            LEFT JOIN "presentacion_venta" pv ON pv."id_presentacion" = l."id_presentacion"
            LEFT JOIN "perfil_precio" pp ON pp."id_perfil_precio" = l."id_perfil_precio"
            WHERE pv."id_producto" IS DISTINCT FROM l."id_producto"
                OR pp."id_producto" IS DISTINCT FROM l."id_producto"
        ) THEN
        RAISE EXCEPTION 'Fase 3: configuración final incompleta o de otro producto';
    END IF;
END;
$backfill$;
