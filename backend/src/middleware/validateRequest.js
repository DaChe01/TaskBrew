import { validationResult } from 'express-validator';
import { AppError } from '../errors/AppError.js';

/** Runs after express-validator chains; turns failures into one consistent 400. */
export function validateRequest(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  // Keep one message per field so the UI can show it next to the input.
  const seen = new Set();
  const details = [];
  for (const err of result.array()) {
    const field = err.path ?? err.param ?? 'request';
    if (seen.has(field)) continue;
    seen.add(field);
    details.push({ field, message: err.msg });
  }
  return next(AppError.badRequest('Validation failed', 'VALIDATION_ERROR', details));
}
