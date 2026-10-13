# Kosmiczne Klocki — zapis wyników i wznawianie gry (Supabase) — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cel:** Gra zapisuje wyniki zakończonych rozgrywek i stan przerwanej gry w Supabase, pokazuje 10 najlepszych wyników i pozwala wznowić przerwaną grę na tym samym urządzeniu.

**Architektura:** Dwa nowe moduły logiki bez DOM, w tym samym wzorcu co `pieces.js` / `game.js` (w przeglądarce `window.Tetris`, w Node `module.exports`): `src/save.js` (zamiana stanu gry na zapis i z powrotem, nick, decyzja „czy zapisać”) i `src/api.js` (wywołania REST Supabase przez wstrzyknięty `fetch`). Oba testowane w Node. `src/view.js` dostaje nakładki (nick, „Wznowić grę?”), ranking i obsługę zdarzeń zapisu; sprawdzany ręcznie. Baza jest już założona skryptem `supabase/schema.sql`.

**Technologie:** HTML, CSS, czysty JavaScript, Supabase REST API (PostgREST) przez `fetch`, Node 24 `node:test`. Bez pakietów npm i bez `supabase-js`.

**Specyfikacja:** [docs/wymagania.md](../../wymagania.md), sekcja 7 (zaakceptowana przez użytkowniczkę 2026-10-13). Schemat bazy: [supabase/schema.sql](../../../supabase/schema.sql).

## Global Constraints

- Adres projektu: `https://opfakkxrhizsthrnnilv.supabase.co`; klucz publiczny: `sb_publishable_SxZaUzsyEByuF0ffjhduzg_zfpfd-ci`. Nigdy nie używać klucza `service_role`.
- Nagłówek uwierzytelnienia: tylko `apikey: <klucz>` (klucz publishable nie jest JWT — nie wysyłać `Authorization: Bearer`).
- Tabela `scores(nick, score, created_at)` — odczyt i dodawanie przez REST. Tabela `saved_games` — wyłącznie przez RPC: `save_game(p_player_id uuid, p_nick text, p_state jsonb)`, `load_game(p_player_id uuid) → jsonb|null`, `delete_game(p_player_id uuid)`.
- Nick: 1–20 znaków po obcięciu spacji. Wyświetlany wyłącznie przez `textContent`.
- Identyfikator gracza: UUID (`crypto.randomUUID()`) w `localStorage` pod kluczem `kk.playerId`; nick pod `kk.nick`. Każdy dostęp do `localStorage` w `try/catch`.
- Wynik zapisuje się raz po przejściu gry w `over`; wtedy też usuwa się zapis gry.
- Stan gry zapisuje się przy przejściu w pauzę oraz przy `visibilitychange` (ukrycie karty) i `pagehide` — tylko w statusie `playing` lub `paused`. Przy zamykaniu karty `fetch` z `keepalive: true`.
- Wznowiona gra startuje w statusie `paused`.
- Gdy zapis się nie uda: gra działa dalej, przez 3 s widać komunikat „Nie udało się zapisać”.
- Ranking: 10 najlepszych wyników (malejąco po `score`), nick + punkty, obok planszy.
- Interfejs po polsku. Bez bibliotek. Logika gry (`game.js`) bez zmian.
- Nie używać modelu Sonnet 5.5 (ani dla subagentów, ani dla recenzentów).
- **Żadnych operacji git bez wyraźnej prośby użytkowniczki.** Kroki „Commit” wykonujemy tylko na prośbę; w przeciwnym razie zgłaszamy, że zmiany czekają na commit.

## Review Focus

