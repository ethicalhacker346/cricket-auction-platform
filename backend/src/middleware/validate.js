import { AppError } from '../utils/helpers.js';

function assignValidated(req, source, data) {
  // Express 5 exposes query through a getter with no setter. Shadow it on this
  // request with the parsed result: mutations to req.query alone would be lost
  // on the next read, including schema coercion/defaults/unknown-key removal.
  if (source === 'query') {
    Object.defineProperty(req, source, {
      value: data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  } else {
    req[source] = data;
  }
}

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(new AppError('Validation failed', 400, result.error.flatten().fieldErrors));
    }
    assignValidated(req, source, result.data);
    return next();
  };
}

export function validateMultiple(schemas) {
  return (req, _res, next) => {
    for (const [source, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[source]);
      if (!result.success) {
        return next(new AppError('Validation failed', 400, result.error.flatten().fieldErrors));
      }
      assignValidated(req, source, result.data);
    }
    return next();
  };
}
