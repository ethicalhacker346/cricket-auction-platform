/**
 * socket/index.js — Socket.IO Bootstrap
 * ----------------------------------------------------------------
 * Wires everything together:
 *   HTTP Server -> Socket.IO Server -> Middleware (auth) -> Handlers
 *   -> Publisher (domain events -> socket rooms)
 *
 * Keeps existing Express app untouched — adds realtime layer on top.
 *
 * Usage in server.js:
 *   import { createServer } from 'http'
 *   import { createApp } from './app.js'
 *   import { initSocket } from './socket/index.js'
 *   const app = createApp()
 *   const httpServer = createServer(app)
 *   const io = initSocket(httpServer)
 *   httpServer.listen(PORT)
 */

import { Server } from 'socket.io';
import { socketAuth } from './middleware/socketAuth.js';
import { handleConnection } from './handlers/connection.handler.js';
import { handleAuctionEvents } from './handlers/auction.handler.js';
import { initSocketPublisher, getSocketPublisher } from '../publishers/socket.publisher.js';

let ioInstance = null;

export function initSocket(httpServer, options = {}) {
  const {
    corsOrigins = process.env.CLIENT_URL ? [process.env.CLIENT_URL, 'http://localhost:3000', 'http://localhost:5173'] : '*',
    path = '/socket.io',
    allowAnonymous = true,
  } = options;

  const io = new Server(httpServer, {
    path,
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Performance tuning for auction workload (many rooms, frequent ticks)
    transports: ['websocket', 'polling'],
    pingInterval: 15000,
    pingTimeout: 20000,
    maxHttpBufferSize: 1e6, // 1MB
    // For scaling later: uncomment redis adapter
    // adapter: createAdapter(pubClient, subClient)
  });

  // --- Auth middleware (optional anonymous) ---
  io.use(socketAuth({ allowAnonymous }));

  // --- Publisher (domain -> socket) ---
  initSocketPublisher(io);

  // --- Connection handler + Auction handler ---
  io.on('connection', (socket) => {
    handleConnection(io, socket);
    handleAuctionEvents(io, socket);
  });

  // --- Global error handling ---
  io.engine.on('connection_error', (err) => {
    console.error('[Socket] Connection error:', err.code, err.message);
  });

  ioInstance = io;

  console.log(`[Socket] Initialized with path=${path} cors=${Array.isArray(corsOrigins) ? corsOrigins.join(',') : corsOrigins}`);

  // Graceful shutdown
  const shutdown = () => {
    const pub = getSocketPublisher();
    if (pub) pub.shutdown();
    io.close(() => {
      console.log('[Socket] Closed');
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return io;
}

export function getIO() {
  if (!ioInstance) {
    throw new Error('Socket.IO not initialized — call initSocket(httpServer) first');
  }
  return ioInstance;
}

// Utility to get io without throwing (for optional usage)
export function getIOOptional() {
  return ioInstance;
}

export default initSocket;
