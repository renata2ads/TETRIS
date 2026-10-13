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
