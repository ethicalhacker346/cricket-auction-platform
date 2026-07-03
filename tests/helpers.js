import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';

let mongoServer;

export async function setupTestApp() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  await mongoose.connect(uri);

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
