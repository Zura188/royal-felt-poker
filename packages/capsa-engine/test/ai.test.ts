import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseStrongMove, fastCombos, generateCombos, newGame, legalMoves, playCards, pass, sanitizeRules, DEFAULT_RULES, SUIT_ORDERS, STRAIGHT_ORDERS, newDeck, shuffle, sortCards, validatePlay } from '../src/index';
import { seeded } from './helpers';

// Nilai harus valid: sanitizeRules diam-diam mengembalikan nilai tak valid ke bawaan, sehingga varian tidak akan teruji.
const variants = [
  DEFAULT_RULES,
  sanitizeRules({ allowTriple: false, allowFlush: false }),
  sanitizeRules({ suitOrder: SUIT_ORDERS[2], flushRank: 'suit', straightOrder: STRAIGHT_ORDERS[1], straightBeatsFullHouse: true }),
  sanitizeRules({ suitOrder: SUIT_ORDERS[1], straightOrder: STRAIGHT_ORDERS[2] }),
];
test('varian aturan pengujian benar-benar berbeda dari bawaan', () => {
  assert.notEqual(variants[2].straightOrder, DEFAULT_RULES.straightOrder);
  assert.notEqual(variants[2].suitOrder.join(''), DEFAULT_RULES.suitOrder.join(''));
  assert.equal(variants[2].flushRank, 'suit');
  assert.equal(variants[3].straightOrder, STRAIGHT_ORDERS[2]);
  assert.equal(variants[3].suitOrder.join(''), SUIT_ORDERS[1].join(''));
});

test('fastCombos menghasilkan himpunan yang sama dengan generateCombos', () => {
  for (const rules of variants) {
    for (let n = 0; n < 60; n++) {
      const rng = seeded(n + 1);
      const hand = sortCards(shuffle(newDeck(), rng).slice(0, 13), rules);
      const a = generateCombos(hand, rules).map((c) => c.cards.map((x) => x.r + x.s).join()).sort();
      const b = fastCombos(hand, rules).map((c) => c.cards.map((x) => x.r + x.s).join()).sort();
      assert.deepEqual(b, a);
    }
  }
});

test('bot kuat selalu memilih langkah sah dan menyelesaikan game', () => {
  for (let n = 0; n < 6; n++) {
    let g = newGame(DEFAULT_RULES, { rng: seeded(100 + n), previousWinner: 0 });
    let guard = 0;
    while (g.phase === 'playing' && guard++ < 400) {
      const mv = chooseStrongMove(g, g.turn, { worlds: 6, minWorlds: 3, thinkMs: 20 });
      if (mv) { assert.ok(validatePlay(g, g.turn, mv).ok); g = playCards(g, g.turn, mv).state; }
      else { assert.ok(g.trick.combo && legalMoves(g, g.turn).length >= 0); g = pass(g, g.turn).state; }
    }
    assert.equal(g.phase, 'over');
    assert.equal(g.result!.deltas.reduce((a, b) => a + b, 0), 0);
  }
});
