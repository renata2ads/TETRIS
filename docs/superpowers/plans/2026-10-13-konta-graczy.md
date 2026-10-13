# Kosmiczne Klocki — konta graczy (logowanie nazwą i hasłem) — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cel:** Gracz może założyć konto i logować się nazwą użytkownika i hasłem; stan gry zalogowanego jest na koncie (wznowienie na dowolnym urządzeniu), wyniki z konta mają ✓ w rankingu, a gra gościa przechodzi na konto po zalogowaniu. Gra jako gość działa dalej.

**Architektura:** Nowy moduł `src/auth.js` (czysta logika + wywołania Supabase Auth REST przez wstrzyknięty `fetch`), rozszerzenie `src/api.js` o zapis gry na koncie i wyniki z kontem, funkcja `transferAction` w `src/save.js`. Baza: nowa tabela `account_games` z RLS po `auth.uid()` i kolumna `user_id` w `scores`. `src/view.js` dostaje nakładki „Witaj!”, logowania i wyboru gry oraz przełącza magazyn zapisów (gość / konto).

**Technologie:** HTML, CSS, czysty JavaScript, Supabase Auth + PostgREST przez `fetch`, Node 24 `node:test`. Bez pakietów npm i bez `supabase-js`.

**Specyfikacja:** [docs/wymagania.md](../../wymagania.md), sekcja 8 (zaakceptowana 2026-10-13); sekcja 7 nadal obowiązuje dla gości. Poprzedni plan: [2026-10-13-zapis-wynikow-supabase.md](2026-10-13-zapis-wynikow-supabase.md).

## Global Constraints

- Adres: `https://opfakkxrhizsthrnnilv.supabase.co`; klucz publiczny: `sb_publishable_SxZaUzsyEByuF0ffjhduzg_zfpfd-ci` (z `src/config.js`). Nigdy klucza `service_role`.
- Nagłówki: zawsze `apikey: <klucz>`; dla zalogowanego dodatkowo `Authorization: Bearer <access_token>`. Bez tokenu — bez nagłówka `Authorization`.
- Nazwa użytkownika: po `trim()` i `toLowerCase()` musi pasować do `/^[a-z0-9_]{3,20}$/`. Techniczny e-mail: `<nazwa>@kosmiczne-klocki.local`.
- Hasło: co najmniej 6 znaków.
- Komunikaty (dokładnie): „Ta nazwa jest zajęta”, „Zła nazwa użytkownika lub hasło”, „Nazwa: 3–20 znaków, małe litery, cyfry i _”, „Hasło musi mieć co najmniej 6 znaków”, „Brak połączenia — spróbuj ponownie”, „Coś poszło nie tak — spróbuj ponownie”.
- Sesja w `localStorage` pod `kk.session` jako JSON `{ accessToken, refreshToken, expiresAt, userId, username }` (`expiresAt` w ms). Odświeżanie, gdy do wygaśnięcia zostało mniej niż 5 minut; sprawdzanie co 60 s i przed startem.
- Nakładka „Witaj!” pokazuje się na starcie zawsze, gdy gracz nie jest zalogowany (także powracającemu gościowi — „Graj jako gość” użyje zapamiętanego nicka bez pytania).
- Zalogowany: start od razu (pytanie „Wznowić grę?” jak w sekcji 7, gdy ma zapis).
- W rankingu wynik z kontem ma po nicku ` ✓`.
- Przeniesienie zapisu gościa: brak zapisu gościa → nic; jest zapis gościa, konto bez zapisu → przenieś bez pytania i zaproponuj wznowienie; oba mają zapis → „Którą grę zachować?”, druga usuwana.
- Gdy widać którąkolwiek nakładkę-okno (Witaj, nick, logowanie, wznowienie, wybór), gra nie tyka i klawisze nią nie sterują.
- Interfejs po polsku. Bez bibliotek. `game.js` i `pieces.js` bez zmian.
- Nie używać modelu Sonnet 5.5 (ani dla subagentów, ani dla recenzentów).
- **Żadnych operacji git bez wyraźnej prośby użytkowniczki.** Kroki „Commit” tylko na prośbę.
- **Task 3 wymaga działań użytkowniczki w panelu Supabase** (uruchomienie SQL, wyłączenie potwierdzania e-maila) — przed nim zatrzymaj się i poproś o to.

## Review Focus

1. **Wygasła sesja i nieudane odświeżenie** (np. gracz wraca po tygodniu, albo brak sieci w chwili odświeżania) — bez sieci gra działa dalej i próbuje później; odrzucony token (sesja unieważniona) → gracz wylogowany i widzi „Witaj!”, bez zawieszenia. Test: Task 1 (`refresh` — błąd sieci vs. odrzucenie, pole `code`); obsługa w Task 4, sprawdzenie ręczne nr 9.
2. **Nazwy użytkownika z „prawdziwego życia”** — „Ola” (→ `ola`), „ ola ”, „ol”, „ola!”, „żaba”, 21 znaków — zamiana na małe litery i jasny komunikat zamiast błędu serwera; zapytanie do serwera nie wychodzi. Test: Task 1.
3. **Supabase nadal wymaga potwierdzenia e-maila** (ustawienie nie zostało wyłączone) — rejestracja zwraca użytkownika bez sesji; gra pokazuje „Coś poszło nie tak — spróbuj ponownie” zamiast się wysypać. Test: Task 1; weryfikacja ustawienia w Task 3.
4. **Logowanie w trakcie gry gościa** — gość gra, klika „Zaloguj się”: gra pauzuje i zapisuje się jako gość, a po zalogowaniu przechodzi na konto (nie ginie). Test: Task 2 (`transferAction`); kod i sprawdzenie ręczne: Task 4 nr 6–7.
5. **Podrabianie ✓** — gość wysyła wynik z cudzym `user_id`, albo zalogowany wysyła wynik z cudzą nazwą — baza odrzuca. Test na żywej bazie: Task 3, krok 4.

