import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
  {
    // node-pg-migrate always passes `pgm`; an empty down() legitimately ignores it.
    files: ['migrations/**'],
    rules: { 'no-unused-vars': ['error', { args: 'none' }] },
  },
  prettier,
];
