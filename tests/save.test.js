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

test('restoreGame odrzuca klocek poza planszą albo na zajętych polach', () => {
  const ok = save.serializeGame(sampleState());
  const broken = [
    { ...ok, piece: { type: 'I', rotation: 0, row: 50, col: 3 } },
    { ...ok, piece: { type: 'T', rotation: 0, row: 5, col: 99 } },
    { ...ok, piece: { type: 'T', rotation: 0, row: 5, col: -3 } },
    { ...ok, piece: { type: 'T', rotation: 0, row: -10, col: 3 } },
    { ...ok, piece: { type: 'O', rotation: 0, row: 18, col: -1 } },
  ];
  broken.forEach((saved, i) => {
    assert.strictEqual(save.restoreGame(saved, fixedRandom), null, `przypadek ${i}`);
  });
});