---

## Struktura plików

| Plik | Odpowiedzialność |
|---|---|
| `src/auth.js` | nazwy użytkownika, sesja, `createAuth` (signup, login, odświeżanie, wylogowanie) |
| `src/api.js` | + zapis gry na koncie, wynik z kontem, flaga `verified` w rankingu |
| `src/save.js` | + `transferAction(guestSaved, accountSaved)` |
| `supabase/schema.sql` | + sekcja 3: `scores.user_id`, polityki wyników, tabela `account_games` |
| `src/view.js` | nakładki Witaj / logowanie / wybór gry, przycisk konta, magazyn zapisów gość/konto, odświeżanie sesji |
| `index.html`, `style.css` | nowe elementy i style |
| `tests/auth.test.js` | testy `auth.js` |
| `tests/api.test.js`, `tests/save.test.js` | nowe i zmienione testy |

---

### Task 1: Logowanie — `src/auth.js`

**Files:**
- Create: `src/auth.js`
- Test: `tests/auth.test.js`

**Interfaces:**
- Consumes: nic.
- Produces (w `module.exports` / `window.Tetris`):
  - `AuthError` (klasa, `extends Error`) z polem `code`: `'username' | 'password' | 'taken' | 'credentials' | 'network' | 'unknown'`; `message` = polski komunikat.
  - `normalizeUsername(text) → string | null`
  - `usernameToEmail(username) → string`, `usernameFromEmail(email) → string | null`
  - `needsRefresh(session, now: number) → boolean`
  - `isSession(value) → boolean`
  - `createAuth({ url, key, fetch, now? }) → { signUp(usernameText, password), signIn(usernameText, password), refresh(session), signOut(session) }` — pierwsze trzy zwracają `Promise<Session>`, `signOut` → `Promise<void>` i nigdy nie rzuca.
  - `Session = { accessToken, refreshToken, expiresAt, userId, username }`

- [ ] **Step 1: Napisz testy, które nie przechodzą — `tests/auth.test.js`**

```js
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
  const broken = fakeFetch({ ok: false, status: 500, body: undefined });
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
```

- [ ] **Step 2: Uruchom testy i sprawdź, że nie przechodzą**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/auth.js'`; pozostałe 51 testów przechodzi.

- [ ] **Step 3: Napisz `src/auth.js`**

```js
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
```

- [ ] **Step 4: Uruchom testy i sprawdź, że przechodzą**

Run: `npm test`
Expected: PASS — 64 testy, 0 błędów.

- [ ] **Step 5: Commit** (tylko na prośbę użytkowniczki)

```bash
git add src/auth.js tests/auth.test.js
git commit -m "Dodaj logowanie nazwą użytkownika i hasłem (Supabase Auth)"
```

---

### Task 2: Zapis gry na koncie, wynik z kontem, przeniesienie zapisu gościa

**Files:**
- Modify: `src/api.js`
- Modify: `src/save.js`
- Test: `tests/api.test.js`, `tests/save.test.js`

**Interfaces:**
- Consumes: `Session` z Task 1 (używane pola: `accessToken`, `userId`).
- Produces:
  - `api.submitScore(nick, score, session?)` — z sesją: wiersz z `user_id` i nagłówek `Authorization`.
  - `api.topScores(limit) → Array<{ nick, score, verified: boolean }>`
  - `api.loadAccountGame(session) → object | null`
  - `api.saveAccountGame(session, saved, options?: { keepalive })`
  - `api.deleteAccountGame(session)`
  - `save.transferAction(guestSaved, accountSaved) → 'none' | 'move' | 'ask'`

- [ ] **Step 1: Zmień test rankingu i dopisz nowe testy — `tests/api.test.js`**

Zastąp cały test `'topScores pobiera najlepsze wyniki malejąco z limitem'`:

```js
test('topScores pobiera najlepsze wyniki malejąco z limitem i oznacza wyniki z kontem', async () => {
  const rows = [
    { nick: 'ola', score: 800, user_id: 'user-1' },
    { nick: 'Jaś', score: 100, user_id: null },
  ];
  const fetch = fakeFetch({ ok: true, status: 200, body: rows });
  const result = await api(fetch).topScores(10);
  assert.strictEqual(
    fetch.calls[0].url,
    `${URL_BASE}/rest/v1/scores?select=nick,score,user_id&order=score.desc,created_at.asc&limit=10`
  );
  assert.strictEqual(fetch.calls[0].options.method, 'GET');
  assert.deepStrictEqual(result, [
    { nick: 'ola', score: 800, verified: true },
    { nick: 'Jaś', score: 100, verified: false },
  ]);
});
```

Dopisz na końcu pliku:

