import app from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import prisma from './config/prisma.js';

const startServer = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('Conexión a PostgreSQL establecida correctamente');

    app.listen(env.port, () => {
      logger.info(`Servidor corriendo en http://localhost:${env.port}`);
      logger.info(`Entorno: ${env.nodeEnv}`);
    });
  } catch (error) {
    logger.error('No se pudo conectar a la base de datos', error);
    process.exit(1);
  }
};

startServer();

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
