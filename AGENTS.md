# AGENTS.md — Backend (Trinity Party)

## Propósito

API REST para tienda Trinity Party. Sirve panel de administración (CRUD productos, categorías, inventario) y catálogo público.

## Stack

- Node.js + Express 4 + TypeScript (ESM, `"type": "module"`)
- Prisma 5 + PostgreSQL
- JWT (bcrypt + jsonwebtoken) para autenticación
- Cloudinary SDK para imágenes
- Multer (memoryStorage) para upload
- Zod para validación
- Vitest + Supertest para tests

## Estructura

```
src/
├── config/            # Configuración centralizada
│   ├── cloudinary.ts  # SDK Cloudinary
│   ├── env.ts         # Variables de entorno tipadas (fail si faltan requeridas)
│   ├── logger.ts      # Logger
│   ├── multer.ts      # Upload config (memoryStorage, 5MB, image/*)
│   └── prisma.ts      # Cliente Prisma singleton
├── controllers/       # Request/response handling
├── middlewares/        # auth, error handling, Zod validation
├── repositories/      # Queries Prisma puras
├── routes/            # Definición de endpoints
│   ├── index.ts       # Montaje: /auth, /admin (con auth), / (público)
│   ├── auth.routes.ts
│   ├── admin/         # Rutas protegidas (todas requieren JWT)
│   └── public/        # Rutas públicas (catálogo)
├── services/          # Lógica de negocio
├── types/             # Tipos TypeScript
├── utils/             # AppError, asyncHandler, generarSlug
└── validations/       # Schemas Zod
```

## Arquitectura en capas

```
Routes → Controllers → Services → Repositories → Prisma
   ↓         ↓            ↓
Validations  (Zod)     (AppError)
```

- **Routes:** Definen endpoints y montan middleware (auth, validation, multer).
- **Controllers:** Manejan request/response, llaman services.
- **Services:** Contienen lógica de negocio, llaman repositories.
- **Repositories:** Contienen queries Prisma puras (sin lógica HTTP).

**Excepción:** Algunos endpoints en `routes/admin/index.ts` usan Prisma directamente sin service/repository (marcas, unidades, atributos). Esto es deuda técnica.

## Variables de entorno requeridas

| Variable | Uso | Default |
|----------|-----|---------|
| `PORT` | Puerto del servidor | 4000 |
| `NODE_ENV` | Modo | development |
| `DATABASE_URL` | PostgreSQL connection | — |
| `JWT_SECRET` | Firma JWT | — |
| `JWT_EXPIRES_IN` | Expiración token | 8h |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary | — |
| `CLOUDINARY_API_KEY` | Cloudinary | — |
| `CLOUDINARY_API_SECRET` | Cloudinary | — |

La app falla al iniciar si falta alguna de las requeridas (`DATABASE_URL`, `JWT_SECRET`, Credenciales Cloudinary).

## Autenticación

- **Login:** `POST /api/auth/login` → JWT con payload `{ id_usuario, email, rol }`.
- **Protección:** `authMiddleware` verifica `Authorization: Bearer <token>`.
- **Rutas admin:** Todas bajo `/api/admin/*` requieren JWT.
- **Roles:** `RolUsuario` enum (ADMIN, EMPLEADO) existe en schema pero `requireRole()` no se usa actualmente.
- **Seed:** Crea usuario `admin@trinityparty.com / admin123`.

## Imágenes (Cloudinary)

- Multer `memoryStorage` → buffer → Cloudinary upload_stream.
- Límites: 5MB por archivo, solo image/jpeg, image/png, image/webp.
- Upload múltiple: máximo 20 archivos por request.
- Carpetas Cloudinary: `productos/`, `variantes/`, `categorias/`.
- Cada imagen tiene `publicId` y `url`.
- Imágenes de categoría reemplazan la anterior (upload + delete).

## Validaciones (Zod)

Archivos en `src/validations/`:

| Archivo | Schemas |
|---------|---------|
| `auth.validation.ts` | `loginSchema` |
| `producto.validation.ts` | `crearProductoSchema`, `actualizarProductoSchema` |
| `productoVariante.validation.ts` | `crearVarianteSchema`, `actualizarVarianteSchema` |
| `inventario.validation.ts` | `actualizarInventarioSchema`, `ajustarInventarioSchema` |

Middleware `validate(schema)` reemplaza `req.body` con datos parseados o retorna 400 con detalles.

## Manejo de errores

- `AppError` — Error con statusCode personalizado (404, 409, etc.).
- `asyncHandler` — Wrapper que captura errores en controllers async.
- `errorMiddleware` — Centraliza errores:
  - Prisma P2002 (unique constraint) → 409
  - Prisma P2025 (not found) → 404
  - AppError → usa statusCode propio
  - Resto → 500

## Convenciones

1. Imports ESM: todos los imports relativos deben usar extensión `.js` (aunque el fuente sea `.ts`).
2. Controllers envueltos con `asyncHandler`.
3. Validaciones Zod entre routes y controllers.
4. Services lanzan `AppError` para errores de negocio.
5. Repositories son funciones puras Prisma (sin `req`/`res`).

## Comandos

```bash
npm run dev              # Desarrollo (tsx watch)
npm run build            # prisma generate && tsc
npm run start            # node dist/server.js
npm run typecheck        # tsc --noEmit
npm run prisma:migrate   # prisma migrate dev
npm run prisma:generate  # prisma generate
npm run prisma:studio    # Prisma Studio
npm run test             # vitest run
npm run seed             # tsx prisma/seed.ts (ARCHIVO NO EXISTE)
```

## Restricciones

1. No usar Prisma directamente en routes para nuevos endpoints — crear service y repository.
2. No exponer el password hash en respuestas JWT.
3. El catá público siempre filtra `estado=Activo` — no exponer borradores.
4. Imágenes: siempre subir vía Cloudinary, nunca almacenamiento local.
5. Slugs se generan automáticamente con `generarSlug()` (quita tildes, lowercase, espacios → guiones).

## Inconsistencias conocidas

- `routes/admin/index.ts` tiene endpoints inline sin service/repository (marcas, unidades, atributos).
- `requireRole()` existe en `auth.middleware.ts` pero no se usa.
- Archivo seed referenciado en package.json pero no existe en el repositorio.
- Sin Dockerfile para el backend.
- Console.log de debug en `producto.service.ts:38` (`console.log(producto?.rating)`).