```js
const SESSION = { accessToken: 'acc', userId: 'user-1' };

test('submitScore z kontem wysyła user_id i token', async () => {
  const fetch = fakeFetch({ ok: true, status: 201, body: null });
  await api(fetch).submitScore('ola', 500, SESSION);
  const [call] = fetch.calls;
  assert.strictEqual(call.url, `${URL_BASE}/rest/v1/scores`);
  assert.strictEqual(call.options.headers.Authorization, 'Bearer acc');
  assert.deepStrictEqual(call.body, { nick: 'ola', score: 500, user_id: 'user-1' });
});

test('loadAccountGame czyta zapis konta albo zwraca null', async () => {
  const found = fakeFetch({ ok: true, status: 200, body: [{ state: { score: 7 } }] });
  assert.deepStrictEqual(await api(found).loadAccountGame(SESSION), { score: 7 });
  assert.strictEqual(found.calls[0].url, `${URL_BASE}/rest/v1/account_games?select=state&user_id=eq.user-1`);
  assert.strictEqual(found.calls[0].options.method, 'GET');
  assert.strictEqual(found.calls[0].options.headers.Authorization, 'Bearer acc');
  const empty = fakeFetch({ ok: true, status: 200, body: [] });
  assert.strictEqual(await api(empty).loadAccountGame(SESSION), null);
});

test('saveAccountGame zapisuje lub nadpisuje grę konta', async () => {
  const fetch = fakeFetch({ ok: true, status: 201, body: null });
  await api(fetch).saveAccountGame(SESSION, { score: 7 }, { keepalive: true });
  const [call] = fetch.calls;
  assert.strictEqual(call.url, `${URL_BASE}/rest/v1/account_games?on_conflict=user_id`);
  assert.strictEqual(call.options.method, 'POST');
  assert.strictEqual(call.options.keepalive, true);
  assert.strictEqual(call.options.headers.Authorization, 'Bearer acc');
  assert.strictEqual(call.options.headers.Prefer, 'resolution=merge-duplicates,return=minimal');
  assert.strictEqual(call.body.user_id, 'user-1');
  assert.deepStrictEqual(call.body.state, { score: 7 });
  assert.ok(!Number.isNaN(Date.parse(call.body.updated_at)));
});

test('deleteAccountGame usuwa grę konta', async () => {
  const fetch = fakeFetch({ ok: true, status: 204, body: null });
  await api(fetch).deleteAccountGame(SESSION);
  assert.strictEqual(fetch.calls[0].url, `${URL_BASE}/rest/v1/account_games?user_id=eq.user-1`);
  assert.strictEqual(fetch.calls[0].options.method, 'DELETE');
  assert.strictEqual(fetch.calls[0].options.headers.Authorization, 'Bearer acc');
});
```

- [ ] **Step 2: Dopisz test na końcu `tests/save.test.js`**

```js
test('transferAction: co zrobić z grą gościa po zalogowaniu', () => {
  const game1 = { score: 1 };
  const game2 = { score: 2 };
  assert.strictEqual(save.transferAction(null, null), 'none');
  assert.strictEqual(save.transferAction(null, game2), 'none');
  assert.strictEqual(save.transferAction(game1, null), 'move');
  assert.strictEqual(save.transferAction(game1, game2), 'ask');
});
```

- [ ] **Step 3: Uruchom testy i sprawdź, że nie przechodzą**

Run: `npm test`
Expected: FAIL — m.in. `api(...).loadAccountGame is not a function`, `save.transferAction is not a function`, różnica w adresie i wyniku `topScores`. Test „submitScore dodaje wiersz… z kluczem apikey” nadal przechodzi.

- [ ] **Step 4: Zastąp całe `src/api.js`**

```js
(function (exports) {
  'use strict';

  function createApi({ url, key, fetch }) {
    const base = `${url}/rest/v1`;

    async function request(path, { method = 'POST', body, keepalive = false, session, prefer } = {}) {
      const headers = { apikey: key, 'Content-Type': 'application/json' };
      if (session) headers.Authorization = `Bearer ${session.accessToken}`;
      if (prefer) headers.Prefer = prefer;
      const response = await fetch(`${base}${path}`, {
        method,
        keepalive,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`Supabase: błąd ${response.status}`);
      return response;
    }

    async function submitScore(nick, score, session) {
      const body = session ? { nick, score, user_id: session.userId } : { nick, score };
      await request('/scores', { body, session });
    }

    async function topScores(limit) {
      const query = `select=nick,score,user_id&order=score.desc,created_at.asc&limit=${limit}`;
      const response = await request(`/scores?${query}`, { method: 'GET' });
      const rows = await response.json();
      return rows.map((row) => ({ nick: row.nick, score: row.score, verified: row.user_id !== null }));
    }

    async function saveGame(playerId, nick, saved, options = {}) {
      await request('/rpc/save_game', {
        body: { p_player_id: playerId, p_nick: nick, p_state: saved },
        keepalive: Boolean(options.keepalive),
      });
    }

    async function loadGame(playerId) {
      const response = await request('/rpc/load_game', { body: { p_player_id: playerId } });
      const saved = await response.json();
      return saved === undefined ? null : saved;
    }

    async function deleteGame(playerId) {
      await request('/rpc/delete_game', { body: { p_player_id: playerId } });
    }

    async function loadAccountGame(session) {
      const response = await request(`/account_games?select=state&user_id=eq.${session.userId}`, {
        method: 'GET',
        session,
      });
      const rows = await response.json();
      return rows.length > 0 ? rows[0].state : null;
    }

    async function saveAccountGame(session, saved, options = {}) {
      await request('/account_games?on_conflict=user_id', {
        body: { user_id: session.userId, state: saved, updated_at: new Date().toISOString() },
        keepalive: Boolean(options.keepalive),
        session,
        prefer: 'resolution=merge-duplicates,return=minimal',
      });
    }

    async function deleteAccountGame(session) {
      await request(`/account_games?user_id=eq.${session.userId}`, { method: 'DELETE', session });
    }

    return {
      submitScore,
      topScores,
      saveGame,
      loadGame,
      deleteGame,
      loadAccountGame,
      saveAccountGame,
      deleteAccountGame,
    };
  }

  Object.assign(exports, { createApi });
})(typeof module !== 'undefined' ? module.exports : window.Tetris);
```

