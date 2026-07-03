import { AppError } from '../utils/helpers.js';

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return next(
        new AppError('Validation failed', 400, result.error.flatten().fieldErrors)
      );
    }

    req[source] = result.data;
    return next();
  };
}

export function validateMultiple(schemas) {
  return (req, _res, next) => {
    for (const [source, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[source]);

      if (!result.success) {
        return next(
          new AppError('Validation failed', 400, result.error.flatten().fieldErrors)
        );
      }

      req[source] = result.data;
    }

    return next();
  };
}
