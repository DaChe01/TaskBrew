import { body, param, query } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest.js';
import { isValidDateOnly } from '../utils/dates.js';

const PRIORITIES = ['Low', 'Medium', 'High'];

export const idParam = [
  param('id')
    .isInt({ min: 1, max: 2147483647 })
    .withMessage('Task id must be a positive integer')
    .toInt(),
  validateRequest,
];

const title = (required) => {
  const chain = body('title');
  if (!required) chain.optional();
  return chain
    .isString()
    .withMessage('Title is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters');
};

const description = () =>
  body('description')
    .optional({ nullable: true })
    .isString()
    .withMessage('Description must be text')
    .bail()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be at most 2000 characters');

const priority = () =>
  body('priority').optional().isIn(PRIORITIES).withMessage('Priority must be Low, Medium or High');

const dueDate = () =>
  body('due_date')
    .optional({ nullable: true })
    .custom(isValidDateOnly)
    .withMessage('Due date must be a valid date in YYYY-MM-DD format');

const completed = () =>
  body('completed')
    .optional()
    .isBoolean({ strict: true })
    .withMessage('completed must be true or false');

export const createTaskRules = [title(true), description(), priority(), dueDate(), validateRequest];

export const replaceTaskRules = [
  ...idParam.slice(0, 1),
  title(true),
  description(),
  priority(),
  dueDate(),
  completed(),
  validateRequest,
];

export const patchTaskRules = [
  ...idParam.slice(0, 1),
  title(false),
  description(),
  priority(),
  dueDate(),
  completed(),
  body()
    .custom((value) =>
      ['title', 'description', 'priority', 'due_date', 'completed'].some(
        (key) => value?.[key] !== undefined,
      ),
    )
    .withMessage('Provide at least one field to update'),
  validateRequest,
];

export const listTaskRules = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('page must be 1 or greater')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('limit must be between 1 and 50')
    .toInt(),
  query('status')
    .optional()
    .isIn(['all', 'active', 'completed'])
    .withMessage('status must be all, active or completed'),
  query('priority').optional().isIn(PRIORITIES).withMessage('priority must be Low, Medium or High'),
  query('q')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('q must be at most 100 characters'),
  query('sort')
    .optional()
    .isIn(['created_at', 'due_date', 'priority', 'title'])
    .withMessage('sort must be created_at, due_date, priority or title'),
  query('order')
    .optional()
    .toLowerCase()
    .isIn(['asc', 'desc'])
    .withMessage('order must be asc or desc'),
  validateRequest,
];

export const statsRules = [
  query('today')
    .optional()
    .custom(isValidDateOnly)
    .withMessage('today must be a valid date in YYYY-MM-DD format'),
  validateRequest,
];
