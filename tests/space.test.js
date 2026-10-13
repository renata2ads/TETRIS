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

test('profileFor: natężenie animacji zależnie od ekranu i ustawienia tła', () => {
  assert.strictEqual(space.profileFor('off', 'full'), null);
  assert.strictEqual(space.profileFor('paused', 'full').animate, false);
  assert.strictEqual(space.profileFor('game', 'off').animate, false);
  const calm = space.profileFor('game', 'calm');
  const full = space.profileFor('game', 'full');
  const scene = space.profileFor('scene', 'off');
  assert.strictEqual(calm.animate, true);
  assert.strictEqual(full.animate, true);
  assert.strictEqual(scene.animate, true, 'ekran powitalny zawsze w pełni');
  assert.ok(calm.maxPieces < full.maxPieces);
  assert.ok(calm.pieceGap[0] > full.pieceGap[0]);
  assert.ok(calm.meteorGap[0] > full.meteorGap[0]);
  assert.strictEqual(calm.parallax, false);
  assert.strictEqual(full.parallax, true);
  assert.deepStrictEqual(space.profileFor('dim', 'full'), calm, 'koniec gry spokojnie');
});

test('nextLevel: Spokojne → Pełne → Wyłączone → Spokojne', () => {
  assert.strictEqual(space.nextLevel('calm'), 'full');
  assert.strictEqual(space.nextLevel('full'), 'off');
  assert.strictEqual(space.nextLevel('off'), 'calm');
  assert.strictEqual(space.nextLevel('cokolwiek'), 'calm');
});
