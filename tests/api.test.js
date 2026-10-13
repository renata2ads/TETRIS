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
