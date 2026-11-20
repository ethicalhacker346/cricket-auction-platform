import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validate, validateMultiple } from '../src/middleware/validate.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

const query = z.object({ page: z.coerce.number().int().min(1).default(1) });
function appFor(middleware) {
  const app = express();
  app.use(express.json());
  app.post('/', middleware, (req, res) => res.json({ query: req.query, sameQuery: req.query, body: req.body }));
  app.use(errorHandler);
  return app;
}

test('Express 5 query validation preserves coercion, defaults and unknown-key removal across reads', async () => {
  const app = appFor(validate(query, 'query'));
  const parsed = await request(app).post('/?page=2&untrusted=discard').send({}).expect(200);
  expect(parsed.body.query).toEqual({ page: 2 });
  expect(parsed.body.sameQuery).toEqual({ page: 2 });
  const defaults = await request(app).post('/').send({}).expect(200);
  expect(defaults.body.query).toEqual({ page: 1 });
});

test('invalid Express 5 query parameters return a validation error, not a getter-assignment exception', async () => {
  const response = await request(appFor(validate(query, 'query'))).post('/?page=invalid').send({}).expect(400);
  expect(response.body.message).toBe('Validation failed');
  expect(response.body.details.page).toBeDefined();
});

test('multi-source validation still applies parsed body and query schemas together', async () => {
  const app = appFor(validateMultiple({ body: z.object({ name: z.string().trim() }), query }));
  const response = await request(app).post('/?page=3&extra=discard').send({ name: '  Cricket Fan  ', extra: 'discard' }).expect(200);
  expect(response.body).toEqual({ query: { page: 3 }, sameQuery: { page: 3 }, body: { name: 'Cricket Fan' } });
});
