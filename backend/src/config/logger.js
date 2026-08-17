/**
 * config/logger.js — Structured logging with Pino
 * ------------------------------------------------
 * • JSON output in production (parsable by Datadog/Grafana)
 * • Pretty print in development
 * • Automatic redaction of sensitive fields
 * • Request correlation via req.id
 */

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';
const level = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

export const logger = pino({
  level,
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    pid: process.pid,
    env: process.env.NODE_ENV,
    version: process.env.npm_package_version || '0.0.0',
    service: 'gullybid-api',
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'token',
      'refreshToken',
      'req.body.password',
      'req.body.token',
      'socket.handshake.auth.token',
    ],
    remove: true,
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

export function getAuctionLogger(meta) {
  return logger.child(meta);
}