1. **Brak sieci lub błąd Supabase** (np. 500, timeout) — gra działa dalej, pokazuje „Nie udało się zapisać”, nie rzuca nieobsłużonego wyjątku. Test: Task 2 (`api` rzuca przy `!ok`), obsługa w Task 3, sprawdzenie ręczne nr 8.
2. **Uszkodzony lub niepasujący zapis w bazie** (zła plansza, nieznany klocek, ujemny wynik) — `restoreGame` zwraca `null` i gra startuje od nowa zamiast się wysypać. Test: Task 1.
3. **Dziwny nick** (same spacje, 50 znaków, `<b>`) — spacje obcięte, puste odrzucone, długi skrócony do 20, HTML wyświetlony jako tekst. Test: Task 1; `textContent` w Task 3.
4. **Zamknięcie karty po game over** — nie może powstać zapis gry ze stanem `over` (wznowienie martwej gry). Test: Task 1 (`shouldSave`).
5. **Klawisze podczas wpisywania nicka** — spacja, strzałki i P w polu tekstowym nie sterują grą ani nie pauzują jej. Kod i sprawdzenie ręczne: Task 3.

---

## Struktura plików

| Plik | Odpowiedzialność |
|---|---|
| `src/config.js` | adres i klucz publiczny Supabase |
| `src/save.js` | `serializeGame`, `restoreGame`, `normalizeNick`, `shouldSave` — czysta logika |
| `src/api.js` | `createApi({ url, key, fetch })` → wywołania REST/RPC Supabase |
| `src/view.js` | nakładki nicka i wznowienia, ranking, zapisy przy pauzie / zamknięciu / game over |
| `index.html` | nowe elementy i skrypty w kolejności pieces → game → save → api → config → view |
| `style.css` | style nakładek, formularza, rankingu i komunikatu |
| `tests/save.test.js` | testy `save.js` |
| `tests/api.test.js` | testy `api.js` z udawanym `fetch` |

---

### Task 1: Zapis stanu gry i nick (`src/save.js`)

**Files:**
- Create: `src/save.js`
- Test: `tests/save.test.js`

**Interfaces:**
- Consumes: `TYPES` z `pieces.js`; `ROWS`, `COLS`, `createGame` z `game.js`.
- Produces (w `module.exports` / `window.Tetris`):
  - `serializeGame(state) → { board, piece, score }` — kopia, bez `status` i `random`.
  - `restoreGame(saved, random) → State | null` — stan w statusie `'paused'`; `null`, gdy zapis jest nieprawidłowy.
  - `normalizeNick(text) → string | null` — obcięte spacje, maks. 20 znaków; `null` dla pustego.
  - `shouldSave(state) → boolean` — `true` dla `playing` i `paused`.

