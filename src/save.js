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

  // Klocek musi leżeć w kolumnach planszy, nad dnem, na wolnych polach.
  // Ponad planszą wolno najwyżej 4 wiersze (tyle, ile ma siatka klocka).
  function pieceFits(board, piece) {
    return deps.getShape(piece.type, piece.rotation).every(([r, c]) => {
      const row = piece.row + r;
      const col = piece.col + c;
      if (col < 0 || col >= deps.COLS || row >= deps.ROWS || row < -4) return false;
      return row < 0 || board[row][col] === null;
    });
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
    if (!pieceFits(saved.board, saved.piece)) return null;
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

  // Co zrobić z przerwaną grą gościa po zalogowaniu (sekcja 8 wymagań).
  function transferAction(guestSaved, accountSaved) {
    if (!guestSaved) return 'none';
    return accountSaved ? 'ask' : 'move';
  }

  // Identyfikator gościa. crypto.randomUUID nie ma w starych przeglądarkach
  // (Safari < 15.4) ani poza HTTPS — wtedy zapasowy UUID v4.
  function randomId(cryptoObj) {
    if (cryptoObj && typeof cryptoObj.randomUUID === 'function') return cryptoObj.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
      const r = Math.floor(Math.random() * 16);
      return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  Object.assign(exports, { serializeGame, restoreGame, normalizeNick, shouldSave, transferAction, randomId });
})(
  typeof module !== 'undefined' ? module.exports : window.Tetris,
  typeof module !== 'undefined'
    ? { ...require('./pieces.js'), ...require('./game.js') }
    : window.Tetris
);
