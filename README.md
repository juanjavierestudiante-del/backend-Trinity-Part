# Trinity Party — Backend (TypeScript)

Misma API que la versión JavaScript, migrada completa a **TypeScript**.

Stack: **Node.js + Express + TypeScript + Prisma (MySQL) + JWT + Cloudinary**.

---

## 1. Instalación

```bash
npm install
```

## 2. Variables de entorno

`.env` ya viene copiado desde tu proyecto anterior. Verifica que tenga:

```env
DATABASE_URL="mysql://usuario:password@localhost:3306/tiendaTrinityParty"
JWT_SECRET=cambia_esto_por_un_secreto_largo_y_seguro
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

## 3. Generar cliente Prisma

```bash
npm run prisma:generate
```

Si tu base de datos ya existe (tablas creadas con el SQL que armamos):
```bash
npx prisma db pull
npm run prisma:generate
```

Si quieres crear todo desde cero con Prisma:
```bash
npx prisma migrate dev --name init
```

## 4. Seed (datos de prueba)

```bash
npm run seed
```

Crea usuario admin: **admin@trinityparty.com / admin123**

## 5. Levantar en desarrollo (con recarga automática)

```bash
npm run dev
```

`tsx watch` corre el TypeScript directo, sin necesidad de compilar en cada cambio.

## 6. Compilar para producción

```bash
npm run build    # genera /dist en JavaScript puro
npm start        # corre /dist/server.js
```

## 7. Verificar tipos sin compilar

```bash
npm run typecheck
```

## 8. Tests

```bash
npm test
```

---

## Qué cambió respecto a la versión JavaScript

| Antes (JS) | Ahora (TS) |
|---|---|
| `.js` en todo `src/` | `.ts` en todo `src/`, compila a `.js` en `dist/` |
| `node --watch` | `tsx watch` (ejecuta TS directo, sin compilar) |
| Sin tipos en `req.usuario` | `src/types/auth.types.ts` + `src/types/express.d.ts` extiende `Request` |
| Validación Zod sin tipo explícito | `z.infer<typeof schema>` exporta el tipo de cada validación (`CrearProductoInput`, etc.) |
| Repositories con `data` sin tipar | Repositories tipados con `Prisma.ProductoCreateInput`, `Prisma.ProductoUpdateInput`, etc. |
| Errores con `error.statusCode = 404` suelto | Clase `AppError` en `utils/helpers.ts` (`throw new AppError('mensaje', 404)`) |
| `prisma/seed.js` | `prisma/seed.ts` + bloque `"prisma": { "seed": "tsx prisma/seed.ts" }` en `package.json` (Prisma lo necesita para saber cómo correr un seed que no es `.js` puro) |

## Notas importantes sobre los imports

Como el proyecto usa `"module": "NodeNext"` en `tsconfig.json`, **todos los imports relativos llevan extensión `.js`** aunque el archivo real sea `.ts`:

```typescript
import { env } from '../config/env.js';   // ✅ correcto, aunque el archivo es env.ts
import { env } from '../config/env';      // ❌ falla en runtime con NodeNext
```

Esto es porque TypeScript con `NodeNext` resuelve los imports igual que Node ESM nativo: espera la extensión del archivo *compilado* (`.js`), no la del archivo fuente (`.ts`). `tsx` y `tsc` lo entienden automáticamente.

---

## Endpoints

Idénticos a la versión JS — ver tabla completa en el README anterior. Resumen:

- `POST /api/auth/login` — login admin
- `GET /api/productos` / `GET /api/productos/:slug` — catálogo público
- `GET /api/categorias` — árbol de categorías
- `GET/POST/PUT/DELETE /api/admin/productos` — CRUD producto (requiere token)
- `GET/POST/PUT/DELETE /api/admin/categorias` — CRUD categoría
- `GET/POST/PUT/DELETE /api/admin/variantes` — CRUD variantes
- `GET/PUT/PATCH /api/admin/inventario/:idVariante` — stock
- `POST /api/admin/imagenes/producto/:idProducto` — subir imagen (form-data, campo `imagen`)
- `POST /api/admin/imagenes/variante/:idVariante` — subir imagen de variante

---

## Próximos pasos sugeridos

- Tablas y rutas de **cliente, carrito y pedidos**
- Paginación en listados (`/api/productos?page=1&limit=20`)
- Rate limiting en rutas públicas