- [ ] **Step 1: Napisz testy, które nie przechodzą — `tests/save.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
const save = require('../src/save.js');
const game = require('../src/game.js');

const fixedRandom = () => 0.5;

function sampleState() {
  const state = game.createGame(fixedRandom);
  const board = state.board.map((row) => row.slice());
  board[19][0] = 'I';
  board[19][1] = 'Z';
  return { ...state, board, score: 300 };
}

test('serializeGame zapisuje planszę, klocek i wynik, bez statusu i losowania', () => {
  const state = sampleState();
  const saved = save.serializeGame(state);
  assert.deepStrictEqual(Object.keys(saved).sort(), ['board', 'piece', 'score']);
  assert.deepStrictEqual(saved.board, state.board);
  assert.deepStrictEqual(saved.piece, state.piece);
  assert.strictEqual(saved.score, 300);
});

test('serializeGame robi kopię — zmiana zapisu nie zmienia gry', () => {
  const state = sampleState();
  const saved = save.serializeGame(state);
  saved.board[0][0] = 'X';
  saved.piece.col = 9;
  assert.strictEqual(state.board[0][0], null);
  assert.notStrictEqual(state.piece.col, 9);
});

test('zapis przechodzi przez JSON i wraca jako gra w pauzie', () => {
  const state = sampleState();
  const saved = JSON.parse(JSON.stringify(save.serializeGame(state)));
  const restored = save.restoreGame(saved, fixedRandom);
  assert.strictEqual(restored.status, 'paused');
  assert.deepStrictEqual(restored.board, state.board);
  assert.deepStrictEqual(restored.piece, state.piece);
  assert.strictEqual(restored.score, 300);
  assert.strictEqual(restored.random, fixedRandom);
});

test('wznowiona gra działa po odpauzowaniu', () => {
  const restored = save.restoreGame(save.serializeGame(sampleState()), fixedRandom);
  const playing = game.togglePause(restored);
  assert.strictEqual(playing.status, 'playing');
  assert.strictEqual(game.tick(playing).piece.row, restored.piece.row + 1);
});

test('restoreGame odrzuca nieprawidłowe zapisy', () => {
  const ok = save.serializeGame(sampleState());
  const broken = [
    null,
    'tekst',
    {},
    { ...ok, board: ok.board.slice(1) },
    { ...ok, board: ok.board.map((row, r) => (r === 0 ? row.slice(1) : row)) },
    { ...ok, board: ok.board.map((row, r) => (r === 0 ? ['Q', ...row.slice(1)] : row)) },
    { ...ok, piece: { ...ok.piece, type: 'Q' } },
    { ...ok, piece: { ...ok.piece, rotation: 4 } },
    { ...ok, piece: { ...ok.piece, row: 1.5 } },
    { ...ok, piece: { ...ok.piece, col: 'a' } },
    { ...ok, score: -100 },
    { ...ok, score: 12.5 },
  ];
  broken.forEach((saved, i) => {
    assert.strictEqual(save.restoreGame(saved, fixedRandom), null, `przypadek ${i}`);
  });
});

test('normalizeNick obcina spacje, skraca do 20 znaków i odrzuca puste', () => {
  assert.strictEqual(save.normalizeNick('  Ola  '), 'Ola');
  assert.strictEqual(save.normalizeNick('a'.repeat(50)), 'a'.repeat(20));
  assert.strictEqual(save.normalizeNick('   '), null);
  assert.strictEqual(save.normalizeNick(''), null);
  assert.strictEqual(save.normalizeNick(null), null);
  assert.strictEqual(save.normalizeNick('<b>Ola</b>'), '<b>Ola</b>');
});

test('shouldSave: zapisujemy grę trwającą i w pauzie, nigdy zakończoną', () => {
  const state = game.createGame(fixedRandom);
  assert.strictEqual(save.shouldSave(state), true);
  assert.strictEqual(save.shouldSave({ ...state, status: 'paused' }), true);
  assert.strictEqual(save.shouldSave({ ...state, status: 'over' }), false);
  assert.strictEqual(save.shouldSave(null), false);
});
```

- [ ] **Step 2: Uruchom testy i sprawdź, że nie przechodzą**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/save.js'`; pozostałe 35 testów przechodzi.

- [ ] **Step 3: Napisz `src/save.js`**

```js
(function (exports, deps) {
  'use strict';

  const NICK_MAX = 20;

  function isInt(value) {
    return Number.isInteger(value);
  }

  function validBoard(board) {
    return (
      Array.isArray(board) &&
      board.length === deps.ROWS &&
      board.every(
        (row) =>
          Array.isArray(row) &&
          row.length === deps.COLS &&
          row.every((cell) => cell === null || deps.TYPES.includes(cell))
      )
    );
  }

  function validPiece(piece) {
    return (
      piece !== null &&
      typeof piece === 'object' &&
      deps.TYPES.includes(piece.type) &&
      [0, 1, 2, 3].includes(piece.rotation) &&
      isInt(piece.row) &&
      isInt(piece.col)
    );
  }

  function serializeGame(state) {
    return {
      board: state.board.map((row) => row.slice()),
      piece: { ...state.piece },
      score: state.score,
    };
  }

  // Zapis z bazy → stan gry w pauzie. Nieprawidłowy zapis → null (gra zacznie się od nowa).
  function restoreGame(saved, random) {
    if (saved === null || typeof saved !== 'object') return null;
    if (!validBoard(saved.board) || !validPiece(saved.piece)) return null;
    if (!isInt(saved.score) || saved.score < 0) return null;
    return {
      ...deps.createGame(random),
      board: saved.board.map((row) => row.slice()),
      piece: { ...saved.piece },
      score: saved.score,
      status: 'paused',
    };
  }

  function normalizeNick(text) {
    if (typeof text !== 'string') return null;
    const nick = text.trim().slice(0, NICK_MAX);
    return nick === '' ? null : nick;
  }

  function shouldSave(state) {
    return state !== null && (state.status === 'playing' || state.status === 'paused');
  }

  Object.assign(exports, { serializeGame, restoreGame, normalizeNick, shouldSave });
})(
  typeof module !== 'undefined' ? module.exports : window.Tetris,
  typeof module !== 'undefined'
    ? { ...require('./pieces.js'), ...require('./game.js') }
    : window.Tetris
);
```

