/**
 * server.js — Bootstrap with Socket.IO integration (non-invasive addition)
 * -------------------------------------------------------------------------
 * Original: app.listen(PORT)
 * New:      httpServer = createServer(app) -> initSocket(httpServer) -> httpServer.listen(PORT)
 *
 * This preserves all existing middleware/routes; socket is additive.
 * No breaking change to REST contracts.
 */

import { createServer } from 'http';
import { createApp } from './app.js';
import { connectDatabase, registerDatabaseShutdownHooks } from './config/database.js';
import { env } from './config/env.js';
import { initSocket } from './socket/index.js';

async function bootstrap() {
  await connectDatabase();
  registerDatabaseShutdownHooks();

  const app = createApp();

  // Create HTTP server (required for socket.io attachment)
  const httpServer = createServer(app);

  // Initialize Socket.IO — all auction realtime logic lives here
  const io = initSocket(httpServer, {
    // Accept multiple dev origins; in prod set CLIENT_URL env
    corsOrigins: env.CLIENT_URL
      ? [env.CLIENT_URL, 'http://localhost:3000', 'http://localhost:5173']
      : '*',
    path: '/socket.io',
    allowAnonymous: true, // spectators can join auction rooms without token
  });

  // Make io available to Express if needed (e.g., for debugging route)
  app.set('io', io);

  httpServer.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
    console.log(`REST    -> http://localhost:${env.PORT}/api/v1`);
    console.log(`Socket  -> ws://localhost:${env.PORT}/socket.io`);
    console.log(`Health  -> http://localhost:${env.PORT}/health`);
  });

  // Graceful shutdown already handled inside socket/index.js
  // but also handle httpServer close
  const shutdown = async () => {
    console.log('Shutting down gracefully...');
    httpServer.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
