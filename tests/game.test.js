const test = require('node:test');
const assert = require('node:assert');
const game = require('../src/game.js');
const { TYPES } = require('../src/pieces.js');

// Losowanie, które zwraca kolejno podane klocki (ostatni się powtarza).
function sequence(...types) {
  let i = 0;
  return () => {
    const type = types[Math.min(i, types.length - 1)];
    i++;
    return (TYPES.indexOf(type) + 0.5) / TYPES.length;
  };
}

function emptyBoard() {
  return Array.from({ length: 20 }, () => Array(10).fill(null));
}

// Pusta plansza z zajętymi polami [wiersz, kolumna].
function boardWith(cells) {
  const board = emptyBoard();
  cells.forEach(([r, c]) => {
    board[r][c] = 'X';
  });
  return board;
}

// Plansza, której dolne wiersze opisują napisy: '.' = puste, inny znak = zajęte.
function boardFrom(bottomRows) {
  const top = Array.from({ length: 20 - bottomRows.length }, () => Array(10).fill(null));
  const bottom = bottomRows.map((line) => [...line].map((ch) => (ch === '.' ? null : ch)));
  return [...top, ...bottom];
}

function filledCount(cells) {
  return cells.flat().filter((cell) => cell !== null).length;
}

test('nowa gra: pusta plansza, wynik 0, gra trwa, klocek na starcie', () => {
  const state = game.createGame(sequence('T'));
  assert.deepStrictEqual(state.board, emptyBoard());
  assert.strictEqual(state.score, 0);
  assert.strictEqual(state.status, 'playing');
  assert.deepStrictEqual(state.piece, { type: 'T', rotation: 0, row: 0, col: 3 });
});

test('nowy klocek I startuje wiersz wyżej, żeby jego pola były w wierszu 0', () => {
  const state = game.createGame(sequence('I'));
  assert.deepStrictEqual(state.piece, { type: 'I', rotation: 0, row: -1, col: 3 });
});

test('getCells nanosi aktywny klocek na planszę', () => {
  const cells = game.getCells(game.createGame(sequence('T')));
  assert.strictEqual(cells[0][4], 'T');
  assert.deepStrictEqual(cells[1].slice(3, 6), ['T', 'T', 'T']);
  assert.strictEqual(filledCount(cells), 4);
});

test('getCells nie zmienia planszy w stanie gry', () => {
  const state = game.createGame(sequence('T'));
  game.getCells(state);
  assert.deepStrictEqual(state.board, emptyBoard());
});

function withPiece(state, piece, board) {
  return { ...state, piece, board: board || state.board };
}

test('ruch w lewo i w prawo przesuwa klocek o jedną kolumnę', () => {
  const state = game.createGame(sequence('T'));
  assert.strictEqual(game.moveLeft(state).piece.col, 2);
  assert.strictEqual(game.moveRight(state).piece.col, 4);
});

test('klocek nie wyjeżdża za lewą ścianę', () => {
  const state = withPiece(game.createGame(sequence('T')), { type: 'T', rotation: 0, row: 5, col: 0 });
  assert.strictEqual(game.moveLeft(state).piece.col, 0);
});

test('klocek nie wyjeżdża za prawą ścianę', () => {
  const state = withPiece(game.createGame(sequence('T')), { type: 'T', rotation: 0, row: 5, col: 7 });
  assert.strictEqual(game.moveRight(state).piece.col, 7);
});

test('klocek nie wjeżdża w zajęte pola', () => {
  const state = withPiece(
    game.createGame(sequence('T')),
    { type: 'T', rotation: 0, row: 17, col: 3 },
    boardWith([[18, 2]])
  );
  assert.strictEqual(game.moveLeft(state).piece.col, 3);
});

test('obrót przechodzi do następnej pozycji, po czterech wraca do 0', () => {
  let state = withPiece(game.createGame(sequence('T')), { type: 'T', rotation: 0, row: 5, col: 3 });
  state = game.rotate(state);
  assert.strictEqual(state.piece.rotation, 1);
  state = game.rotate(game.rotate(game.rotate(state)));
  assert.strictEqual(state.piece.rotation, 0);
});

