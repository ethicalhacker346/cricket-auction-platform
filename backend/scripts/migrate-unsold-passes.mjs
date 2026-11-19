#!/usr/bin/env node
/** Dry-run by default. Stop ALL auction writers and back up the database first. */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { migrateUnsoldPasses, assertUnsoldPassIndexes } from '../src/migrations/unsold-passes.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--apply')) throw new Error('Usage: node scripts/migrate-unsold-passes.mjs [--apply]');
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required. Use the database you have backed up; never put credentials in command history.');
try {
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10_000 });
  const report = await migrateUnsoldPasses(mongoose.connection.db, { apply: args.includes('--apply') });
  if (args.includes('--apply')) await assertUnsoldPassIndexes(mongoose.connection.db);
  console.log(JSON.stringify(report, null, 2));
  if (!args.includes('--apply')) console.log('Dry run only: no writes. Stop auction writers, take a backup, then rerun with --apply.');
} finally { await mongoose.disconnect(); }
