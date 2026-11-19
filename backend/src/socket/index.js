/**
 * socket/index.js — Production-grade Socket.IO bootstrap
 * -------------------------------------------------------
 * • Redis adapter for horizontal scaling
 * • Connection rate limiting per IP
 * • Optimized for mobile networks
 * • Per-message deflate compression
 * • Structured error logging with context
 * • Graceful cleanup on disconnect
 */

import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { connectSocketRedis, destroySocketRedis } from './redisAdapter.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { SocketConnectionGate, socketClientIp } from './connectionGate.js';
import { socketAuth } from './middleware/socketAuth.js';
import { handleConnection } from './handlers/connection.handler.js';
import { handleAuctionEvents } from './handlers/auction.handler.js';
import { initSocketPublisher, getSocketPublisher } from '../publishers/socket.publisher.js';

let ioInstance = null;
let redisAdapter = null;
let connectionGate = null;

export async function initSocket(httpServer, options = {}) {
  const {
    corsOrigins = process.env.CLIENT_URL || 'http://localhost:5173',
    path = '/socket.io',
    allowAnonymous = true,
  } = options;

  const origins = process.env.NODE_ENV === 'production' && corsOrigins === '*'
    ? [process.env.CLIENT_URL].filter(Boolean)
    : corsOrigins;

  const io = new Server(httpServer, {
    path,
    cors: {
      origin: origins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000,
    connectTimeout: 45000,
    maxHttpBufferSize: 1e5,
    perMessageDeflate: {
      threshold: 1024,
      zlibDeflateOptions: {
        chunkSize: 1024,
        memLevel: 7,
        level: 3,
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024,
      },
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
    },
  });

  // ─── Redis Adapter ───
  redisAdapter = await connectSocketRedis(env.REDIS_URL);
  if (redisAdapter) {
    io.adapter(createAdapter(redisAdapter.pubClient, redisAdapter.subClient));
    logger.info('Socket.IO Redis adapter initialized');
  }

  // Shared venues are normal. Bound reconnect attempts separately from live
  // leases, and never erase active counts at a minute boundary.
  connectionGate = new SocketConnectionGate();
  const gate = connectionGate;
  io.use(async (socket, next) => {
    try {
      socket.__clientIp = socketClientIp(socket);
      await gate.checkAttempt(socket.__clientIp);
      next();
    } catch (error) { next(error); }
  });
  io.use(socketAuth({ allowAnonymous }));
  io.use(async (socket, next) => {
    try {
      const release = await gate.acquire(socket.__clientIp, socket.user?._id);
      // A disconnect before the namespace's connection callback also releases.
      socket.once('disconnect', release);
      socket.conn.once('close', release);
      next();
    } catch (error) { next(error); }
  });

  initSocketPublisher(io);

  io.on('connection', (socket) => {
    const log = logger.child({
      socketId: socket.id,
      userId: socket.user?.id,
      ip: socket.__clientIp,
      rooms: Array.from(socket.rooms),
    });

    log.debug('⚡ Client connected');
    socket.log = log;

    handleConnection(io, socket);
    handleAuctionEvents(io, socket);

    socket.on('disconnect', (reason) => {
      const rooms = Array.from(socket.rooms);
      rooms.forEach((room) => {
        if (room !== socket.id && io.sockets.adapter.rooms.get(room)?.size === 0) {
          log.debug({ room }, 'Cleaning up empty auction room');
        }
      });
      
      log.debug({ reason }, 'Client disconnected');
    });

    socket.on('error', (err) => {
      log.error({ err }, 'Socket error');
    });
  });

  io.engine.on('connection_error', (err) => {
    logger.error({
      code: err.code,
      message: err.message,
      context: err.context,
      req: err.req?.url,
    }, 'Socket.IO engine connection error');
  });

  ioInstance = io;
  
  logger.info({
    path,
    cors: Array.isArray(origins) ? origins.join(', ') : origins,
    redis: !!redisAdapter,
    maxConnPerIp: env.SOCKET_MAX_CONNECTIONS_PER_IP,
  }, 'Socket.IO initialized');

  return io;
}

export function getIO() {
  if (!ioInstance) {
    throw new Error('Socket.IO not initialized — call initSocket(httpServer) first');
  }
  return ioInstance;
}

export function getIOOptional() {
  return ioInstance;
}

export async function closeSocketIO() {
  connectionGate?.close();
  connectionGate = null;
  if (!ioInstance) return;

  logger.info('Closing Socket.IO...');
  
  const pub = getSocketPublisher();
  if (pub) pub.shutdown();
  
  await new Promise((resolve) => ioInstance.close(resolve));
  
  destroySocketRedis(redisAdapter);

  ioInstance = null;
  redisAdapter = null;
  logger.info('Socket.IO closed');
}