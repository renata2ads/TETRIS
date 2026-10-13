const test = require('node:test');
const assert = require('node:assert');
const auth = require('../src/auth.js');

const URL_BASE = 'https://example.supabase.co';
const KEY = 'sb_publishable_test';
const NOW = 1_000_000;

function fakeFetch(response = { ok: true, status: 200, body: null }) {
  const calls = [];
  const fn = async (url, options) => {
    calls.push({ url, options, body: options.body ? JSON.parse(options.body) : undefined });
    return {
      ok: response.ok,
      status: response.status,
      json: async () => {
        if (response.body === undefined) throw new SyntaxError('no body');
        return response.body;
      },
    };
  };
  fn.calls = calls;
  return fn;
}

function client(fetch) {
  return auth.createAuth({ url: URL_BASE, key: KEY, fetch, now: () => NOW });
}

const SESSION_BODY = {
  access_token: 'acc',
  refresh_token: 'ref',
  expires_in: 3600,
  user: { id: 'user-1', email: 'ola@kosmiczne-klocki.local' },
};

const EXPECTED_SESSION = {
  accessToken: 'acc',
  refreshToken: 'ref',
  expiresAt: NOW + 3600 * 1000,
  userId: 'user-1',
  username: 'ola',
};

async function rejectsWith(promise, code, message) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof auth.AuthError, 'AuthError');
    assert.strictEqual(error.code, code);
    assert.strictEqual(error.message, message);
    return true;
  });
}

test('normalizeUsername: małe litery, cyfry i _, 3–20 znaków', () => {
  assert.strictEqual(auth.normalizeUsername('Ola'), 'ola');
  assert.strictEqual(auth.normalizeUsername('  ola_123  '), 'ola_123');
  assert.strictEqual(auth.normalizeUsername('a'.repeat(20)), 'a'.repeat(20));
  assert.strictEqual(auth.normalizeUsername('ol'), null);
  assert.strictEqual(auth.normalizeUsername('a'.repeat(21)), null);
  assert.strictEqual(auth.normalizeUsername('ola!'), null);
  assert.strictEqual(auth.normalizeUsername('żaba'), null);
  assert.strictEqual(auth.normalizeUsername('ola kot'), null);
  assert.strictEqual(auth.normalizeUsername(null), null);
});

test('nazwa użytkownika ↔ techniczny e-mail', () => {
  assert.strictEqual(auth.usernameToEmail('ola'), 'ola@kosmiczne-klocki.local');
  assert.strictEqual(auth.usernameFromEmail('ola@kosmiczne-klocki.local'), 'ola');
  assert.strictEqual(auth.usernameFromEmail('ola@gmail.com'), null);
  assert.strictEqual(auth.usernameFromEmail(undefined), null);
});

test('signUp wysyła e-mail i hasło i zwraca sesję', async () => {
  const fetch = fakeFetch({ ok: true, status: 200, body: SESSION_BODY });
  const session = await client(fetch).signUp(' Ola ', 'tajne123');
  const [call] = fetch.calls;
  assert.strictEqual(call.url, `${URL_BASE}/auth/v1/signup`);
  assert.strictEqual(call.options.method, 'POST');
  assert.strictEqual(call.options.headers.apikey, KEY);
  assert.strictEqual(call.options.headers.Authorization, undefined);
  assert.deepStrictEqual(call.body, { email: 'ola@kosmiczne-klocki.local', password: 'tajne123' });
  assert.deepStrictEqual(session, EXPECTED_SESSION);
});

test('zła nazwa albo krótkie hasło: komunikat bez pytania serwera', async () => {
  const fetch = fakeFetch();
  await rejectsWith(client(fetch).signUp('ol', 'tajne123'), 'username', 'Nazwa: 3–20 znaków, małe litery, cyfry i _');
  await rejectsWith(client(fetch).signIn('ola', '12345'), 'password', 'Hasło musi mieć co najmniej 6 znaków');
  assert.strictEqual(fetch.calls.length, 0);
});

test('signUp: zajęta nazwa', async () => {
  const fetch = fakeFetch({ ok: false, status: 422, body: { code: 422, error_code: 'user_already_exists', msg: 'User already registered' } });
  await rejectsWith(client(fetch).signUp('ola', 'tajne123'), 'taken', 'Ta nazwa jest zajęta');
});

test('signUp bez sesji w odpowiedzi (włączone potwierdzanie e-maila) to błąd, nie awaria', async () => {
  const fetch = fakeFetch({ ok: true, status: 200, body: { id: 'user-1', email: 'ola@kosmiczne-klocki.local' } });
  await rejectsWith(client(fetch).signUp('ola', 'tajne123'), 'unknown', 'Coś poszło nie tak — spróbuj ponownie');
});

