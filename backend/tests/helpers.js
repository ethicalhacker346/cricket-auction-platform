import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';

let mongoServer;

export async function setupTestApp() {
  // Transactions require a replica set (a standalone silently invalidates the
  // most important wallet/undo integration coverage). Honors MONGOMS_SYSTEM_BINARY.
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const uri = mongoServer.getUri();

  await mongoose.connect(uri);

  await Promise.all(Object.values(mongoose.models).map((Model) => Model.init()));
  const app = createApp();
  return app;
}

export async function teardownTestApp() {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

export async function registerUser(app, payload) {
  const response = await request(app).post('/api/v1/auth/register').send(payload);
  return response;
}

export { request };