- [ ] **Step 5: Dopisz `transferAction` w `src/save.js`**

Wstaw przed linią `Object.assign(exports, …)`:

```js
  // Co zrobić z przerwaną grą gościa po zalogowaniu (sekcja 8 wymagań).
  function transferAction(guestSaved, accountSaved) {
    if (!guestSaved) return 'none';
    return accountSaved ? 'ask' : 'move';
  }
```

Zmień eksport na:

```js
  Object.assign(exports, { serializeGame, restoreGame, normalizeNick, shouldSave, transferAction });
```

- [ ] **Step 6: Uruchom testy i sprawdź, że przechodzą**

Run: `npm test`
Expected: PASS — 69 testów, 0 błędów.

- [ ] **Step 7: Commit** (tylko na prośbę użytkowniczki)

```bash
git add src/api.js src/save.js tests/api.test.js tests/save.test.js
git commit -m "Dodaj zapis gry na koncie i wyniki z kontem"
```

---

### Task 3: Baza — tabela gier kont i wyniki z kontem (z udziałem użytkowniczki)

**Files:**
- Modify: `supabase/schema.sql` (dopisanie sekcji 3 na końcu)

**Interfaces:**
- Consumes: nazwy kolumn i adresy używane w Task 2 (`account_games.user_id`, `account_games.state`, `account_games.updated_at`, `scores.user_id`).
- Produces: działająca baza dla Task 4.

- [ ] **Step 1: Dopisz na końcu `supabase/schema.sql`**

```sql

-- =====================================================================
-- 3. Konta graczy (logowanie)
-- =====================================================================

-- Wynik z kontem ma user_id; wynik gościa — null.
alter table public.scores
  add column if not exists user_id uuid references auth.users (id) on delete set null;

-- Gość (i zalogowany grający bez konta) dodaje wynik tylko bez user_id.
drop policy if exists "scores_insert" on public.scores;
drop policy if exists "scores_insert_guest" on public.scores;
create policy "scores_insert_guest" on public.scores
  for insert to anon, authenticated
  with check (user_id is null);

-- Wynik z kontem: tylko własne user_id i nick równy nazwie użytkownika z tokenu.
drop policy if exists "scores_insert_account" on public.scores;
create policy "scores_insert_account" on public.scores
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and nick = split_part((select auth.jwt()) ->> 'email', '@', 1)
  );

-- Zapisana gra zalogowanego — jedna na konto, dostęp tylko z jego tokenem.
create table if not exists public.account_games (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  state      jsonb       not null
             check (pg_column_size(state) <= 4096 and jsonb_typeof(state -> 'board') = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.account_games enable row level security;

drop policy if exists "account_games_select" on public.account_games;
create policy "account_games_select" on public.account_games
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "account_games_insert" on public.account_games;
create policy "account_games_insert" on public.account_games
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "account_games_update" on public.account_games;
create policy "account_games_update" on public.account_games
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "account_games_delete" on public.account_games;
create policy "account_games_delete" on public.account_games
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.account_games to authenticated;
```

- [ ] **Step 2: STOP — poproś użytkowniczkę o dwie czynności w panelu Supabase**

Przekaż dokładnie:
1. **Wyłącz potwierdzanie e-maila:** Supabase → projekt → **Authentication** → **Sign In / Providers** (w starszym panelu: *Providers*) → **Email** → wyłącz **Confirm email** → **Save**. Upewnij się, że **Enable Email provider** jest włączone.
2. **Uruchom skrypt:** SQL Editor → New query → wklej całe `supabase/schema.sql` → Run → oczekiwany komunikat „Success. No rows returned” (przy pytaniu o operację niszczącą: „Run this query”).

Poczekaj na potwierdzenie.

- [ ] **Step 3: Sprawdź rejestrację i logowanie na żywej bazie (konto testowe `kk_test1`)**

Run (Git Bash):
```bash
K=sb_publishable_SxZaUzsyEByuF0ffjhduzg_zfpfd-ci; U=https://opfakkxrhizsthrnnilv.supabase.co
BODY='{"email":"kk_test1@kosmiczne-klocki.local","password":"test123456"}'
R=$(curl -s "$U/auth/v1/signup" -H "apikey: $K" -H "Content-Type: application/json" -d "$BODY")
echo "$R" | grep -q access_token || R=$(curl -s "$U/auth/v1/token?grant_type=password" -H "apikey: $K" -H "Content-Type: application/json" -d "$BODY")
TOKEN=$(echo "$R" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.access_token||'BRAK')})")
USERID=$(echo "$R" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.user?j.user.id:'BRAK')})")
echo "token: ${TOKEN:0:12}…  user: $USERID"; [ "$TOKEN" = BRAK ] && echo "$R"
echo "$TOKEN" > /tmp/kk_token; echo "$USERID" > /tmp/kk_uid
```
Expected: `token: eyJ…  user: <uuid>`.
Jeśli odpowiedź to błąd formatu adresu e-mail (np. `email_address_invalid`) — zmień `EMAIL_DOMAIN` w `src/auth.js` i oczekiwania w `tests/auth.test.js` na `kosmiczne-klocki.example.com`, zanotuj w ledgerze `Ruling:` i powtórz krok. Jeśli odpowiedź nie ma `access_token`, a jest użytkownik — potwierdzanie e-maila jest nadal włączone: wróć do Step 2.

- [ ] **Step 4: Sprawdź zabezpieczenia na żywej bazie**

