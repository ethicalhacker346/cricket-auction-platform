import mongoose from 'mongoose';

/**
 * Deeply converts values into Socket.IO-safe transport DTOs.
 *
 * Handles:
 * 1. Mongoose Documents & Subdocuments → .toObject() then recurse
 * 2. ObjectId instances → hex string (frontend-friendly)
 * 3. Date instances → ISO string
 * 4. Functions / Symbols → stripped
 * 5. Circular references → '[Circular]'
 * 6. Mongoose internals ($__, _doc, etc.) → stripped
 *
 * @param {*} value
 * @param {Object} options
 * @param {number} options.maxDepth - default 12
 * @param {boolean} options.keepDates - default false (converts to ISO strings)
 */
export function toTransportDTO(value, options = {}) {
  const { maxDepth = 12, keepDates = false } = options;
  return _convert(value, new WeakSet(), 0, maxDepth, keepDates);
}

function _convert(val, seen, depth, maxDepth, keepDates) {
  if (depth > maxDepth) return '[MaxDepthExceeded]';
  if (val == null) return val;

  const type = typeof val;
  if (type !== 'object') {
    if (type === 'function' || type === 'symbol') return undefined;
    return val;
  }

  // Date → ISO string (Socket.IO will stringify anyway; strings are safer)
  if (val instanceof Date) {
    return keepDates ? val : val.toISOString();
  }

  // ObjectId → hex string. React clients expect strings, not ObjectId objects.
  if (val instanceof mongoose.Types.ObjectId) {
    return val.toString();
  }

  // Mongoose Document or Subdocument detection.
  // Both top-level docs and embedded subdocuments (liveState, logs, etc.)
  // carry `$__` and a `toObject()` method. Subdocuments additionally carry
  // `$__parent` which creates the fatal circular reference in hasBinary.
  if (val.$__ && typeof val.toObject === 'function') {
    try {
      const plain = val.toObject({
        getters: true,
        virtuals: true,
        versionKey: false,
        depopulate: false,        // KEEP populated refs as nested objects
        flattenObjectIds: false,  // We handle ObjectId conversion ourselves
        transform: (_doc, ret) => {
          delete ret.__v;
          return ret;
        },
      });
      // Recurse into the plain object to clean nested docs/ObjectIds
      return _convert(plain, seen, depth + 1, maxDepth, keepDates);
    } catch {
      // If toObject fails, fall through to generic object iteration
    }
  }

  // Arrays
  if (Array.isArray(val)) {
    const out = [];
    for (const item of val) {
      const converted = _convert(item, seen, depth + 1, maxDepth, keepDates);
      if (converted !== undefined) out.push(converted);
    }
    return out;
  }

  // Circular reference guard
  if (seen.has(val)) return '[Circular]';
  seen.add(val);

  // Plain object
  const out = {};
  for (const key of Object.keys(val)) {
    // Strip Mongoose internals and metadata that leak onto plain objects
    if (typeof key === 'string' && (key.startsWith('$') || key === '__v' || key === '_doc')) {
      continue;
    }
    const converted = _convert(val[key], seen, depth + 1, maxDepth, keepDates);
    if (converted !== undefined) {
      out[key] = converted;
    }
  }

  seen.delete(val);
  return out;
}