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
