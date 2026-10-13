(function () {
  'use strict';

  const T = window.Tetris;
  const { createGame, moveLeft, moveRight, rotate, tick, togglePause, getCells, COLS } = T;
  const { serializeGame, restoreGame, normalizeNick, shouldSave, transferAction, randomId } = T;
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
    updateScene();
  }

  // Kosmos: pełny przy oknach (Witaj, logowanie…), przyciemniony przy końcu gry, w grze wyłączony.
  // W grze tło ma natężenie wybrane przyciskiem „Tło” (zapamiętane w przeglądarce).
  const space = T.createSpace({ canvas: $('space-canvas'), titleEl: $('scene-title') });
  const BG_LABELS = { calm: 'spokojne', full: 'pełne', off: 'wyłączone' };
  let bgLevel = BG_LABELS[readStorage('kk.bg')] ? readStorage('kk.bg') : 'calm';
  const bgButton = $('bg-button');
  function sceneMode() {
    if (modalOpen()) return 'scene';
    if (!state) return 'off';
    if (state.status === 'over') return 'dim';
    return state.status === 'paused' ? 'paused' : 'game';
  }
  function updateScene() {
    const mode = sceneMode();
    document.body.classList.toggle('is-scene', mode === 'scene');
    document.body.classList.toggle('is-dim', mode === 'dim');
    document.body.classList.toggle('is-game', mode === 'game' || mode === 'paused');
    document.body.classList.toggle('bg-still', (mode === 'game' && bgLevel === 'off') || mode === 'paused');
    bgButton.textContent = `Tło: ${BG_LABELS[bgLevel]}`;
    space.setMode(mode, bgLevel);
  }
  bgButton.addEventListener('click', () => {
    bgLevel = T.nextLevel(bgLevel);
    writeStorage('kk.bg', bgLevel);
    bgButton.blur(); // spacja ma obracać klocek, a nie klikać przycisk
    updateScene();
  });

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
    playerId = randomId(window.crypto);
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
    updateScene();
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
    // Przed każdym wywołaniem odśwież wygasły token (np. po wybudzeniu laptopa).
    // Jeśli w międzyczasie ktoś się wylogował, zostaje sesja z chwili wywołania.
    const s = session;
    const fresh = () => ensureSession().then(() => (session && session.userId === s.userId ? session : s));
    return {
      load: () => fresh().then((current) => api.loadAccountGame(current)),
      save: (saved, options) => fresh().then((current) => api.saveAccountGame(current, saved, options)),
      remove: () => fresh().then((current) => api.deleteAccountGame(current)),
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
    api
      .topScores(RANKING_SIZE)
      .then(renderRanking)
      .catch(() => {
        const li = document.createElement('li');
        li.className = 'ranking-error';
        li.textContent = 'Ranking niedostępny';
        rankingEl.replaceChildren(li);
      });
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
    $('auth-switch').textContent = mode === 'login' ? 'Nie masz konta? Załóż konto' : 'Masz już konto? Zaloguj się';
    showOnly(authOverlay);
    authUser.focus();
  }

  $('welcome-guest').addEventListener('click', () => {
    if (nick) begin();
    else askNick();
  });
  $('welcome-login').addEventListener('click', () => openAuth('login'));
  $('welcome-signup').addEventListener('click', () => openAuth('signup'));

  $('auth-switch').addEventListener('click', () => openAuth(authMode === 'login' ? 'signup' : 'login'));

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
  // Jedno odświeżanie naraz; wynik liczy się tylko, jeśli w międzyczasie
  // nikt się nie wylogował ani nie zalogował na inne konto.
  let refreshing = null;
  function ensureSession() {
    if (!session || !needsRefresh(session, Date.now())) return Promise.resolve();
    if (!refreshing) {
      const old = session;
      refreshing = auth
        .refresh(old)
        .then((fresh) => {
          if (session === old) storeSession(fresh);
        })
        .catch((e) => {
          if (session !== old) return;
          if (e instanceof AuthError && e.code === 'network') return; // spróbujemy później
          storeSession(null); // sesja unieważniona — wyloguj
          state = null;
          showOnly(welcomeOverlay);
          render();
        })
        .finally(() => {
          refreshing = null;
        });
    }
    return refreshing;
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
  // Zamknięcie karty też najpierw ją ukrywa, więc jeden zapis wystarcza.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveState(true);
  });

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
