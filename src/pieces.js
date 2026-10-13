(function (exports) {
  'use strict';

  const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

  // Pozycja obrotu 0 każdego klocka: pola [wiersz, kolumna] w kwadracie size × size.
  const BASE = {
    I: { size: 4, cells: [[1, 0], [1, 1], [1, 2], [1, 3]] },
    T: { size: 3, cells: [[0, 1], [1, 0], [1, 1], [1, 2]] },
    S: { size: 3, cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
    Z: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },
    J: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [1, 2]] },
    L: { size: 3, cells: [[0, 2], [1, 0], [1, 1], [1, 2]] },
  };
  const O_CELLS = [[0, 1], [0, 2], [1, 1], [1, 2]];

  function rotateClockwise(cells, size) {
    return cells.map(([r, c]) => [c, size - 1 - r]);
  }

  function buildRotations(type) {
    if (type === 'O') return [O_CELLS, O_CELLS, O_CELLS, O_CELLS];
    const { size, cells } = BASE[type];
    const rotations = [cells];
    for (let i = 1; i < 4; i++) rotations.push(rotateClockwise(rotations[i - 1], size));
    return rotations;
  }

  const SHAPES = {};
  TYPES.forEach((type) => {
    SHAPES[type] = buildRotations(type);
  });

  function getShape(type, rotation) {
    return SHAPES[type][rotation];
  }

  function spawnRow(type) {
    // "0 -" zamiast "-", żeby dla 0 nie powstało -0.
    return 0 - Math.min(...SHAPES[type][0].map(([r]) => r));
  }

  Object.assign(exports, { TYPES, getShape, spawnRow });
})(typeof module !== 'undefined' ? module.exports : (window.Tetris = window.Tetris || {}));
