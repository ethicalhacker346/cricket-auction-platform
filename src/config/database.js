import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase(uri = env.MONGODB_URI) {
  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    autoIndex: env.NODE_ENV !== 'production',
  });

  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}
