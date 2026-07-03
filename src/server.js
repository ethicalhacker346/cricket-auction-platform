import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';

async function bootstrap() {
  await connectDatabase();

  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
