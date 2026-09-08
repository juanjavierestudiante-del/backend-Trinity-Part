# Trinity Party — Backend

API Express 4 con TypeScript ESM, Prisma 5 y **PostgreSQL**, JWT, Zod y Cloudinary. Incluye catálogo, registro/login, carrito, pedidos y administración de productos, categorías, variantes, imágenes e inventario.

Revisado el 2026-09-07 contra código local. Contratos completos: [API](../docs/api.md); estructura: [arquitectura](../docs/architecture.md); modelo: [base de datos](../docs/database.md).

## Preparación local

Desde `backend-ts/`, instalar dependencias con `npm install`. Configurar localmente `DATABASE_URL` para PostgreSQL, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET`. No publicar sus valores. Variables opcionales: PORT (4000), NODE_ENV (development) y JWT_EXPIRES_IN (8h).

Generar cliente con `npm run prisma:generate`. Para una base de desarrollo, `npm run prisma:migrate` ejecuta `prisma migrate dev`; aplicar migraciones existentes en despliegue se describe en [deployment](../docs/deployment.md). Hay ocho migraciones locales. No asumir que se han aplicado en la DB usada.

`npm run seed` ejecuta el archivo existente `prisma/seed.ts`; no forma parte del inicio normal. Las credenciales de prueba no se reproducen aquí.

## Comandos

```bash
npm run dev              # tsx watch src/server.ts
npm run build            # npx prisma generate && tsc
npm run start            # node dist/server.js
npm run typecheck        # tsc --noEmit
npm run test             # vitest run
npm run prisma:generate  # prisma generate
npm run prisma:migrate   # prisma migrate dev
npm run prisma:studio    # prisma studio
npm run seed             # tsx prisma/seed.ts
```

Las pruebas actuales comprueban health y la respuesta paginada del catálogo mediante Supertest; importar la app requiere variables de entorno y el test de catálogo requiere DB. No equivalen a cobertura completa de permisos o checkout.

## Organización y permisos

Patrón predominante: routes → controllers → services → repositories → Prisma. Existen excepciones documentadas en [AGENTS.md](AGENTS.md).

Catálogo público sin JWT obligatorio. Perfil, carrito y pedidos propios requieren JWT. Todo `/api/admin` está autenticado; escrituras y lectura de pedidos admin requieren ADMIN. Otros GET admin solo requieren autenticación. Roles: ADMIN, EMPLEADO, CLIENTE; registro público crea CLIENTE, aunque el default del schema Usuario permanece ADMIN.

Listado público de productos, inventario admin y pedidos admin están paginados. Productos admin devuelve array. El detalle público por slug aún no filtra estado; es un pendiente, no una garantía de ocultar borradores.

Imports relativos usan extensión `.js` con TypeScript NodeNext. Imágenes de catálogo se suben a Cloudinary mediante buffers en memoria. No hay Dockerfile backend; proveedor real de despliegue UNKNOWN.