- [ ] **Step 4: Uruchom testy i sprawdź, że przechodzą**

Run: `npm test`
Expected: PASS — 42 testy, 0 błędów.

- [ ] **Step 5: Commit** (tylko na prośbę użytkowniczki)

```bash
git add src/save.js tests/save.test.js
git commit -m "Dodaj zapis i odczyt stanu gry oraz obsługę nicka"
```

---

### Task 2: Połączenie z Supabase (`src/api.js`, `src/config.js`)

**Files:**
- Create: `src/api.js`
- Create: `src/config.js`
- Test: `tests/api.test.js`

**Interfaces:**
- Consumes: nic z poprzednich tasków.
- Produces:
  - `createApi({ url, key, fetch }) → Api`, gdzie `Api`:
    - `submitScore(nick: string, score: number): Promise<void>`
    - `topScores(limit: number): Promise<Array<{ nick, score }>>`
    - `saveGame(playerId: string, nick: string, saved: object, options?: { keepalive: boolean }): Promise<void>`
    - `loadGame(playerId: string): Promise<object | null>`
    - `deleteGame(playerId: string): Promise<void>`
  - Każda metoda rzuca `Error`, gdy odpowiedź ma `!ok` albo `fetch` się nie powiedzie.
  - `window.Tetris.config = { url, key }` (z `src/config.js`).

