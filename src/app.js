import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes/index.js';
import { globalRateLimiter } from './middleware/rateLimiter.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.use(globalRateLimiter);
  app.use('/api/v1', routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
