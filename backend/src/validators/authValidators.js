import { body } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest.js';

const email = () =>
  body('email')
    .isString()
    .withMessage('Email is required')
    .bail()
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Enter a valid email address')
    .isLength({ max: 255 })
    .withMessage('Email must be at most 255 characters');

// bcrypt only uses the first 72 bytes, so longer passwords are rejected up front.
const newPassword = () =>
  body('password')
    .isString()
    .withMessage('Password is required')
    .bail()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .custom((value) => Buffer.byteLength(value, 'utf8') <= 72)
    .withMessage('Password must be at most 72 bytes');

export const registerRules = [
  body('name')
    .isString()
    .withMessage('Name is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  email(),
  newPassword(),
  validateRequest,
];

export const loginRules = [
  email(),
  body('password').isString().notEmpty().withMessage('Password is required'),
  validateRequest,
];

export const updateMeRules = [
  body('email_reminders')
    .isBoolean({ strict: true })
    .withMessage('email_reminders must be true or false'),
  validateRequest,
];
