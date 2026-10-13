const test = require('node:test');
const assert = require('node:assert');
const pieces = require('../src/pieces.js');

function sorted(cells) {
  return cells.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

test('jest 7 klasycznych klocków', () => {
  assert.deepStrictEqual(pieces.TYPES, ['I', 'O', 'T', 'S', 'Z', 'J', 'L']);
});

test('każdy klocek ma 4 pozycje obrotu po 4 pola w siatce 4×4', () => {
  pieces.TYPES.forEach((type) => {
    [0, 1, 2, 3].forEach((rotation) => {
      const cells = pieces.getShape(type, rotation);
      assert.strictEqual(cells.length, 4, `${type}/${rotation}`);
      cells.forEach(([r, c]) => {
        assert.ok(r >= 0 && r <= 3 && c >= 0 && c <= 3, `${type}/${rotation}: [${r},${c}]`);
      });
    });
  });
});

test('T obraca się zgodnie z ruchem wskazówek zegara', () => {
  assert.deepStrictEqual(sorted(pieces.getShape('T', 0)), [[0, 1], [1, 0], [1, 1], [1, 2]]);
  assert.deepStrictEqual(sorted(pieces.getShape('T', 1)), [[0, 1], [1, 1], [1, 2], [2, 1]]);
  assert.deepStrictEqual(sorted(pieces.getShape('T', 2)), [[1, 0], [1, 1], [1, 2], [2, 1]]);
});

test('I po obrocie stoi pionowo w kolumnie 2 siatki', () => {
  assert.deepStrictEqual(sorted(pieces.getShape('I', 1)), [[0, 2], [1, 2], [2, 2], [3, 2]]);
});

test('O wygląda tak samo w każdej pozycji obrotu', () => {
  [0, 1, 2, 3].forEach((rotation) => {
    assert.deepStrictEqual(sorted(pieces.getShape('O', rotation)), [[0, 1], [0, 2], [1, 1], [1, 2]]);
  });
});

test('wiersz startowy stawia najwyższe pole kształtu w wierszu 0', () => {
  assert.strictEqual(pieces.spawnRow('I'), -1);
  assert.strictEqual(pieces.spawnRow('T'), 0);
  assert.strictEqual(pieces.spawnRow('O'), 0);
});