- [ ] **Step 1: Napisz testy, które nie przechodzą — `tests/api.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
const { createApi } = require('../src/api.js');

const URL_BASE = 'https://example.supabase.co';
const KEY = 'sb_publishable_test';

// Udawany fetch: zapamiętuje wywołania i zwraca podaną odpowiedź.
function fakeFetch(response = { ok: true, status: 200, body: null }) {
  const calls = [];
  const fn = async (url, options) => {
    calls.push({ url, options, body: options.body ? JSON.parse(options.body) : undefined });
    return {
      ok: response.ok,
      status: response.status,
      json: async () => response.body,
      text: async () => JSON.stringify(response.body),
    };
  };
  fn.calls = calls;
  return fn;
}

function api(fetch) {
  return createApi({ url: URL_BASE, key: KEY, fetch });
}

test('submitScore dodaje wiersz do tabeli scores z kluczem apikey', async () => {
  const fetch = fakeFetch({ ok: true, status: 201, body: null });
  await api(fetch).submitScore('Ola', 800);
  const [call] = fetch.calls;
  assert.strictEqual(call.url, `${URL_BASE}/rest/v1/scores`);
  assert.strictEqual(call.options.method, 'POST');
  assert.strictEqual(call.options.headers.apikey, KEY);
  assert.strictEqual(call.options.headers.Authorization, undefined);
  assert.deepStrictEqual(call.body, { nick: 'Ola', score: 800 });
});

test('topScores pobiera najlepsze wyniki malejąco z limitem', async () => {
  const rows = [{ nick: 'Ola', score: 800 }, { nick: 'Jaś', score: 100 }];
  const fetch = fakeFetch({ ok: true, status: 200, body: rows });
  const result = await api(fetch).topScores(10);
  assert.strictEqual(
    fetch.calls[0].url,
    `${URL_BASE}/rest/v1/scores?select=nick,score&order=score.desc,created_at.asc&limit=10`
  );
  assert.strictEqual(fetch.calls[0].options.method, 'GET');
  assert.deepStrictEqual(result, rows);
});

test('saveGame wywołuje funkcję save_game z identyfikatorem, nickiem i stanem', async () => {
  const fetch = fakeFetch({ ok: true, status: 204, body: null });
  await api(fetch).saveGame('id-1', 'Ola', { score: 5 });
  const [call] = fetch.calls;
  assert.strictEqual(call.url, `${URL_BASE}/rest/v1/rpc/save_game`);
  assert.strictEqual(call.options.method, 'POST');
  assert.strictEqual(call.options.keepalive, false);
  assert.deepStrictEqual(call.body, { p_player_id: 'id-1', p_nick: 'Ola', p_state: { score: 5 } });
});

test('saveGame przy zamykaniu karty wysyła żądanie z keepalive', async () => {
  const fetch = fakeFetch({ ok: true, status: 204, body: null });
  await api(fetch).saveGame('id-1', 'Ola', { score: 5 }, { keepalive: true });
  assert.strictEqual(fetch.calls[0].options.keepalive, true);
});

test('loadGame zwraca zapis albo null', async () => {
  const saved = { score: 5 };
  const found = await api(fakeFetch({ ok: true, status: 200, body: saved })).loadGame('id-1');
  assert.deepStrictEqual(found, saved);
  const fetch = fakeFetch({ ok: true, status: 200, body: null });
  assert.strictEqual(await api(fetch).loadGame('id-2'), null);
  assert.strictEqual(fetch.calls[0].url, `${URL_BASE}/rest/v1/rpc/load_game`);
  assert.deepStrictEqual(fetch.calls[0].body, { p_player_id: 'id-2' });
});

test('deleteGame wywołuje funkcję delete_game', async () => {
  const fetch = fakeFetch({ ok: true, status: 204, body: null });
  await api(fetch).deleteGame('id-1');
  assert.strictEqual(fetch.calls[0].url, `${URL_BASE}/rest/v1/rpc/delete_game`);
  assert.deepStrictEqual(fetch.calls[0].body, { p_player_id: 'id-1' });
});

test('błąd serwera kończy się wyjątkiem', async () => {
  const fetch = fakeFetch({ ok: false, status: 500, body: { message: 'boom' } });
  await assert.rejects(api(fetch).submitScore('Ola', 100), /500/);
  await assert.rejects(api(fetch).topScores(10), /500/);
  await assert.rejects(api(fetch).loadGame('id-1'), /500/);
});

test('brak sieci kończy się wyjątkiem', async () => {
  const fetch = async () => {
    throw new TypeError('Failed to fetch');
  };
  await assert.rejects(api(fetch).saveGame('id-1', 'Ola', {}), /Failed to fetch/);
});
```

- [ ] **Step 2: Uruchom testy i sprawdź, że nie przechodzą**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/api.js'`; pozostałe 42 testy przechodzą.

- [ ] **Step 3: Napisz `src/api.js`**

```js
(function (exports) {
  'use strict';

  function createApi({ url, key, fetch }) {
    const base = `${url}/rest/v1`;

    async function request(path, { method = 'POST', body, keepalive = false } = {}) {
      const response = await fetch(`${base}${path}`, {
        method,
        keepalive,
        headers: { apikey: key, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`Supabase: błąd ${response.status}`);
      return response;
    }

    async function submitScore(nick, score) {
      await request('/scores', { body: { nick, score } });
    }

    async function topScores(limit) {
      const query = `select=nick,score&order=score.desc,created_at.asc&limit=${limit}`;
      const response = await request(`/scores?${query}`, { method: 'GET' });
      return response.json();
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

    return { submitScore, topScores, saveGame, loadGame, deleteGame };
  }

  Object.assign(exports, { createApi });
})(typeof module !== 'undefined' ? module.exports : window.Tetris);
```