Run (Git Bash):
```bash
K=sb_publishable_SxZaUzsyEByuF0ffjhduzg_zfpfd-ci; U=https://opfakkxrhizsthrnnilv.supabase.co/rest/v1
TOKEN=$(cat /tmp/kk_token); USERID=$(cat /tmp/kk_uid)
H=(-H "apikey: $K" -H "Content-Type: application/json")
A=(-H "Authorization: Bearer $TOKEN")
echo "a) zapis gry konta:";        curl -s -o /dev/null -w "%{http_code}\n" "${H[@]}" "${A[@]}" -H "Prefer: resolution=merge-duplicates,return=minimal" -X POST "$U/account_games?on_conflict=user_id" -d "{\"user_id\":\"$USERID\",\"state\":{\"board\":[],\"score\":1}}"
echo "b) odczyt z tokenem:";       curl -s "${H[@]}" "${A[@]}" "$U/account_games?select=state&user_id=eq.$USERID"; echo
echo "c) odczyt bez tokenu:";      curl -s "${H[@]}" "$U/account_games?select=state"; echo
echo "d) za duży zapis:";          curl -s -o /dev/null -w "%{http_code}\n" "${H[@]}" "${A[@]}" -H "Prefer: resolution=merge-duplicates,return=minimal" -X POST "$U/account_games?on_conflict=user_id" -d "{\"user_id\":\"$USERID\",\"state\":{\"board\":[],\"x\":\"$(printf 'a%.0s' $(seq 1 5000))\"}}"
echo "e) gość z cudzym user_id:";  curl -s -o /dev/null -w "%{http_code}\n" "${H[@]}" -X POST "$U/scores" -d "{\"nick\":\"kk_test1\",\"score\":1,\"user_id\":\"$USERID\"}"
echo "f) konto z cudzą nazwą:";    curl -s -o /dev/null -w "%{http_code}\n" "${H[@]}" "${A[@]}" -X POST "$U/scores" -d "{\"nick\":\"ktos_inny\",\"score\":1,\"user_id\":\"$USERID\"}"
echo "g) ranking ma user_id:";     curl -s "${H[@]}" "$U/scores?select=nick,score,user_id&limit=1"; echo
echo "h) sprzątanie zapisu konta:"; curl -s -o /dev/null -w "%{http_code}\n" "${H[@]}" "${A[@]}" -X DELETE "$U/account_games?user_id=eq.$USERID"
```
Expected:
- a) `201`
- b) `[{"state":{"board":[],"score":1}}]` (kolejność kluczy może się różnić)
- c) `[]`
- d) `400` (naruszenie `check`)
- e) `401` lub `403` (RLS)
- f) `403` (RLS)
- g) lista JSON (może być `[]`) — bez błędu o nieznanej kolumnie
- h) `204`

Prawdziwego wyniku z kontem nie wpisujemy tutaj (zostałby w rankingu); sprawdza go Task 4.

- [ ] **Step 5: Commit** (tylko na prośbę użytkowniczki)

```bash
git add supabase/schema.sql
git commit -m "Dodaj w bazie gry kont i wyniki z kontem"
```

---

### Task 4: Strona — Witaj, logowanie, wybór gry, przycisk konta

**Files:**
- Modify: `index.html`
- Modify: `style.css` (dopisanie na końcu)
- Modify: `src/view.js` (pełna nowa wersja)

**Interfaces:**
- Consumes (z `window.Tetris`): gra (`createGame`, `moveLeft`, `moveRight`, `rotate`, `tick`, `togglePause`, `getCells`, `COLS`); `serializeGame`, `restoreGame`, `normalizeNick`, `shouldSave`, `transferAction` (save); `createApi` (api, Task 2); `createAuth`, `AuthError`, `needsRefresh`, `isSession` (Task 1); `config`.
- Produces: grywalna strona z kontami.

Warstwa DOM — sprawdzana ręcznie (bot Playwright). Testy automatyczne muszą nadal przechodzić.

- [ ] **Step 1: Zmień `index.html`**

W `<div class="board-wrap">`, po `resume-overlay`, dodaj:

```html
        <div id="welcome-overlay" class="overlay" hidden>
          <p class="overlay-title">Witaj!</p>
          <div class="buttons buttons--column">
            <button id="welcome-guest" type="button">Graj jako gość</button>
            <button id="welcome-login" type="button" class="secondary">Zaloguj się</button>
            <button id="welcome-signup" type="button" class="secondary">Załóż konto</button>
          </div>
        </div>
        <div id="auth-overlay" class="overlay" hidden>
          <p id="auth-title" class="overlay-title">Zaloguj się</p>
          <form id="auth-form" class="nick-form">
            <label for="auth-user">Nazwa użytkownika</label>
            <input id="auth-user" type="text" maxlength="20" autocomplete="username" autocapitalize="none" spellcheck="false" required />
            <label for="auth-pass">Hasło</label>
            <input id="auth-pass" type="password" autocomplete="current-password" required />
            <p id="auth-error" class="auth-error" role="alert"></p>
            <div class="buttons">
              <button id="auth-submit" type="submit">Zaloguj się</button>
              <button id="auth-back" type="button" class="secondary">Wróć</button>
            </div>
          </form>
        </div>
        <div id="choose-overlay" class="overlay" hidden>
          <p class="overlay-title">Którą grę zachować?</p>
          <div class="buttons buttons--column">
            <button id="choose-guest" type="button">Grę gościa: <span id="choose-guest-score">0</span> pkt</button>
            <button id="choose-account" type="button">Grę z konta: <span id="choose-account-score">0</span> pkt</button>
          </div>
          <p>Druga gra zostanie usunięta.</p>
        </div>
```

W panelu, bezpośrednio po `<p id="player" class="player"></p>`, dodaj:

