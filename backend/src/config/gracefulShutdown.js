/**
 * config/gracefulShutdown.js — Zero-downtime shutdown orchestrator
 * ------------------------------------------------------------------
 * • Drains active HTTP requests (with timeout)
 * • Notifies all Socket.IO clients of maintenance
 * • Closes database connections cleanly
 * • Handles uncaught exceptions & rejections
 * • Prevents memory leaks from hanging connections
 */

import { logger } from './logger.js';

const SHUTDOWN_TIMEOUT_MS = 15000;

export function setupGracefulShutdown({ httpServer, io, dbDisconnect, cleanupJobs = [] }) {
  let isShuttingDown = false;

  async function shutdown(signal, exitCode = 0) {
    if (isShuttingDown) {
      logger.warn({ signal }, 'Shutdown already in progress, forcing exit...');
      process.exit(1);
      return;
    }
    isShuttingDown = true;

    logger.info({ signal }, '🛑 Starting graceful shutdown...');

    const forceTimer = setTimeout(() => {
      logger.fatal('❌ Forced exit: shutdown timeout exceeded');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    try {
      httpServer.close((err) => {
        if (err) logger.error({ err }, 'HTTP server close error');
      });

      if (io) {
        io.emit('system:maintenance', {
          message: 'Server is restarting for maintenance. Please reconnect in 30 seconds.',
          reconnectAfter: 30000,
        });
        logger.info('📡 Sent maintenance notice to all socket clients');
      }

      await new Promise((r) => setTimeout(r, 2000));

      if (io) {
        await new Promise((resolve) => io.close(resolve));
        logger.info('🔌 Socket.IO closed');
      }

      for (const job of cleanupJobs) {
        try {
          await job();
        } catch (err) {
          logger.error({ err }, 'Cleanup job failed');
        }
      }

      if (dbDisconnect) {
        await dbDisconnect();
        logger.info('🗄️  Database disconnected');
      }

      clearTimeout(forceTimer);
      logger.info('✅ Graceful shutdown complete');
      process.exit(exitCode);
    } catch (err) {
      logger.fatal(err, 'Graceful shutdown failed');
      clearTimeout(forceTimer);
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM', 0));
  process.on('SIGINT', () => shutdown('SIGINT', 0));

  process.on('uncaughtException', (err) => {
    logger.fatal(err, 'Uncaught Exception');
    shutdown('uncaughtException', 1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled Promise Rejection');
    shutdown('unhandledRejection', 1);
  });

  process.on('message', (msg) => {
    if (msg === 'shutdown') shutdown('PM2_SHUTDOWN', 0);
  });
}