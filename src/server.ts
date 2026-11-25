import http from 'http';
import app from './app';
import { env } from './config/env';
import { initializeSockets } from './sockets';
import { ensurePostgresRunning } from './config/db-starter';
import { prisma } from './config/database';

async function bootstrap() {
  try {
    // 1. Ensure database is running
    await ensurePostgresRunning();

    // 2. Test database connection
    await prisma.$connect();
    console.log('[Server] Successfully connected to PostgreSQL database.');

    // Auto-seed initial platform data if empty (e.g. on fresh Railway / cloud deployment)
    try {
      const platformUserCount = await prisma.platformUser.count();
      if (platformUserCount === 0) {
        console.log('[Server] Database is empty. Seeding initial super admin and starter school data...');
        const { main: runSeed } = await import('../prisma/seed');
        await runSeed();
        console.log('[Server] Initial database seeding completed.');
      }
    } catch (seedErr: any) {
      console.warn('[Server] Auto-seed check finished:', seedErr?.message || seedErr);
    }

    // 3. Create HTTP Server & initialize Sockets
    const server = http.createServer(app);
    initializeSockets(server);

    const PORT = env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 Multi-Tenant School SaaS Backend running on port ${PORT}`);
      console.log(`📡 Health Check: http://localhost:${PORT}/api/v1/health`);
      console.log(`📖 API Docs:     http://localhost:${PORT}/api-docs`);
      console.log(`⚡ Environment:  ${env.NODE_ENV}`);
      console.log(`=======================================================`);
    });

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`[Server] Received ${signal}. Gracefully terminating server...`);
      server.close(async () => {
        console.log('[Server] HTTP connections closed.');
        await prisma.$disconnect();
        console.log('[Server] Database pool disconnected.');
        process.exit(0);
      });

      setTimeout(() => {
        console.error('[Server] Forced shutdown after timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('[Server] Critical failure during bootstrap:', error);
    process.exit(1);
  }
}

bootstrap();
