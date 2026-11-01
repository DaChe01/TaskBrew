// The session lives in localStorage so a refresh keeps the user logged in.
// Trade-off: any script running on the page can read localStorage, so an XSS bug
// would expose the token. HttpOnly cookies avoid that but need CSRF protection;
// they are listed as a possible improvement in the README.
const TOKEN_KEY = 'token';
const USER_KEY = 'user';

const safely = (fn, fallback = null) => {
  try {
    return fn();
  } catch {
    return fallback; // storage can be blocked (private mode, disabled cookies)
  }
};

export const getStoredToken = () => safely(() => localStorage.getItem(TOKEN_KEY));

export const getStoredUser = () =>
  safely(() => JSON.parse(localStorage.getItem(USER_KEY) ?? 'null'));

export const saveSession = (token, user) =>
  safely(() => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  });

export const saveUser = (user) =>
  safely(() => localStorage.setItem(USER_KEY, JSON.stringify(user)));

export const clearSession = () =>
  safely(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  });

/**
 * Reads the exp claim of a JWT. Only used to skip obviously expired tokens
 * without a network call; the server remains the authority.
 */
export function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}
