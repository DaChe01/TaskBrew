import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

// PostgreSQL error codes we can explain safely to a client.
const PG_ERRORS = {
  23505: [409, 'CONFLICT', 'A record with these values already exists'],
  '22P02': [400, 'INVALID_INPUT', 'One of the supplied values has an invalid format'],
  22003: [400, 'INVALID_INPUT', 'A numeric value is out of range'],
  22007: [400, 'INVALID_INPUT', 'A date value is invalid'],
  22008: [400, 'INVALID_INPUT', 'A date value is out of range'],
  23514: [400, 'INVALID_INPUT', 'A value violates a data rule'],
  23502: [400, 'INVALID_INPUT', 'A required value is missing'],
};

export function notFoundHandler(req, _res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.path} not found`, 'ROUTE_NOT_FOUND'));
}

// Express identifies error handlers by their 4-argument signature.
export function errorHandler(err, req, res, _next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong on our side. Please try again later.';
  let details;

  if (err instanceof AppError) {
    ({ statusCode: status, code, message, details } = err);
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body is not valid JSON';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
  } else if (err?.code && PG_ERRORS[err.code]) {
    [status, code, message] = PG_ERRORS[err.code];
  }

  if (status >= 500) {
    // Diagnostics for developers; never sent to the client.
    logger.error(`${req.method} ${req.originalUrl.split('?')[0]} -> ${status}`, {
      name: err?.name,
      code: err?.code,
      message: err?.message,
      stack: err?.stack,
    });
  }

  const body = { success: false, error: { code, message } };
  if (details) body.error.details = details;
  res.status(status).json(body);
}