test('obrót się nie wykonuje, gdy klocek wszedłby w ścianę', () => {
  const state = withPiece(game.createGame(sequence('T')), { type: 'T', rotation: 1, row: 5, col: -1 });
  assert.strictEqual(game.rotate(state).piece.rotation, 1);
});

test('obrót się nie wykonuje, gdy klocek wszedłby w zajęte pola', () => {
  const state = withPiece(
    game.createGame(sequence('T')),
    { type: 'T', rotation: 0, row: 5, col: 3 },
    boardWith([[7, 4]])
  );
  assert.strictEqual(game.rotate(state).piece.rotation, 0);
});

test('klocek I da się obrócić zaraz po pojawieniu się', () => {
  const state = game.rotate(game.createGame(sequence('I')));
  assert.strictEqual(state.piece.rotation, 1);
});

test('getCells pomija części klocka ponad planszą', () => {
  const cells = game.getCells(game.rotate(game.createGame(sequence('I'))));
  assert.deepStrictEqual([cells[0][5], cells[1][5], cells[2][5]], ['I', 'I', 'I']);
  assert.strictEqual(filledCount(cells), 3);
});

test('tick przesuwa klocek o jeden wiersz w dół', () => {
  const state = game.tick(game.createGame(sequence('T')));
  assert.strictEqual(state.piece.row, 1);
});

test('tick na dnie zatrzymuje klocek i daje nowy', () => {
  const start = withPiece(game.createGame(sequence('T', 'O')), { type: 'T', rotation: 0, row: 18, col: 3 });
  const state = game.tick(start);
  assert.strictEqual(state.board[18][4], 'T');
  assert.deepStrictEqual(state.board[19].slice(3, 6), ['T', 'T', 'T']);
  assert.deepStrictEqual(state.piece, { type: 'O', rotation: 0, row: 0, col: 3 });
  assert.strictEqual(state.score, 0);
  assert.strictEqual(state.status, 'playing');
});

test('tick zatrzymuje klocek, który opiera się o inne klocki', () => {
  const start = withPiece(
    game.createGame(sequence('T', 'O')),
    { type: 'T', rotation: 0, row: 16, col: 3 },
    boardWith([[18, 4]])
  );
  const state = game.tick(start);
  assert.strictEqual(state.board[16][4], 'T');
  assert.deepStrictEqual(state.board[17].slice(3, 6), ['T', 'T', 'T']);
  assert.strictEqual(state.board[18][4], 'X');
  assert.strictEqual(state.piece.type, 'O');
});

function lockOn(pieceSpec, bottomRows, score) {
  const start = game.createGame(sequence(pieceSpec.type, 'T'));
  return game.tick({ ...start, piece: pieceSpec, board: boardFrom(bottomRows), score: score || 0 });
}

const O_AT_BOTTOM = { type: 'O', rotation: 0, row: 18, col: 3 };
const I_STANDING = { type: 'I', rotation: 1, row: 16, col: 3 };

test('zbicie 1 wiersza daje 100 punktów, a wiersz nad nim opada', () => {
  const state = lockOn(O_AT_BOTTOM, ['XXXX..XXXX']);
  assert.strictEqual(state.score, 100);
  assert.deepStrictEqual(state.board[19], [null, null, null, null, 'O', 'O', null, null, null, null]);
  assert.ok(state.board[18].every((cell) => cell === null));
});

test('zbicie 2 wierszy daje 300 punktów', () => {
  const state = lockOn(O_AT_BOTTOM, ['XXXX..XXXX', 'XXXX..XXXX']);
  assert.strictEqual(state.score, 300);
  assert.deepStrictEqual(state.board, emptyBoard());
});

test('zbicie 3 wierszy daje 500 punktów', () => {
  const state = lockOn(I_STANDING, ['..........', 'XXXXX.XXXX', 'XXXXX.XXXX', 'XXXXX.XXXX']);
  assert.strictEqual(state.score, 500);
  assert.strictEqual(state.board[19][5], 'I');
  assert.strictEqual(filledCount(state.board), 1);
});

