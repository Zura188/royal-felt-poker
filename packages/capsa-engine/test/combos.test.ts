import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beats, DEFAULT_RULES, evaluateCombo, generateCombos, sanitizeRules, type Rules } from '../src/index';
import { cards } from './helpers';

const R = DEFAULT_RULES;
const ev = (t: string, r: Rules = R) => evaluateCombo(cards(t), r);
const wins = (a: string, b: string, r: Rules = R) => {
  const x = ev(a, r), y = ev(b, r);
  assert.ok(x && y, `kombinasi tidak sah: ${a} / ${b}`);
  return beats(x, y, r);
};

test('mengenali jenis kombinasi', () => {
  assert.equal(ev('3♦')?.kind, 'single');
  assert.equal(ev('5♠ 5♦')?.kind, 'pair');
  assert.equal(ev('5♠ 5♦ 5♣')?.kind, 'triple');
  assert.equal(ev('3♦ 4♣ 5♠ 6♥ 7♦')?.kind, 'straight');
  assert.equal(ev('3♦ 9♦ 5♦ 6♦ J♦')?.kind, 'flush');
  assert.equal(ev('5♠ 5♦ 5♣ 9♥ 9♠')?.kind, 'fullhouse');
  assert.equal(ev('5♠ 5♦ 5♣ 5♥ 9♠')?.kind, 'quad');
  assert.equal(ev('3♦ 4♦ 5♦ 6♦ 7♦')?.kind, 'straightflush');
});

test('menolak kombinasi tidak sah', () => {
  assert.equal(ev('5♠ 6♦'), null);
  assert.equal(ev('5♠ 5♦ 6♣'), null);
  assert.equal(ev('5♠ 5♦ 6♣ 6♥'), null); // 4 kartu tidak ada
  assert.equal(ev('3♦ 4♣ 5♠ 6♥ 8♦'), null);
  assert.equal(ev('J♦ Q♣ K♠ A♥ 2♦'), null); // tidak boleh melingkar lewat A-2
  assert.equal(ev('Q♦ K♣ A♠ 2♥ 3♦'), null);
  assert.equal(ev('3♦ 3♦'), null);
});

test('urutan angka: 2 tertinggi, 3 terendah', () => {
  assert.ok(wins('2♦', 'A♠'));
  assert.ok(wins('A♦', 'K♠'));
  assert.ok(wins('4♦', '3♠'));
});

test('urutan suit mengikuti aturan (♠>♥>♣>♦)', () => {
  assert.ok(wins('5♠', '5♥'));
  assert.ok(wins('5♥', '5♣'));
  assert.ok(wins('5♣', '5♦'));
  const flipped = sanitizeRules({ suitOrder: ['♦', '♥', '♠', '♣'] });
  assert.ok(wins('5♦', '5♥', flipped));
  assert.ok(wins('5♠', '5♣', flipped));
});

test('pair dibandingkan dengan kartu tertinggi (suit)', () => {
  assert.ok(wins('7♠ 7♦', '7♥ 7♣'));
  assert.ok(wins('8♦ 8♣', '7♠ 7♥'));
});

test('hierarki 5 kartu: straight < flush < full house < four < straight flush', () => {
  assert.ok(wins('3♦ 9♦ 5♦ 6♦ J♦', '3♦ 4♣ 5♠ 6♥ 7♦'));
  assert.ok(wins('5♠ 5♦ 5♣ 9♥ 9♠', '3♦ 9♦ 5♦ 6♦ J♦'));
  assert.ok(wins('4♠ 4♦ 4♣ 4♥ 9♠', '2♠ 2♦ 2♣ 9♥ 9♠'));
  assert.ok(wins('3♦ 4♦ 5♦ 6♦ 7♦', '2♠ 2♦ 2♣ 2♥ A♠'));
});

