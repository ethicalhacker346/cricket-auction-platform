import dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['1.1.1.1', '1.0.0.1', '8.8.8.8', '8.8.4.4']);

console.log('Active DNS servers:', dns.getServers());

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { env } from './env.js';

dotenv.config();

const CONNECTION_STATES = {
  DISCONNECTED: 0,
  CONNECTED: 1,
  CONNECTING: 2,
  DISCONNECTING: 3,
};



let isInitialized = false;

/**
 * Configure global mongoose behavior.
 * Should only run once during application startup.
 */
function configureMongoose() {
  if (isInitialized) return;

  mongoose.set('strictQuery', true);
  mongoose.set('runValidators', true);
  // NOTE: sanitizeFilter is intentionally NOT enabled globally.
  // It wraps *any* nested object with a "$" key — including hardcoded,
  // developer-written operators like `{ lotOutcome: { $in: [...] } }` or
  // `{ lastSeenAt: { $gte: cutoff } }` — in `$eq`, because it can't tell
  // those apart from an attacker-controlled `{ $ne: null }` coming out of
  // req.body/req.query. That broke openLot, checkRoundCompletion, and
  // getViewerCount in auction.service.js with CastErrors.
  // Mongo/Mongoose injection protection belongs at the boundary instead:
  // whitelist which req.query/req.body fields are allowed into a filter,
  // and validate their values against the enums in config/constants.js
  // before building the query. If a global net is still wanted, use
  // express-mongo-sanitize as request middleware (strips "$"/"." keys from
  // incoming req.body/req.query/req.params) rather than this mongoose-level
  // setting, since that only touches untrusted input and leaves
  // application-authored queries alone.

  isInitialized = true;
}

/**
 * Register mongoose connection lifecycle events.
 */
function registerConnectionEvents() {
  const db = mongoose.connection;

  db.on('connecting', () => {
    console.log('🟡 MongoDB connecting...');
  });

  db.on('connected', () => {
    console.log(
      `🟢 MongoDB connected | Database: ${db.name} | Host: ${db.host}:${db.port}`
    );
  });

  db.on('disconnected', () => {
    console.warn('🟠 MongoDB disconnected.');
  });

  db.on('reconnected', () => {
    console.log('🟢 MongoDB reconnected.');
  });

  db.on('error', (error) => {
    console.error('🔴 MongoDB error:', error);
  });

  db.on('close', () => {
    console.log('⚪ MongoDB connection closed.');
  });
}

/**
 * Connect to MongoDB.
 */
export async function connectDatabase(uri = env.MONGODB_URI) {
  configureMongoose();

  registerConnectionEvents();

  const mongooseOptions = {
    maxPoolSize: 20,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    retryWrites: true,
    retryReads: true,
    heartbeatFrequencyMS: 10000,
  };

  try {
    await mongoose.connect(uri, {
      autoIndex: env.NODE_ENV !== 'production',

      maxPoolSize: 50,
      minPoolSize: 5,

      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,

      family: 4,
    });

    return mongoose.connection;
  } catch (error) {
    console.error('Failed to connect to MongoDB.');
    console.error(error);

    throw error;
  }
}

/**
 * Disconnect gracefully.
 */
export async function disconnectDatabase() {
  try {
    await mongoose.disconnect();
    console.log('[Database] Disconnected gracefully');
  } catch (err) {
    console.error('[Database] Disconnect error:', err);
    throw err;
  }
}

/**
 * Returns true if MongoDB is connected.
 */
export function isDatabaseConnected() {
  return mongoose.connection.readyState === CONNECTION_STATES.CONNECTED;
}

/**
 * Returns current connection state.
 */
export function getDatabaseState() {
  return mongoose.connection.readyState;
}

/**
 * Throws if database is unavailable.
 */
export function assertDatabaseConnection() {
  if (!isDatabaseConnected()) {
    throw new Error('MongoDB connection is not available.');
  }
}

/**
 * Execute operations inside a MongoDB transaction.
 *
 * Usage:
 *
 * await withTransaction(async (session) => {
 *    ...
 * });
 */
export async function withTransaction(work) {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      result = await work(session);
    });

    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * Database health information.
 */
export async function checkDatabaseHealth() {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

/**
 * Graceful shutdown helper.
 */
export function registerDatabaseShutdownHooks() {
  const shutdown = async (signal) => {
    try {
      console.log(`\n${signal} received. Closing MongoDB connection...`);

      await disconnectDatabase();

      console.log('MongoDB connection closed.');

      process.exit(0);
    } catch (error) {
      console.error('Error while shutting down MongoDB:', error);

      process.exit(1);
    }
  };

  process.once('SIGINT', () => shutdown('SIGINT'));

  process.once('SIGTERM', () => shutdown('SIGTERM'));
}