```html
        <button id="account-button" type="button" class="secondary small" hidden>Zaloguj się</button>
```

Po `<script src="src/api.js"></script>` dodaj:

```html
    <script src="src/auth.js"></script>
```

- [ ] **Step 2: Dopisz na końcu `style.css`**

```css
.buttons--column {
  flex-direction: column;
  align-items: stretch;
}

.auth-error {
  min-height: 1.3em;
  margin: 0;
  color: #ff9a9a;
}

button.small {
  margin-top: 8px;
  padding: 6px 12px;
  font-size: 0.9rem;
}

button:disabled {
  opacity: 0.6;
  cursor: wait;
}

button[hidden] {
  display: none;
}
```

- [ ] **Step 3: Zastąp całe `src/view.js`**

```js
(function () {
  'use strict';

  const T = window.Tetris;
  const { createGame, moveLeft, moveRight, rotate, tick, togglePause, getCells, COLS } = T;
  const { serializeGame, restoreGame, normalizeNick, shouldSave, transferAction } = T;
  const { AuthError, needsRefresh, isSession } = T;
  const TICK_MS = 1000;
  const RANKING_SIZE = 10;
  const ERROR_MS = 3000;
  const SESSION_CHECK_MS = 60 * 1000;

  const fetchFn = window.fetch.bind(window);
  const api = T.createApi({ url: T.config.url, key: T.config.key, fetch: fetchFn });
  const auth = T.createAuth({ url: T.config.url, key: T.config.key, fetch: fetchFn });

  const $ = (id) => document.getElementById(id);
  const boardEl = $('board');
  const scoreEl = $('score');
  const finalScoreEl = $('final-score');
  const pauseOverlay = $('pause-overlay');
  const overOverlay = $('over-overlay');
  const nickOverlay = $('nick-overlay');
  const resumeOverlay = $('resume-overlay');
  const welcomeOverlay = $('welcome-overlay');
  const authOverlay = $('auth-overlay');
  const chooseOverlay = $('choose-overlay');
  const restartButton = $('restart');
  const nickForm = $('nick-form');
  const nickInput = $('nick-input');
  const resumeScoreEl = $('resume-score');
  const authForm = $('auth-form');
  const authTitle = $('auth-title');
  const authUser = $('auth-user');
  const authPass = $('auth-pass');
  const authSubmit = $('auth-submit');
  const authError = $('auth-error');
  const playerEl = $('player');
  const accountButton = $('account-button');
  const rankingEl = $('ranking');
  const saveErrorEl = $('save-error');

  // Okna, przy których gra stoi, a klawisze nie sterują planszą.
  const MODALS = [welcomeOverlay, nickOverlay, authOverlay, resumeOverlay, chooseOverlay];
  const modalOpen = () => MODALS.some((el) => !el.hidden);
  function showOnly(el) {
    MODALS.forEach((modal) => {
      modal.hidden = modal !== el;
    });
  }

  // --- Pamięć przeglądarki (może być niedostępna — wtedy działamy bez niej) ---
  function readStorage(name) {
    try {
      return localStorage.getItem(name);
    } catch (e) {
      return null;
    }
  }

  function writeStorage(name, value) {
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      /* brak pamięci — trudno */
    }
  }

  function removeStorage(name) {
    try {
      localStorage.removeItem(name);
    } catch (e) {
      /* brak pamięci — trudno */
    }
  }

  let playerId = readStorage('kk.playerId');
  if (!playerId) {
    playerId = crypto.randomUUID();
    writeStorage('kk.playerId', playerId);
  }
  let nick = normalizeNick(readStorage('kk.nick'));

  function loadSession() {
    try {
      const value = JSON.parse(readStorage('kk.session'));
      return isSession(value) ? value : null;
    } catch (e) {
      return null;
    }
  }

  let session = loadSession();
  function storeSession(next) {
    session = next;
    if (next) writeStorage('kk.session', JSON.stringify(next));
    else removeStorage('kk.session');
  }

  const playerName = () => (session ? session.username : nick);

  // --- Plansza ---
  const cellEls = [];
  for (let i = 0; i < 200; i++) {
    const el = document.createElement('div');
    el.className = 'cell';
    boardEl.appendChild(el);
    cellEls.push(el);
  }

  // null = gra jeszcze nie wystartowała.
  let state = null;

  function render() {
    if (state) {
      getCells(state).forEach((row, r) => {
        row.forEach((type, c) => {
          cellEls[r * COLS + c].className = type ? `cell cell--${type}` : 'cell';
        });
      });
      scoreEl.textContent = state.score;
      finalScoreEl.textContent = state.score;
    } else {
      cellEls.forEach((el) => {
        el.className = 'cell';
      });
      scoreEl.textContent = 0;
    }
    pauseOverlay.hidden = !state || state.status !== 'paused';
    overOverlay.hidden = !state || state.status !== 'over';
    if (session) playerEl.textContent = `Gracz: ${session.username} ✓`;
    else playerEl.textContent = nick && state ? `Gracz: ${nick}` : '';
    accountButton.hidden = !session && !state;
    accountButton.textContent = session ? 'Wyloguj' : 'Zaloguj się';
  }

  // --- Zapisy w bazie ---
  let errorTimer = null;
  function showSaveError() {
    saveErrorEl.hidden = false;
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => {
      saveErrorEl.hidden = true;
    }, ERROR_MS);
  }

  // Zapisy i usunięcia idą do bazy po kolei — spóźniony zapis nie może
  // nadpisać późniejszego usunięcia (i przywrócić skończonej gry).
  let queue = Promise.resolve();
  function inOrder(task) {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  }

  function guestStore() {
    return {
      load: () => api.loadGame(playerId),
      save: (saved, options) => api.saveGame(playerId, nick, saved, options),
      remove: () => api.deleteGame(playerId),
    };
  }

  // Magazyn bieżącego gracza; sesja zapamiętana w chwili wywołania.
  function store() {
    if (!session) return guestStore();
    const s = session;
    return {
      load: () => api.loadAccountGame(s),
      save: (saved, options) => api.saveAccountGame(s, saved, options),
      remove: () => api.deleteAccountGame(s),
    };
  }

  function saveState(keepalive) {
    if (!playerName() || !shouldSave(state)) return;
    const saved = serializeGame(state);
    const target = store();
    inOrder(() => target.save(saved, { keepalive })).catch(showSaveError);
  }

  function renderRanking(rows) {
    rankingEl.replaceChildren(
      ...rows.map((row) => {
        const li = document.createElement('li');
        const points = document.createElement('span');
        points.textContent = row.score;
        li.append(row.verified ? `${row.nick} ✓` : row.nick, points);
        return li;
      })
    );
  }

  function refreshRanking() {
    api.topScores(RANKING_SIZE).then(renderRanking).catch(() => {});
  }

  function onGameOver(finalState) {
    const target = store();
    inOrder(() => target.remove()).catch(() => {});
    api.submitScore(playerName(), finalState.score, session).then(refreshRanking).catch(showSaveError);
  }

  // --- Zmiany stanu ---
  function update(next) {
    if (next === state) return;
    const previous = state;
    state = next;
    render();
    if (previous && previous.status !== 'over' && state && state.status === 'over') onGameOver(state);
    if (previous && previous.status === 'playing' && state && state.status === 'paused') saveState(false);
  }

  function pauseIfPlaying() {
    if (state && state.status === 'playing') update(togglePause(state));
  }

  function startNewGame() {
    const target = store();
    inOrder(() => target.remove()).catch(() => {});
    showOnly(null);
    update(createGame(Math.random));
  }

  async function loadSaved(target) {
    try {
      return restoreGame(await target.load(), Math.random);
    } catch (e) {
      return null;
    }
  }

  function offerResume(saved) {
    resumeScoreEl.textContent = saved.score;
    showOnly(resumeOverlay);
    $('resume-yes').onclick = () => {
      showOnly(null);
      update(saved);
    };
    $('resume-no').onclick = startNewGame;
  }

  // Start gry bieżącego gracza: zapis → pytanie o wznowienie, brak zapisu → nowa gra.
  async function begin() {
    const saved = await loadSaved(store());
    if (saved) offerResume(saved);
    else {
      showOnly(null);
      update(createGame(Math.random));
    }
  }

  // Po zalogowaniu / założeniu konta: przeniesienie gry gościa (sekcja 8).
  async function beginAccount() {
    await queue; // najpierw dokończ zapisy gościa
    const guestSaved = await loadSaved(guestStore());
    const accountSaved = await loadSaved(store());
    const action = transferAction(guestSaved, accountSaved);
    const target = store();
    if (action === 'move') {
      inOrder(() => target.save(serializeGame(guestSaved))).catch(showSaveError);
      inOrder(() => guestStore().remove()).catch(() => {});
      offerResume(guestSaved);
    } else if (action === 'ask') {
      $('choose-guest-score').textContent = guestSaved.score;
      $('choose-account-score').textContent = accountSaved.score;
      showOnly(chooseOverlay);
      $('choose-guest').onclick = () => {
        inOrder(() => target.save(serializeGame(guestSaved))).catch(showSaveError);
        inOrder(() => guestStore().remove()).catch(() => {});
        showOnly(null);
        update(guestSaved);
      };
      $('choose-account').onclick = () => {
        inOrder(() => guestStore().remove()).catch(() => {});
        showOnly(null);
        update(accountSaved);
      };
    } else if (accountSaved) {
      offerResume(accountSaved);
    } else {
      showOnly(null);
      update(createGame(Math.random));
    }
  }

  // --- Witaj: gość / logowanie / konto ---
  function askNick() {
    showOnly(nickOverlay);
    nickInput.value = '';
    nickInput.focus();
  }

  let authMode = 'login';
  function openAuth(mode) {
    authMode = mode;
    const label = mode === 'login' ? 'Zaloguj się' : 'Załóż konto';
    authTitle.textContent = label;
    authSubmit.textContent = label;
    authError.textContent = '';
    authUser.value = '';
    authPass.value = '';
    authPass.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    showOnly(authOverlay);
    authUser.focus();
  }

  $('welcome-guest').addEventListener('click', () => {
    if (nick) begin();
    else askNick();
  });
  $('welcome-login').addEventListener('click', () => openAuth('login'));
  $('welcome-signup').addEventListener('click', () => openAuth('signup'));

  $('auth-back').addEventListener('click', () => {
    showOnly(state ? null : welcomeOverlay);
  });

  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    authSubmit.disabled = true;
    authError.textContent = '';
    try {
      const next =
        authMode === 'login'
          ? await auth.signIn(authUser.value, authPass.value)
          : await auth.signUp(authUser.value, authPass.value);
      authPass.value = '';
      storeSession(next);
      render();
      await beginAccount();
    } catch (e) {
      authError.textContent = e instanceof AuthError ? e.message : 'Coś poszło nie tak — spróbuj ponownie';
    } finally {
      authSubmit.disabled = false;
    }
  });

  nickForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = normalizeNick(nickInput.value);
    if (!value) return;
    nick = value;
    writeStorage('kk.nick', nick);
    nickInput.blur();
    begin();
  });

  async function logout() {
    pauseIfPlaying(); // zapis na koncie
    await queue;
    const old = session;
    storeSession(null);
    auth.signOut(old);
    state = null;
    showOnly(welcomeOverlay);
    render();
  }

  accountButton.addEventListener('click', () => {
    accountButton.blur();
    if (session) {
      logout();
    } else {
      pauseIfPlaying(); // zapis gościa przed logowaniem
      openAuth('login');
    }
  });

  // --- Sesja: odświeżanie przed wygaśnięciem ---
  async function ensureSession() {
    if (!session || !needsRefresh(session, Date.now())) return;
    try {
      storeSession(await auth.refresh(session));
    } catch (e) {
      if (e instanceof AuthError && e.code === 'network') return; // spróbujemy później
      storeSession(null); // sesja unieważniona — wyloguj
      state = null;
      showOnly(welcomeOverlay);
      render();
    }
  }

  // --- Klawiatura ---
  const ACTIONS = {
    ArrowLeft: moveLeft,
    ArrowRight: moveRight,
    ArrowDown: tick,
    ' ': rotate,
    p: togglePause,
    P: togglePause,
  };

  document.addEventListener('keydown', (event) => {
    // Podczas wpisywania i przy otwartych oknach klawisze nie sterują grą.
    if (event.target instanceof HTMLInputElement) return;
    if (!state || modalOpen()) return;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      return;
    }
    const action = ACTIONS[event.key];
    if (!action) return;
    event.preventDefault();
    if (action === togglePause && event.repeat) return;
    update(action(state));
  });

  restartButton.addEventListener('click', () => {
    update(createGame(Math.random));
    restartButton.blur();
  });

  // --- Zapis przy ukryciu / zamknięciu karty ---
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveState(true);
  });
  window.addEventListener('pagehide', () => saveState(true));

  // Jeden zegar gry na całe życie strony.
  setInterval(() => {
    if (state && !modalOpen()) update(tick(state));
  }, TICK_MS);
  setInterval(ensureSession, SESSION_CHECK_MS);

  render();
  refreshRanking();
  if (session) {
    ensureSession().then(() => {
      if (session) begin();
    });
  } else {
    showOnly(welcomeOverlay);
  }
})();
```

