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
import { createClient } from 'redis';
import { logger } from '../config/logger.js';
import { socketAuth } from './middleware/socketAuth.js';
import { handleConnection } from './handlers/connection.handler.js';
import { handleAuctionEvents } from './handlers/auction.handler.js';
import { initSocketPublisher, getSocketPublisher } from '../publishers/socket.publisher.js';

let ioInstance = null;
let redisAdapter = null;

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
  if (process.env.REDIS_URL) {
    try {
      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();
      
      pubClient.on('error', (err) => logger.error({ err }, 'Redis pub client error'));
      subClient.on('error', (err) => logger.error({ err }, 'Redis sub client error'));
      
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      redisAdapter = { pubClient, subClient };
      
      logger.info('🔗 Socket.IO Redis adapter initialized');
    } catch (err) {
      logger.error(err, 'Failed to initialize Redis adapter — falling back to single-instance mode');
    }
  }

  // ─── Connection Rate Limiting per IP ───
  const connectionCounts = new Map();
  const MAX_CONNECTIONS_PER_IP = 10;
  const CLEANUP_INTERVAL_MS = 60000;

  const ipCleanupInterval = setInterval(() => {
    connectionCounts.clear();
  }, CLEANUP_INTERVAL_MS);

  io.use((socket, next) => {
    const clientIp = socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() 
      || socket.handshake.address;
    
    const count = connectionCounts.get(clientIp) || 0;
    if (count >= MAX_CONNECTIONS_PER_IP) {
      logger.warn({ clientIp, socketId: socket.id }, 'Connection limit exceeded');
      return next(new Error('Too many connections from this IP address'));
    }
    
    connectionCounts.set(clientIp, count + 1);
    socket.__clientIp = clientIp;
    next();
  });

  io.use(socketAuth({ allowAnonymous }));

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
      const clientIp = socket.__clientIp;
      if (clientIp) {
        const count = connectionCounts.get(clientIp) || 1;
        connectionCounts.set(clientIp, Math.max(0, count - 1));
      }
      
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
    maxConnPerIp: MAX_CONNECTIONS_PER_IP,
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
  if (!ioInstance) return;
  
  logger.info('Closing Socket.IO...');
  
  const pub = getSocketPublisher();
  if (pub) pub.shutdown();
  
  await new Promise((resolve) => ioInstance.close(resolve));
  
  if (redisAdapter) {
    await Promise.all([
      redisAdapter.pubClient.quit().catch(() => {}),
      redisAdapter.subClient.quit().catch(() => {}),
    ]);
  }
  
  ioInstance = null;
  redisAdapter = null;
  logger.info('Socket.IO closed');
}