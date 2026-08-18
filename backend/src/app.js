/**
 * app.js — Hardened Express factory
 * ---------------------------------
 * • Helmet with CSP for Cloudinary images
 * • Compression for JSON responses
 * • Strict CORS (no wildcard in production)
 * • Request ID propagation for distributed tracing
 * • Structured request logging (Pino HTTP)
 * • Body size limits
 * • Health/Readiness probes
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import pinoHttp from 'pino-http';
import { logger } from './config/logger.js';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { globalRateLimiter } from './middleware/rateLimiter.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

let dbHealthCheck = null;
async function getDbHealthCheck() {
  if (!dbHealthCheck) {
    const { checkDatabaseHealth } = await import('./config/database.js');
    dbHealthCheck = checkDatabaseHealth;
  }
  return dbHealthCheck;
}

export function createApp() {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', '*.cloudinary.com', '*.res.cloudinary.com'],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", env.CLIENT_URL, 'wss:', 'ws:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }));

  app.use(compression({
    level: 6,
    filter: (req, res) => {
      if (res.getHeader('Content-Length') < 1024) return false;
      return compression.filter(req, res);
    },
  }));

  const devOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];
  
  const allowedOrigins = [
    env.CLIENT_URL,
    ...devOrigins,
  ].filter(Boolean);
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn({ origin, allowedOrigins }, 'CORS blocked request');
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Request-ID',
    ],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400,
  }));

  app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] 
      || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  app.use(express.json({ 
    limit: '10kb',
    strict: true,
  }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  app.use(pinoHttp({
    logger,
    genReqId: (req) => req.id,
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      if (req.url === '/health' || req.url === '/ready') return 'debug';
      return 'info';
    },
    customSuccessMessage: (req, res) => {
      return `${req.method} ${req.url} completed ${res.statusCode}`;
    },
    customErrorMessage: (req, res, err) => {
      return `${req.method} ${req.url} failed ${res.statusCode} — ${err.message}`;
    },
  }));

  app.get('/health', async (req, res) => {
    try {
      const check = await getDbHealthCheck();
      const dbHealthy = await check();
      const status = dbHealthy ? 200 : 503;
      
      res.status(status).json({
        ok: dbHealthy,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        version: env.version || '0.0.0',
        pid: process.pid,
        memory: process.memoryUsage(),
        env: env.NODE_ENV,
      });
    } catch (err) {
      logger.error({ err }, 'Health check failed');
      res.status(503).json({ ok: false, error: 'Health check error' });
    }
  });

  app.get('/ready', async (req, res) => {
    try {
      const check = await getDbHealthCheck();
      const ready = await check();
      res.status(ready ? 200 : 503).json({
        ready,
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({ ready: false });
    }
  });

  app.use(globalRateLimiter);
  app.use('/api/v1', routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}