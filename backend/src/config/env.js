import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
  // Only the known reverse-proxy hops may supply a client address. Never true/*.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(8).default(0),
  AUCTION_READ_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(1200),
  AUCTION_GUEST_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(12000),
  AUCTION_COMMAND_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(180),
  SOCKET_MAX_CONNECTIONS_PER_IP: z.coerce.number().int().positive().default(2000),

  // ════════════════════════════════════════════════════════════════════════
  // NEW: SMTP & EMAIL CONFIGURATION
  // ════════════════════════════════════════════════════════════════════════
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false), // false = STARTTLS on 587
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  FROM_EMAIL: z.string().email().default('noreply@gullybid.in'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
   
  CORS_ORIGINS: z
   .string()
   .default('http://localhost:5173')
   .transform((value) =>
     value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
   ),
   // Client
  
  
  // Redis (optional for dev, required for prod multi-instance)
  REDIS_URL: z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional()),
  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
