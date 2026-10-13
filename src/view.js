(function () {
  'use strict';

  const { createGame, moveLeft, moveRight, rotate, tick, togglePause, getCells, COLS } = window.Tetris;
  const TICK_MS = 1000;

  const boardEl = document.getElementById('board');
  const scoreEl = document.getElementById('score');
  const finalScoreEl = document.getElementById('final-score');
  const pauseOverlay = document.getElementById('pause-overlay');
  const overOverlay = document.getElementById('over-overlay');
  const restartButton = document.getElementById('restart');

  // 200 pól tworzymy raz; potem zmieniamy tylko ich klasy.
  const cellEls = [];
  for (let i = 0; i < 200; i++) {
    const el = document.createElement('div');
    el.className = 'cell';
    boardEl.appendChild(el);
    cellEls.push(el);
  }

  let state = createGame(Math.random);

  function render() {
    getCells(state).forEach((row, r) => {
      row.forEach((type, c) => {
        cellEls[r * COLS + c].className = type ? `cell cell--${type}` : 'cell';
      });
    });
    scoreEl.textContent = state.score;
    finalScoreEl.textContent = state.score;
    pauseOverlay.hidden = state.status !== 'paused';
    overOverlay.hidden = state.status !== 'over';
  }

  function update(next) {
    if (next === state) return;
    state = next;
    render();
  }

  const ACTIONS = {
    ArrowLeft: moveLeft,
    ArrowRight: moveRight,
    ArrowDown: tick,
    ' ': rotate,
    p: togglePause,
    P: togglePause,
  };

  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      return;
    }
    const action = ACTIONS[event.key];
    if (!action) return;
    event.preventDefault();
    // Przytrzymany P nie może przełączać pauzy w kółko.
    if (action === togglePause && event.repeat) return;
    update(action(state));
  });

  restartButton.addEventListener('click', () => {
    update(createGame(Math.random));
    // Bez fokusu na przycisku spacja obraca klocek, zamiast znowu go „klikać”.
    restartButton.blur();
  });

  // Jeden zegar na całe życie strony — restart podmienia tylko stan.
  setInterval(() => update(tick(state)), TICK_MS);

  render();
})();