- [ ] **Step 4: Napisz `src/config.js`**

```js
// Dane publiczne projektu Supabase. Klucz publishable może być w kodzie strony —
// dostęp do danych ograniczają reguły RLS z supabase/schema.sql.
// NIGDY nie wpisuj tu klucza service_role / secret.
window.Tetris.config = {
  url: 'https://opfakkxrhizsthrnnilv.supabase.co',
  key: 'sb_publishable_SxZaUzsyEByuF0ffjhduzg_zfpfd-ci',
};
```

- [ ] **Step 5: Uruchom testy i sprawdź, że przechodzą**

Run: `npm test`
Expected: PASS — 50 testów, 0 błędów.

- [ ] **Step 6: Sprawdź połączenie z prawdziwą bazą (tylko odczyt)**

Run (Git Bash):
```bash
curl -s -w " [%{http_code}]\n" "https://opfakkxrhizsthrnnilv.supabase.co/rest/v1/scores?select=nick,score&order=score.desc,created_at.asc&limit=10" -H "apikey: sb_publishable_SxZaUzsyEByuF0ffjhduzg_zfpfd-ci"
```
Expected: lista JSON (może być pusta `[]`) i `[200]`.

- [ ] **Step 7: Commit** (tylko na prośbę użytkowniczki)

```bash
git add src/api.js src/config.js tests/api.test.js
git commit -m "Dodaj połączenie z Supabase"
```

---

### Task 3: Strona — nick, wznawianie, ranking, zapisy

**Files:**
- Modify: `index.html`
- Modify: `style.css` (dopisanie na końcu)
- Modify: `src/view.js` (pełna nowa wersja)

**Interfaces:**
- Consumes (z `window.Tetris`): `createGame`, `moveLeft`, `moveRight`, `rotate`, `tick`, `togglePause`, `getCells`, `COLS` (game); `serializeGame`, `restoreGame`, `normalizeNick`, `shouldSave` (Task 1); `createApi`, `config` (Task 2).
- Produces: grywalna strona z zapisem. Brak nowych reguł gry.

Warstwa DOM — sprawdzana ręcznie. Testy automatyczne muszą nadal przechodzić.

- [ ] **Step 1: Zmień `index.html`**

Wewnątrz `<div class="board-wrap">`, po `over-overlay`, dodaj dwie nakładki:

```html
        <div id="nick-overlay" class="overlay" hidden>
          <p class="overlay-title">Witaj!</p>
          <form id="nick-form" class="nick-form">
            <label for="nick-input">Jak masz na imię?</label>
            <input id="nick-input" type="text" maxlength="20" autocomplete="off" required />
            <button type="submit">Graj</button>
          </form>
        </div>
        <div id="resume-overlay" class="overlay" hidden>
          <p class="overlay-title">Wznowić grę?</p>
          <p>Zapisany wynik: <span id="resume-score">0</span></p>
          <div class="buttons">
            <button id="resume-yes" type="button">Wznów</button>
            <button id="resume-no" type="button" class="secondary">Nowa gra</button>
          </div>
        </div>
```

W `<aside class="panel">`, po `<ul class="keys">…</ul>`, dodaj:

```html
        <p id="player" class="player"></p>
        <h2 class="ranking-title">Najlepsze wyniki</h2>
        <ol id="ranking" class="ranking"></ol>
        <p id="save-error" class="save-error" hidden>Nie udało się zapisać</p>
```

Zastąp trzy znaczniki `<script>` na końcu `<body>`:

```html
    <script src="src/pieces.js"></script>
    <script src="src/game.js"></script>
    <script src="src/save.js"></script>
    <script src="src/api.js"></script>
    <script src="src/config.js"></script>
    <script src="src/view.js"></script>
```

- [ ] **Step 2: Dopisz na końcu `style.css`**

```css
.nick-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.nick-form input {
  font: inherit;
  font-size: 1.1rem;
  width: 200px;
  padding: 8px 10px;
  border: 2px solid #30c050;
  border-radius: 8px;
  background: var(--cell-empty);
  color: var(--text);
  text-align: center;
}

.buttons {
  display: flex;
  gap: 12px;
}

button.secondary {
  background: #44445a;
}

.player {
  margin: 16px 0 0;
  opacity: 0.8;
}

.ranking-title {
  margin: 16px 0 8px;
  font-size: 1.1rem;
}

.ranking {
  margin: 0;
  padding-left: 1.5em;
  line-height: 1.7;
}

.ranking li span {
  float: right;
  margin-left: 12px;
  font-weight: bold;
}

.save-error {
  margin: 12px 0 0;
  padding: 6px 10px;
  border-radius: 6px;
  background: #e03a3a;
}

.save-error[hidden] {
  display: none;
}
```

- [ ] **Step 3: Zastąp całe `src/view.js`**

```js
(function () {
  'use strict';

  const T = window.Tetris;
  const { createGame, moveLeft, moveRight, rotate, tick, togglePause, getCells, COLS } = T;
  const { serializeGame, restoreGame, normalizeNick, shouldSave } = T;
  const TICK_MS = 1000;
  const RANKING_SIZE = 10;
  const ERROR_MS = 3000;

  const api = T.createApi({ url: T.config.url, key: T.config.key, fetch: window.fetch.bind(window) });

  const $ = (id) => document.getElementById(id);
  const boardEl = $('board');
  const scoreEl = $('score');
  const finalScoreEl = $('final-score');
  const pauseOverlay = $('pause-overlay');
  const overOverlay = $('over-overlay');
  const nickOverlay = $('nick-overlay');
  const resumeOverlay = $('resume-overlay');
  const restartButton = $('restart');
  const nickForm = $('nick-form');
  const nickInput = $('nick-input');
  const resumeScoreEl = $('resume-score');
  const playerEl = $('player');
  const rankingEl = $('ranking');
  const saveErrorEl = $('save-error');

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

  let playerId = readStorage('kk.playerId');
  if (!playerId) {
    playerId = crypto.randomUUID();
    writeStorage('kk.playerId', playerId);
  }
  let nick = normalizeNick(readStorage('kk.nick'));

  // --- Plansza ---
  const cellEls = [];
  for (let i = 0; i < 200; i++) {
    const el = document.createElement('div');
    el.className = 'cell';
    boardEl.appendChild(el);
    cellEls.push(el);
  }

  // null = gra jeszcze nie wystartowała (czekamy na nick albo decyzję o wznowieniu).
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
    }
    pauseOverlay.hidden = !state || state.status !== 'paused';
    overOverlay.hidden = !state || state.status !== 'over';
    playerEl.textContent = nick ? `Gracz: ${nick}` : '';
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

  function saveState(keepalive) {
    if (!nick || !shouldSave(state)) return;
    api.saveGame(playerId, nick, serializeGame(state), { keepalive }).catch(showSaveError);
  }

  function renderRanking(rows) {
    rankingEl.replaceChildren(
      ...rows.map((row) => {
        const li = document.createElement('li');
        const points = document.createElement('span');
        points.textContent = row.score;
        li.append(row.nick, points);
        return li;
      })
    );
  }

  function refreshRanking() {
    api.topScores(RANKING_SIZE).then(renderRanking).catch(() => {});
  }

  function onGameOver(finalState) {
    api
      .submitScore(nick, finalState.score)
      .then(refreshRanking)
      .catch(showSaveError);
    api.deleteGame(playerId).catch(() => {});
  }

  // --- Zmiany stanu ---
  function update(next) {
    if (next === state) return;
    const previous = state;
    state = next;
    render();
    if (previous && previous.status !== 'over' && state.status === 'over') onGameOver(state);
    if (previous && previous.status === 'playing' && state.status === 'paused') saveState(false);
  }

  function startNewGame() {
    api.deleteGame(playerId).catch(() => {});
    update(createGame(Math.random));
  }

  // --- Start: nick → (zapis?) → gra ---
  function askNick() {
    nickOverlay.hidden = false;
    nickInput.value = '';
    nickInput.focus();
  }

  async function begin() {
    let saved = null;
    try {
      saved = restoreGame(await api.loadGame(playerId), Math.random);
    } catch (e) {
      saved = null;
    }
    if (saved) {
      resumeScoreEl.textContent = saved.score;
      resumeOverlay.hidden = false;
      $('resume-yes').onclick = () => {
        resumeOverlay.hidden = true;
        update(saved);
      };
      $('resume-no').onclick = () => {
        resumeOverlay.hidden = true;
        startNewGame();
      };
    } else {
      update(createGame(Math.random));
    }
  }

  nickForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = normalizeNick(nickInput.value);
    if (!value) return;
    nick = value;
    writeStorage('kk.nick', nick);
    nickOverlay.hidden = true;
    nickInput.blur();
    render();
    begin();
  });

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
    // Podczas wpisywania nicka klawisze nie sterują grą.
    if (event.target instanceof HTMLInputElement) return;
    if (!state) return;
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

  // Jeden zegar na całe życie strony.
  setInterval(() => {
    if (state) update(tick(state));
  }, TICK_MS);

  render();
  refreshRanking();
  if (nick) begin();
  else askNick();
})();
```