test('urutan straight khusus mengikuti pengaturan', () => {
  const a2345 = 'A♦ 2♣ 3♠ 4♥ 5♦', s23456 = '2♦ 3♣ 4♠ 5♥ 6♦', t10 = '10♦ J♣ Q♠ K♥ A♦', mid = '8♦ 9♣ 10♠ J♥ Q♦';
  // bawaan: A2345 > 23456 > 10JQKA
  assert.ok(wins(a2345, s23456));
  assert.ok(wins(s23456, t10));
  assert.ok(wins(t10, mid));
  const r2 = sanitizeRules({ straightOrder: '10JQKA>23456>A2345' });
  assert.ok(wins(t10, s23456, r2));
  assert.ok(wins(s23456, a2345, r2));
  const r3 = sanitizeRules({ straightOrder: '23456>10JQKA>A2345' });
  assert.ok(wins(s23456, t10, r3));
  assert.ok(wins(t10, a2345, r3));
});

test('straight biasa dibandingkan dengan kartu tertinggi lalu suit', () => {
  assert.ok(wins('4♦ 5♣ 6♠ 7♥ 8♦', '3♦ 4♣ 5♠ 6♥ 7♦'));
  assert.ok(wins('3♦ 4♣ 5♠ 6♥ 7♠', '3♦ 4♣ 5♠ 6♥ 7♦'));
});

test('flush: urutan suit-dulu vs nomor-dulu', () => {
  const spadeLow = '3♠ 4♠ 6♠ 8♠ 9♠', heartHigh = 'K♥ Q♥ 10♥ 8♥ 5♥';
  const num = sanitizeRules({ flushRank: 'number' });
  assert.ok(wins(heartHigh, spadeLow, num));
  const suit = sanitizeRules({ flushRank: 'suit' });
  assert.ok(wins(spadeLow, heartHigh, suit));
});

test('full house dan four of a kind dibanding menurut angka triple/quad', () => {
  assert.ok(wins('9♠ 9♦ 9♣ 4♥ 4♠', '8♠ 8♦ 8♣ A♥ A♠'));
  assert.ok(wins('7♠ 7♦ 7♣ 7♥ 3♠', '6♠ 6♦ 6♣ 6♥ 2♠'));
});

test('aturan: triple, flush dapat dimatikan', () => {
  const r = sanitizeRules({ allowTriple: false, allowFlush: false });
  assert.equal(ev('5♠ 5♦ 5♣', r), null);
  assert.equal(ev('3♦ 9♦ 5♦ 6♦ J♦', r), null);
  assert.equal(ev('3♦ 4♦ 5♦ 6♦ 7♦', r)?.kind, 'straightflush'); // straight flush tetap sah
});

test('aturan: straight mengalahkan full house bila diizinkan', () => {
  const st = '3♦ 4♣ 5♠ 6♥ 7♦', fh = '5♠ 5♦ 5♣ 9♥ 9♠';
  assert.ok(!wins(st, fh));
  const r = sanitizeRules({ straightBeatsFullHouse: true });
  assert.ok(wins(st, fh, r));
  assert.ok(wins('5♠ 5♦ 5♣ 5♥ 9♠', st, r)); // four tetap di atas
});

test('generateCombos hanya menghasilkan kombinasi sah dan menemukan semua pair', () => {
  const hand = cards('3♦ 3♣ 4♠ 4♥ 4♦ 5♣ 6♠ 7♥ 9♦ J♣ Q♠ K♥ 2♦');
  const all = generateCombos(hand, R);
  assert.ok(all.every((c) => evaluateCombo(c.cards, R)));
  assert.equal(all.filter((c) => c.kind === 'single').length, 13);
  assert.equal(all.filter((c) => c.kind === 'pair').length, 1 + 3); // 3-3 dan tiga pasang dari 4-4-4
  assert.equal(all.filter((c) => c.kind === 'triple').length, 1);
  assert.ok(all.some((c) => c.kind === 'straight')); // 3-4-5-6-7
});

test('sanitizeRules memperbaiki data rusak', () => {
  const r = sanitizeRules({ suitOrder: ['x'] as never, penalty: 'aneh' as never, scoring: 'zzz' as never });
  assert.deepEqual(r, R);
});