test('zbicie 4 wierszy naraz daje 800 punktów', () => {
  const state = lockOn(I_STANDING, ['XXXXX.XXXX', 'XXXXX.XXXX', 'XXXXX.XXXX', 'XXXXX.XXXX']);
  assert.strictEqual(state.score, 800);
  assert.deepStrictEqual(state.board, emptyBoard());
});

test('niezbity wiersz między zbitymi opada na dno', () => {
  const state = lockOn(I_STANDING, ['XXXXX.XXXX', 'XXXXX.XXX.', 'XXXXX.XXXX', 'XXXXX.XXXX']);
  assert.strictEqual(state.score, 500);
  assert.deepStrictEqual(state.board[19], [...'XXXXXIXXX.'].map((ch) => (ch === '.' ? null : ch)));
  assert.ok(state.board[18].every((cell) => cell === null));
});

test('punkty dodają się do dotychczasowego wyniku', () => {
  const state = lockOn(O_AT_BOTTOM, ['XXXX..XXXX'], 1000);
  assert.strictEqual(state.score, 1100);
});

test('zatrzymanie bez pełnego wiersza nie daje punktów', () => {
  const state = lockOn(O_AT_BOTTOM, ['XXX...XXXX']);
  assert.strictEqual(state.score, 0);
});

test('koniec gry, gdy nowy klocek nie ma miejsca', () => {
  const start = withPiece(
    game.createGame(sequence('O', 'T')),
    { type: 'O', rotation: 0, row: 18, col: 3 },
    boardWith([[1, 4]])
  );
  const state = game.tick(start);
  assert.strictEqual(state.status, 'over');
});

test('koniec gry, gdy klocek zatrzyma się, wystając ponad planszę', () => {
  const start = withPiece(
    game.createGame(sequence('T', 'O')),
    { type: 'T', rotation: 0, row: -1, col: 7 },
    boardWith([[1, 8]])
  );
  const state = game.tick(start);
  assert.strictEqual(state.status, 'over');
  assert.deepStrictEqual(state.board[0].slice(7, 10), ['T', 'T', 'T']);
});

test('po końcu gry ruch, obrót, tick i pauza nic nie zmieniają', () => {
  const over = { ...game.createGame(sequence('T')), status: 'over' };
  assert.strictEqual(game.moveLeft(over), over);
  assert.strictEqual(game.moveRight(over), over);
  assert.strictEqual(game.rotate(over), over);
  assert.strictEqual(game.tick(over), over);
  assert.strictEqual(game.togglePause(over), over);
});

test('po końcu gry getCells pokazuje samą planszę', () => {
  const over = { ...game.createGame(sequence('T')), board: boardWith([[19, 0]]), status: 'over' };
  assert.deepStrictEqual(game.getCells(over), over.board);
});

test('pauza zatrzymuje grę, ponowne przełączenie ją wznawia', () => {
  const paused = game.togglePause(game.createGame(sequence('T')));
  assert.strictEqual(paused.status, 'paused');
  assert.strictEqual(game.tick(paused), paused);
  assert.strictEqual(game.moveLeft(paused), paused);
  assert.strictEqual(game.moveRight(paused), paused);
  assert.strictEqual(game.rotate(paused), paused);
  assert.strictEqual(game.togglePause(paused).status, 'playing');
});

test('funkcje nie zmieniają przekazanego stanu', () => {
  const states = [
    game.createGame(sequence('T')),
    withPiece(game.createGame(sequence('O', 'T')), O_AT_BOTTOM, boardFrom(['XXXX..XXXX'])),
  ];
  states.forEach((state) => {
    const before = JSON.stringify(state);
    [game.moveLeft, game.moveRight, game.rotate, game.tick, game.togglePause, game.getCells].forEach((fn) => fn(state));
    assert.strictEqual(JSON.stringify(state), before);
  });
});
