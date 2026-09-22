import { PrismaClient, RolUsuario, TipoPuntoEntrega } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const usuarios = [
  {
    nombre: 'Admin Test',
    email: 'admin@test.com',
    password: 'Test1234',
    rol: RolUsuario.ADMIN,
  },
  {
    nombre: 'Empleado Test',
    email: 'empleado@test.com',
    password: 'Test1234',
    rol: RolUsuario.EMPLEADO,
  },
  {
    nombre: 'Cliente Test',
    email: 'cliente@test.com',
    password: 'Test1234',
    rol: RolUsuario.CLIENTE,
  },
];

async function main() {
  console.log('Seed: creando usuarios de prueba...');

  for (const u of usuarios) {
    const existe = await prisma.usuario.findUnique({ where: { email: u.email } });
    if (existe) {
      console.log(`  ⏭  ${u.email} ya existe, saltando.`);
      continue;
    }

    const hash = await bcrypt.hash(u.password, 10);
    await prisma.usuario.create({
      data: {
        nombre: u.nombre,
        email: u.email,
        password: hash,
        rol: u.rol,
      },
    });
    console.log(`  ✅  ${u.email} (${u.rol}) creado.`);
  }

  const puntos = [
    ['Plaza del Estudiante', 'PUNTO_ENTREGA', 1],
    ['Monoblock UMSA', 'PUNTO_ENTREGA', 2],
    ['Plaza Bolivia', 'PUNTO_ENTREGA', 3],
    ['Plaza San Francisco', 'PUNTO_ENTREGA', 4],
    ['Ceja de El Alto', 'PUNTO_ENTREGA', 5],
    ['Av. Buenos Aires', 'PUNTO_ENTREGA', 6],
    ['Recojo en tienda', 'RECOJO_TIENDA', 7],
  ] as const;
  for (const [nombre, tipo, orden] of puntos) {
    await prisma.puntoEntrega.upsert({ where: { nombre }, update: { tipo: tipo as TipoPuntoEntrega, orden, activo: true }, create: { nombre, tipo: tipo as TipoPuntoEntrega, orden, activo: true } });
  }
  await prisma.configuracionEntrega.upsert({ where: { id: 1 }, update: {}, create: { id: 1, deliveryHabilitado: true, montoMinimoDelivery: 150 } });

  console.log('Seed completado.');
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
