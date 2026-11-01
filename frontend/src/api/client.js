import axios from 'axios';
import { getStoredToken } from '../utils/storage.js';

// Same-origin "/api" by default (Vite proxies it in development).
// Set VITE_API_URL when the API lives on another origin.
const baseURL = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({ baseURL, timeout: 15000 });

client.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Called when the server says the session is no longer valid.
let onUnauthorized = null;
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

const SESSION_ERROR_CODES = ['TOKEN_EXPIRED', 'INVALID_TOKEN', 'AUTH_REQUIRED'];

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error.response?.data?.error?.code;
    // Only session problems trigger a logout. A wrong password (INVALID_CREDENTIALS)
    // is an ordinary form error, and the handler is a no-op when already logged out,
    // so this can never cause a redirect loop.
    if (error.response?.status === 401 && SESSION_ERROR_CODES.includes(code)) {
      onUnauthorized?.(code);
    }
    return Promise.reject(error);
  },
);

export default client;
