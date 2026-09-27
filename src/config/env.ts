// Carga variables de entorno desde .env y las expone de forma centralizada y tipada.

import dotenv from 'dotenv';

dotenv.config();

// [Bug solucionado] Agregar credenciales de Cloudinary como requeridas
// para que la app falle al iniciar si no están configuradas
const required = ['DATABASE_URL', 'JWT_SECRET', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] as const;

required.forEach((key) => {
  if (!process.env[key]) {
    console.error(`❌ Falta la variable de entorno requerida: ${key}`);
    process.exit(1);
  }
});

interface Env {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  jwt: {
    secret: string;
    expiresIn: string;
    cookieMaxAgeMs: number;
    cookieSameSite: 'lax' | 'strict' | 'none';
  };
  cors: {
    origins: string[];
  };
  cloudinary: {
    cloudName: string | undefined;
    apiKey: string | undefined;
    apiSecret: string | undefined;
  };
  google: { clientId: string | undefined };
}

const parseCookieSameSite = (
  value: string | undefined,
  fallback: 'lax' | 'strict' | 'none'
): 'lax' | 'strict' | 'none' => {
  if (value === 'strict' || value === 'none' || value === 'lax') return value;
  return fallback;
};

const defaultCookieSameSite = process.env.NODE_ENV === 'production' ? 'none' : 'lax';
const cookieSameSite = parseCookieSameSite(process.env.COOKIE_SAME_SITE, defaultCookieSameSite);

if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  console.error('❌ Falta la variable de entorno requerida en producción: FRONTEND_URL');
  process.exit(1);
}

export const env: Env = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL as string,
  jwt: {
    secret: process.env.JWT_SECRET as string,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    cookieMaxAgeMs: Number(process.env.JWT_COOKIE_MAX_AGE_MS) || 8 * 60 * 60 * 1000,
    cookieSameSite,
  },
  cors: {
    origins: (process.env.FRONTEND_URL || 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  google: { clientId: process.env.GOOGLE_CLIENT_ID },
};
