/**
 * server.js — Production bootstrap
 * -----------------------------------------------------------------
 * • Structured env validation (fails fast)
 * • Async Socket.IO initialization with Redis adapter
 * • NO in-process cron
 * • Graceful shutdown with connection draining
 * • Structured logging
 */

import { createServer } from 'http';
import { createApp } from './app.js';
import { connectDatabase, registerDatabaseShutdownHooks } from './config/database.js';
import { env } from './config/env.js';
import { initSocket, closeSocketIO } from './socket/index.js';
import { logger } from './config/logger.js';
import { setupGracefulShutdown } from './config/gracefulShutdown.js';

async function bootstrap() {
  try {
    await connectDatabase();
    registerDatabaseShutdownHooks();
    logger.info('🗄️  Database connected');

    const app = createApp();
    const httpServer = createServer(app);

    const io = await initSocket(httpServer, {
      corsOrigins: env.CLIENT_URL
        ? [env.CLIENT_URL]
        : ['http://localhost:3000', 'http://localhost:5173'],
      path: '/socket.io',
      allowAnonymous: true,
    });

    app.set('io', io);

    httpServer.listen(env.PORT, () => {
      logger.info(`🚀 Server running on port ${env.PORT} [${env.NODE_ENV}]`);
      logger.info(`   REST    -> http://localhost:${env.PORT}/api/v1`);
      logger.info(`   Socket  -> ws://localhost:${env.PORT}/socket.io`);
      logger.info(`   Health  -> http://localhost:${env.PORT}/health`);
      logger.info(`   Ready   -> http://localhost:${env.PORT}/ready`);
    });

    setupGracefulShutdown({
      httpServer,
      io,
      dbDisconnect: async () => {
        const { disconnectDatabase } = await import('./config/database.js');
        await disconnectDatabase();
      },
      cleanupJobs: [closeSocketIO],
    });

  } catch (error) {
    logger.fatal(error, '💥 Failed to start server');
    process.exit(1);
  }
}

bootstrap();