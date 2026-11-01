import { AxiosError } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import client, { setUnauthorizedHandler } from '../src/api/client.js';
import { getErrorMessage, getFieldErrors } from '../src/utils/errors.js';
import { isTokenExpired } from '../src/utils/storage.js';
import { makeToken } from './helpers.jsx';

const failWith = (status, code) => {
  client.defaults.adapter = async (config) => {
    const response = { status, data: { success: false, error: { code } }, config, headers: {} };
    throw new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, response);
  };
};

afterEach(() => {
  setUnauthorizedHandler(null);
  delete client.defaults.adapter;
});

describe('axios client', () => {
  it('sends the stored token as a Bearer header', async () => {
    localStorage.setItem('token', 'abc.def.ghi');
    let seen;
    client.defaults.adapter = async (config) => {
      seen = config.headers.Authorization;
      return { status: 200, data: {}, config, headers: {} };
    };
    await client.get('/tasks');
    expect(seen).toBe('Bearer abc.def.ghi');
  });

  it.each(['TOKEN_EXPIRED', 'INVALID_TOKEN', 'AUTH_REQUIRED'])(
    'triggers the unauthorized handler for %s',
    async (code) => {
      const handler = vi.fn();
      setUnauthorizedHandler(handler);
      failWith(401, code);
      await expect(client.get('/tasks')).rejects.toBeTruthy();
      expect(handler).toHaveBeenCalledWith(code);
    },
  );

  it('does NOT log out on a wrong password (no redirect loop)', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    failWith(401, 'INVALID_CREDENTIALS');
    await expect(client.post('/auth/login')).rejects.toBeTruthy();
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('error helpers', () => {
  it('prefers the server message, with a friendly network fallback', () => {
    expect(getErrorMessage({ response: { data: { error: { message: 'Nope' } } } })).toBe('Nope');
    expect(getErrorMessage({ request: {} })).toMatch(/cannot reach the server/i);
    expect(getErrorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.');
  });

  it('maps validation details to fields', () => {
    const error = {
      response: {
        data: { error: { details: [{ field: 'title', message: 'Title is required' }] } },
      },
    };
    expect(getFieldErrors(error)).toEqual({ title: 'Title is required' });
    expect(getFieldErrors(new Error('x'))).toEqual({});
  });
});

describe('token expiry check', () => {
  it('recognises valid, expired and malformed tokens', () => {
    expect(isTokenExpired(makeToken(3600))).toBe(false);
    expect(isTokenExpired(makeToken(-10))).toBe(true);
    expect(isTokenExpired('garbage')).toBe(true);
    expect(isTokenExpired(null)).toBe(true);
  });
});