- [ ] **Step 4: Uruchom testy automatyczne**

Run: `npm test`
Expected: PASS — 69 testów, 0 błędów.

- [ ] **Step 5: Sprawdź ręcznie (bot Playwright) przez lokalny serwer**

Run (PowerShell, w tle): `python -m http.server 8766 --bind 127.0.0.1`; otwórz `http://127.0.0.1:8766/` z czystym `localStorage`. Konta testowe: `kk_test1` / `test123456` (z Task 3), `kk_test2` / `test123456` (zakładane tutaj).

Sprawdź i zanotuj:
1. Start bez sesji: „Witaj!” z trzema przyciskami; gra nie tyka; konsola bez błędów (poza `favicon.ico`).
2. „Załóż konto” z nazwą „ol” → „Nazwa: 3–20 znaków, małe litery, cyfry i _”; z hasłem „123” → „Hasło musi mieć co najmniej 6 znaków”; „Wróć” wraca do „Witaj!”.
3. „Załóż konto” jako `kk_test1` → „Ta nazwa jest zajęta”.
4. „Zaloguj się” `kk_test1` / złe hasło → „Zła nazwa użytkownika lub hasło”; z dobrym hasłem → gra startuje, panel „Gracz: kk_test1 ✓”, przycisk „Wyloguj”.
5. P → w bazie zapis w `account_games` (sprawdź `api.loadAccountGame` w konsoli albo Table Editor). Odśwież → bez „Witaj!”, od razu „Wznowić grę?”.
6. „Wyloguj” → „Witaj!”, plansza pusta. „Graj jako gość” (nick „Gość1”), zagraj, kliknij w panelu „Zaloguj się” → gra pauzuje; zaloguj `kk_test1` → konto ma zapis z p. 5, gość też → „Którą grę zachować?” z oboma wynikami; wybierz grę gościa → plansza gościa w pauzie; zapis gościa w bazie znika (`load_game` → `null`).
7. Wyloguj, zagraj jako gość z zapisem (P), zaloguj się nowym kontem `kk_test2` („Załóż konto”) → bez pytania „Którą grę…”, od razu „Wznowić grę?” z wynikiem gościa; zapis gościa znika, zapis konta istnieje.
8. Zakończ grę na koncie (game over) → w rankingu `kk_test2 ✓`; zapis konta znika.
9. Sesja: w konsoli ustaw `localStorage['kk.session']` z `expiresAt: 0` i odśwież → sesja odświeżona (nowy `expiresAt` w przyszłości), gra startuje. Ustaw `refreshToken: 'zly'` i `expiresAt: 0`, odśwież → „Witaj!” (wylogowano), bez błędów.
10. Druga przeglądarka (nowy kontekst, czysty `localStorage`): zaloguj `kk_test1` → „Wznowić grę?” z zapisem z innego urządzenia (gdy istnieje).
11. Podczas „Witaj!”, formularza i „Którą grę…” klawisze strzałek, spacja i P nie zmieniają planszy.

Po sprawdzeniu poproś użytkowniczkę o usunięcie w Supabase: kont testowych `kk_test1`, `kk_test2` (Authentication → Users) i wierszy testowych w `scores`.

- [ ] **Step 6: Commit** (tylko na prośbę użytkowniczki)

```bash
git add index.html style.css src/view.js
git commit -m "Dodaj ekran logowania, konta graczy i przeniesienie gry gościa"
```
