export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}

export function assertFound(entity, message = 'Resource not found') {
  if (!entity) {
    throw new AppError(message, 404);
  }
  return entity;
}

export function assertAuthorized(condition, message = 'Forbidden') {
  if (!condition) {
    throw new AppError(message, 403);
  }
}

export function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parsePagination(query) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function buildPaginatedResponse({ data, total, page, limit }) {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

export function pickFields(object, fields) {
  return fields.reduce((acc, field) => {
    if (object[field] !== undefined) {
      acc[field] = object[field];
    }
    return acc;
  }, {});
}