test('signIn loguje hasłem i zwraca sesję', async () => {
  const fetch = fakeFetch({ ok: true, status: 200, body: SESSION_BODY });
  const session = await client(fetch).signIn('OLA', 'tajne123');
  assert.strictEqual(fetch.calls[0].url, `${URL_BASE}/auth/v1/token?grant_type=password`);
  assert.deepStrictEqual(fetch.calls[0].body, { email: 'ola@kosmiczne-klocki.local', password: 'tajne123' });
  assert.deepStrictEqual(session, EXPECTED_SESSION);
});

test('signIn: zła nazwa lub hasło (nowy i stary format błędu)', async () => {
  const modern = fakeFetch({ ok: false, status: 400, body: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } });
  await rejectsWith(client(modern).signIn('ola', 'zlehaslo'), 'credentials', 'Zła nazwa użytkownika lub hasło');
  const legacy = fakeFetch({ ok: false, status: 400, body: { error: 'invalid_grant', error_description: 'Invalid login credentials' } });
  await rejectsWith(client(legacy).signIn('ola', 'zlehaslo'), 'credentials', 'Zła nazwa użytkownika lub hasło');
});

test('brak sieci i nieznany błąd serwera', async () => {
  const offline = async () => {
    throw new TypeError('Failed to fetch');
  };
  await rejectsWith(client(offline).signIn('ola', 'tajne123'), 'network', 'Brak połączenia — spróbuj ponownie');
  const broken = fakeFetch({ ok: false, status: 400, body: undefined });
  await rejectsWith(client(broken).signIn('ola', 'tajne123'), 'unknown', 'Coś poszło nie tak — spróbuj ponownie');
});

test('refresh wymienia refresh_token na nową sesję', async () => {
  const fetch = fakeFetch({ ok: true, status: 200, body: SESSION_BODY });
  const session = await client(fetch).refresh({ ...EXPECTED_SESSION, refreshToken: 'stary' });
  assert.strictEqual(fetch.calls[0].url, `${URL_BASE}/auth/v1/token?grant_type=refresh_token`);
  assert.deepStrictEqual(fetch.calls[0].body, { refresh_token: 'stary' });
  assert.deepStrictEqual(session, EXPECTED_SESSION);
});

test('refresh: odrzucony token to błąd inny niż brak sieci', async () => {
  const rejected = fakeFetch({ ok: false, status: 400, body: { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' } });
  await rejectsWith(client(rejected).refresh(EXPECTED_SESSION), 'unknown', 'Coś poszło nie tak — spróbuj ponownie');
});

test('signOut wysyła token i nigdy nie rzuca', async () => {
  const fetch = fakeFetch({ ok: true, status: 204, body: undefined });
  await client(fetch).signOut(EXPECTED_SESSION);
  assert.strictEqual(fetch.calls[0].url, `${URL_BASE}/auth/v1/logout`);
  assert.strictEqual(fetch.calls[0].options.headers.Authorization, 'Bearer acc');
  const offline = async () => {
    throw new TypeError('Failed to fetch');
  };
  await client(offline).signOut(EXPECTED_SESSION);
});

test('needsRefresh i isSession', () => {
  assert.strictEqual(auth.needsRefresh(EXPECTED_SESSION, NOW), false);
  assert.strictEqual(auth.needsRefresh(EXPECTED_SESSION, EXPECTED_SESSION.expiresAt - 4 * 60 * 1000), true);
  assert.strictEqual(auth.needsRefresh(EXPECTED_SESSION, EXPECTED_SESSION.expiresAt + 1), true);
  assert.strictEqual(auth.isSession(EXPECTED_SESSION), true);
  assert.strictEqual(auth.isSession(null), false);
  assert.strictEqual(auth.isSession({ ...EXPECTED_SESSION, expiresAt: 'jutro' }), false);
  assert.strictEqual(auth.isSession({ ...EXPECTED_SESSION, username: undefined }), false);
});

test('chwilowa awaria serwera (5xx, 429) to jak brak sieci, nie odrzucenie sesji', async () => {
  for (const status of [500, 502, 503, 429]) {
    const fetch = fakeFetch({ ok: false, status, body: { msg: 'busy' } });
    await rejectsWith(client(fetch).refresh(EXPECTED_SESSION), 'network', 'Brak połączenia — spróbuj ponownie');
  }
});
