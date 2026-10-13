(function (exports) {
  'use strict';

  const EMAIL_DOMAIN = 'kosmiczne-klocki.local';
  const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
  const MIN_PASSWORD = 6;
  const REFRESH_MARGIN_MS = 5 * 60 * 1000;

  const MESSAGES = {
    username: 'Nazwa: 3–20 znaków, małe litery, cyfry i _',
    password: 'Hasło musi mieć co najmniej 6 znaków',
    taken: 'Ta nazwa jest zajęta',
    credentials: 'Zła nazwa użytkownika lub hasło',
    network: 'Brak połączenia — spróbuj ponownie',
    unknown: 'Coś poszło nie tak — spróbuj ponownie',
  };

  class AuthError extends Error {
    constructor(code) {
      super(MESSAGES[code]);
      this.name = 'AuthError';
      this.code = code;
    }
  }

  function normalizeUsername(text) {
    if (typeof text !== 'string') return null;
    const name = text.trim().toLowerCase();
    return USERNAME_RE.test(name) ? name : null;
  }

  function usernameToEmail(username) {
    return `${username}@${EMAIL_DOMAIN}`;
  }

  function usernameFromEmail(email) {
    const suffix = `@${EMAIL_DOMAIN}`;
    return typeof email === 'string' && email.endsWith(suffix) ? email.slice(0, -suffix.length) : null;
  }

  function needsRefresh(session, now) {
    return session.expiresAt - now < REFRESH_MARGIN_MS;
  }

  function isSession(value) {
    return (
      value !== null &&
      typeof value === 'object' &&
      typeof value.accessToken === 'string' &&
      typeof value.refreshToken === 'string' &&
      Number.isFinite(value.expiresAt) &&
      typeof value.userId === 'string' &&
      typeof value.username === 'string'
    );
  }

  // Kod błędu z odpowiedzi Supabase Auth (nowy format: error_code/msg, stary: error/error_description).
  function errorCode(data) {
    const code = (data && (data.error_code || data.error)) || '';
    const text = (data && (data.msg || data.message || data.error_description)) || '';
    if (code === 'user_already_exists' || /already registered/i.test(text)) return 'taken';
    if (code === 'invalid_credentials' || /invalid login credentials/i.test(text)) return 'credentials';
    if (code === 'weak_password') return 'password';
    return 'unknown';
  }

  function credentials(usernameText, password) {
    const username = normalizeUsername(usernameText);
    if (!username) throw new AuthError('username');
    if (typeof password !== 'string' || password.length < MIN_PASSWORD) throw new AuthError('password');
    return { email: usernameToEmail(username), password };
  }

  function createAuth({ url, key, fetch, now = Date.now }) {
    const base = `${url}/auth/v1`;

    async function call(path, body, token) {
      const headers = { apikey: key, 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      let response;
      try {
        response = await fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
      } catch (e) {
        throw new AuthError('network');
      }
      let data = null;
      try {
        data = await response.json();
      } catch (e) {
        data = null;
      }
      // Chwilowa awaria serwera lub limit zapytań — jak brak sieci (spróbuj później).
      if (response.status >= 500 || response.status === 429) throw new AuthError('network');
      if (!response.ok) throw new AuthError(errorCode(data));
      return data;
    }

    function toSession(data) {
      const username = data && data.user ? usernameFromEmail(data.user.email) : null;
      if (!data || !data.access_token || !data.refresh_token || !username) throw new AuthError('unknown');
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: now() + data.expires_in * 1000,
        userId: data.user.id,
        username,
      };
    }

    async function signUp(usernameText, password) {
      return toSession(await call('/signup', credentials(usernameText, password)));
    }

    async function signIn(usernameText, password) {
      return toSession(await call('/token?grant_type=password', credentials(usernameText, password)));
    }

    async function refresh(session) {
      return toSession(await call('/token?grant_type=refresh_token', { refresh_token: session.refreshToken }));
    }

    async function signOut(session) {
      try {
        await call('/logout', {}, session.accessToken);
      } catch (e) {
        /* wylogowanie lokalne i tak się uda */
      }
    }

    return { signUp, signIn, refresh, signOut };
  }

  Object.assign(exports, {
    AuthError,
    normalizeUsername,
    usernameToEmail,
    usernameFromEmail,
    needsRefresh,
    isSession,
    createAuth,
  });
})(typeof module !== 'undefined' ? module.exports : window.Tetris);