- [ ] **Step 4: Uruchom testy automatyczne**

Run: `npm test`
Expected: PASS — 50 testów, 0 błędów.

- [ ] **Step 5: Sprawdź grę ręcznie przez lokalny serwer**

Run (PowerShell, w tle): `python -m http.server 8766 --bind 127.0.0.1` i otwórz `http://127.0.0.1:8766/`.

Sprawdź i zanotuj wynik każdego punktu:
1. Pierwsze wejście (czysta pamięć przeglądarki): nakładka „Witaj!”; gra nie startuje. W konsoli brak błędów (poza `favicon.ico`).
2. Wpisanie „   ” i Enter nic nie robi; wpisanie „Ola” startuje grę, w panelu „Gracz: Ola”.
3. Podczas wpisywania nicka spacja, strzałki i P nie wpływają na grę.
4. Ranking pokazuje wyniki z bazy (lub pustą listę).
5. Zagraj, naciśnij P → w Supabase (Table Editor → `saved_games`) pojawia się wiersz gracza.
6. Odśwież stronę → „Wznowić grę?” z zapisanym wynikiem. „Wznów” → plansza jak przed odświeżeniem, gra w pauzie; P wznawia.
7. Odśwież, wybierz „Nowa gra” → pusta plansza, wynik 0; wiersz w `saved_games` znika.
8. Wyłącz sieć (F12 → Network → Offline), naciśnij P → „Nie udało się zapisać” na ok. 3 s; gra działa dalej.
9. Doprowadź do game over → wynik pojawia się w `scores` i w rankingu na stronie; wiersz w `saved_games` znika; odświeżenie nie pyta o wznowienie.
10. Graj, zamknij kartę bez pauzy, otwórz ponownie → „Wznowić grę?”.
11. Nick `<b>Ola</b>` wyświetla się dosłownie (z nawiasami), bez pogrubienia.

- [ ] **Step 6: Commit** (tylko na prośbę użytkowniczki)

```bash
git add index.html style.css src/view.js
git commit -m "Dodaj nick, wznawianie gry i ranking z Supabase"
```
