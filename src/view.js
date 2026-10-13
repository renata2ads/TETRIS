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

  // Zapisy i usunięcia idą do bazy po kolei — spóźniony zapis nie może
  // nadpisać późniejszego usunięcia (i przywrócić skończonej gry).
  let queue = Promise.resolve();
  function inOrder(task) {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  }

  function saveState(keepalive) {
    if (!nick || !shouldSave(state)) return;
    const saved = serializeGame(state);
    inOrder(() => api.saveGame(playerId, nick, saved, { keepalive })).catch(showSaveError);
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
    inOrder(() => api.deleteGame(playerId)).catch(() => {});
    api.submitScore(nick, finalState.score).then(refreshRanking).catch(showSaveError);
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
    inOrder(() => api.deleteGame(playerId)).catch(() => {});
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
