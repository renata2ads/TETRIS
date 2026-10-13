(function (exports, pieces) {
  'use strict';

  const ROWS = 20;
  const COLS = 10;
  const SPAWN_COL = 3;
  const LINE_POINTS = [0, 100, 300, 500, 800];

  function emptyRow() {
    return Array(COLS).fill(null);
  }

  function emptyBoard() {
    return Array.from({ length: ROWS }, emptyRow);
  }

  function randomType(random) {
    return pieces.TYPES[Math.floor(random() * pieces.TYPES.length)];
  }

  function newPiece(type) {
    return { type, rotation: 0, row: pieces.spawnRow(type), col: SPAWN_COL };
  }

  // Pola zajmowane przez klocek na planszy: [wiersz, kolumna].
  function pieceCells(piece) {
    return pieces.getShape(piece.type, piece.rotation).map(([r, c]) => [piece.row + r, piece.col + c]);
  }

  function createGame(random) {
    return { board: emptyBoard(), piece: newPiece(randomType(random)), score: 0, status: 'playing', random };
  }

  function getCells(state) {
    const cells = state.board.map((row) => row.slice());
    if (state.status !== 'over') {
      pieceCells(state.piece).forEach(([row, col]) => {
        if (row >= 0) cells[row][col] = state.piece.type;
      });
    }
    return cells;
  }

  // Kolizja: wyjście za lewą, prawą lub dolną krawędź albo zajęte pole. Nad planszą (wiersz < 0) wolno.
  function collides(board, piece) {
    return pieceCells(piece).some(
      ([row, col]) => col < 0 || col >= COLS || row >= ROWS || (row >= 0 && board[row][col] !== null)
    );
  }

  // Przy kolizji zwraca ten sam obiekt stanu — tick() rozpoznaje po tym, że klocek nie może opaść.
  function tryMove(state, change) {
    if (state.status !== 'playing') return state;
    const piece = { ...state.piece, ...change(state.piece) };
    return collides(state.board, piece) ? state : { ...state, piece };
  }

  function moveLeft(state) {
    return tryMove(state, (piece) => ({ col: piece.col - 1 }));
  }

  function moveRight(state) {
    return tryMove(state, (piece) => ({ col: piece.col + 1 }));
  }

  function rotate(state) {
    return tryMove(state, (piece) => ({ rotation: (piece.rotation + 1) % 4 }));
  }

  function tick(state) {
    if (state.status !== 'playing') return state;
    const moved = tryMove(state, (piece) => ({ row: piece.row + 1 }));
    return moved !== state ? moved : lockPiece(state);
  }

  function lockPiece(state) {
    const board = state.board.map((row) => row.slice());
    const cells = pieceCells(state.piece);
    cells.forEach(([row, col]) => {
      if (row >= 0) board[row][col] = state.piece.type;
    });
    const kept = board.filter((row) => row.includes(null));
    const cleared = ROWS - kept.length;
    const nextBoard = [...Array.from({ length: cleared }, emptyRow), ...kept];
    const piece = newPiece(randomType(state.random));
    const overflow = cells.some(([row]) => row < 0);
    return {
      ...state,
      board: nextBoard,
      piece,
      score: state.score + LINE_POINTS[cleared],
      status: overflow || collides(nextBoard, piece) ? 'over' : 'playing',
    };
  }

  function togglePause(state) {
    if (state.status === 'playing') return { ...state, status: 'paused' };
    if (state.status === 'paused') return { ...state, status: 'playing' };
    return state;
  }

  Object.assign(exports, { ROWS, COLS, createGame, getCells, moveLeft, moveRight, rotate, tick, togglePause });
})(
  typeof module !== 'undefined' ? module.exports : window.Tetris,
  typeof module !== 'undefined' ? require('./pieces.js') : window.Tetris
);
