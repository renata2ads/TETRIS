const test = require('node:test');
const assert = require('node:assert');
const space = require('../src/space.js');

test('sideX: klocki pojawiają się tylko przy lewej lub prawej krawędzi, nigdy na środku', () => {
  const width = 1000;
  for (let i = 0; i < 200; i++) {
    let n = 0;
    const values = [Math.random(), Math.random()];
    const x = space.sideX(width, () => values[n++]);
    assert.ok(x <= width * 0.25 || x >= width * 0.75, `x=${x}`);
    assert.ok(x >= 0 && x <= width, `x=${x}`);
  }
});

test('titleLetters: kolejne litery w kolorach klocków, spacje bez koloru i opóźnienia', () => {
  const letters = space.titleLetters('Ab c');
  assert.deepStrictEqual(
    letters.map((l) => l.ch),
    ['A', 'b', ' ', 'c']
  );
  assert.strictEqual(letters[0].color, '#00c8e0');
  assert.strictEqual(letters[1].color, '#f5d000');
  assert.strictEqual(letters[2].space, true);
  assert.strictEqual(letters[3].color, '#a040e0');
  assert.deepStrictEqual([letters[0].delay, letters[1].delay, letters[3].delay], [0, 90, 180]);
});

test('titleLetters: po siedmiu literach kolory zaczynają się od nowa', () => {
  const letters = space.titleLetters('abcdefgh');
  assert.strictEqual(letters[7].color, letters[0].color);
});
