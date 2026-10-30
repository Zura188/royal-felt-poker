import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  abandonPenalty, chooseMove, maxLoss, playStats, DEFAULT_RULES, legalMoves, newGame, pass, penaltyFor, penaltyMultiplier,
  playCards, sameCard, sanitizeRules, THREE_DIAMONDS, validatePlay, type GameState, type Rules,
} from '../src/index';
import { cards, seeded } from './helpers';

const R = DEFAULT_RULES;
const FIRST: Rules = sanitizeRules({ firstPlayer: 'lowest' });

test('pengocokan: 52 kartu unik, 13 per pemain', () => {
  const g = newGame(R, { rng: seeded(1) });
  const all = g.hands.flat();
  assert.equal(all.length, 52);
  assert.equal(new Set(all.map((c) => c.r + c.s)).size, 52);
  g.hands.forEach((h) => assert.equal(h.length, 13));
});

test('game pertama dibuka pemegang 3♦ yang wajib memakai 3♦', () => {
  const g = newGame(FIRST, { rng: seeded(7) });
  assert.ok(g.hands[g.turn].some((c) => sameCard(c, THREE_DIAMONDS)));
  assert.deepEqual(g.mustInclude, THREE_DIAMONDS);
  const other = g.hands[g.turn].find((c) => !sameCard(c, THREE_DIAMONDS))!;
  const bad = validatePlay(g, g.turn, [other]);
  assert.equal(bad.ok, false);
  assert.ok(validatePlay(g, g.turn, [THREE_DIAMONDS]).ok);
});

test('aturan "pemenang" membuka game berikutnya bebas', () => {
  const g = newGame(R, { rng: seeded(3), previousWinner: 2 });
  assert.equal(g.turn, 2);
  assert.equal(g.mustInclude, null);
  const g2 = newGame(R, { rng: seeded(3), previousWinner: null });
  assert.deepEqual(g2.mustInclude, THREE_DIAMONDS);
});

function custom(hands: string[], turn = 0, rules: Rules = R): GameState {
  const g = newGame(rules, { rng: seeded(1), previousWinner: turn });
  g.hands = hands.map((h) => cards(h));
  g.turn = turn;
  return g;
}

test('harus jumlah kartu sama dan lebih tinggi; pembuka tidak boleh pass', () => {
  let g = custom(['5♠ 5♦ 9♣', '6♠ 6♦ K♣ A♦', '7♣ 8♣ 9♦', '3♣ 4♣ J♦'], 0);
  assert.ok(pass(g, 0).error); // pembuka
  g = playCards(g, 0, cards('5♠ 5♦')).state; // pair
  assert.equal(g.turn, 1);
  assert.ok(playCards(g, 1, cards('K♣')).error); // beda jumlah
  assert.ok(playCards(g, 1, cards('K♣ A♦')).error); // bukan pair
  assert.ok(!playCards(g, 1, cards('6♠ 6♦')).error);
});

test('pass mengunci pemain sampai putaran baru; 3 pass mengembalikan giliran ke pemain terakhir', () => {
  let g = custom(['5♠ 9♣ K♦', '6♠ 8♦ K♣', '7♣ 8♣ Q♦', '3♣ 4♣ J♦'], 0);
  g = playCards(g, 0, cards('5♠')).state;
  g = pass(g, 1).state;
  g = playCards(g, 2, cards('Q♦')).state;
  g = pass(g, 3).state;
  assert.equal(g.turn, 0); // pemain 1 sudah terkunci
  g = playCards(g, 0, cards('K♦')).state; // 0 mengalahkan Q
  assert.equal(g.turn, 2); // 1 terkunci, 3 terkunci -> 2
  g = pass(g, 2).state;
  // semua lawan pass: 0 membuka putaran baru
  assert.equal(g.turn, 0);
  assert.equal(g.trick.combo, null);
  assert.deepEqual(g.trick.passed, [false, false, false, false]);
});

test('mode first: game selesai saat satu pemain habis; penalti dengan pengali', () => {
  const rules = sanitizeRules({ scoring: 'first' });
  let g = custom(['5♠', '6♠ 6♦ 7♦ 8♦ 9♦ 10♦ J♦ Q♦ K♦ A♦ 3♦ 4♦ 5♦', '7♣ 8♣', '3♣ 4♣ J♦'], 0, rules);
  g = playCards(g, 0, cards('5♠')).state;
  assert.equal(g.phase, 'over');
  const res = g.result!;
  assert.equal(res.order[0], 0);
  // pemain 1: 13 kartu => x3, pemain 2: 2 kartu => x1, pemain 3: 3 kartu => x1
  assert.equal(res.deltas[1], -penaltyFor(13, rules, 500));
  assert.equal(res.deltas[1], -500 * 13 * 3);
  assert.equal(res.deltas[2], -1000);
  assert.equal(res.deltas[0], -(res.deltas[1] + res.deltas[2] + res.deltas[3]));
  assert.equal(res.deltas.reduce((a, b) => a + b, 0), 0);
});

test('pengali penalti kedua skema', () => {
  assert.deepEqual([9, 10, 12, 13].map((n) => penaltyMultiplier(n, '10x2,13x3')), [1, 2, 2, 3]);
  assert.deepEqual([7, 8, 9, 10, 12, 13].map((n) => penaltyMultiplier(n, '8x2,10x3,13x4')), [1, 2, 2, 3, 3, 4]);
  const g = custom(['5♠ 6♠', '7♣', '8♣', '9♦'], 0);
  assert.equal(abandonPenalty(g, 0), 1000);
  g.stake = 2000;
  assert.equal(abandonPenalty(g, 0), 4000);
});

test('mode peringkat berlanjut sampai 3 pemain habis dan membayar menurut posisi', () => {
  let g = custom(['4♠', '5♠', '6♠', '7♠ 8♠'], 0); // semua hampir habis
  g = playCards(g, 0, cards('4♠')).state; // pemain 0 habis
  assert.equal(g.phase, 'playing');
  assert.deepEqual(g.finished, [0]);
  g = playCards(g, 1, cards('5♠')).state; // 5♠ tidak mengalahkan 4♠? 5 > 4 sah
  assert.deepEqual(g.finished, [0, 1]);
  g = playCards(g, 2, cards('6♠')).state;
  assert.equal(g.phase, 'over');
  assert.deepEqual(g.result!.order, [0, 1, 2, 3]);
  assert.deepEqual(g.result!.deltas, [4000, 1000, -2000, -3000]); // taruhan bawaan 500
});

test('bila pemain terakhir yang main sudah habis, pembuka berikutnya adalah pemain setelahnya', () => {
  let g = custom(['4♠', '5♠ 9♦', '6♠ 9♥', '7♠ 9♣'], 0);
  g = playCards(g, 0, cards('4♠')).state;
  g = pass(g, 1).state;
  g = pass(g, 2).state;
  g = pass(g, 3).state;
  assert.equal(g.turn, 1);
  assert.equal(g.trick.combo, null);
});

test('simulasi 400 game bot vs bot: selalu sah, selesai, kartu terjaga, skor nol-jumlah', () => {
  const variants: Rules[] = [
    R,
    sanitizeRules({ scoring: 'first', firstPlayer: 'lowest' }),
    sanitizeRules({ allowTriple: false, allowFlush: false, straightBeatsFullHouse: true, penalty: '8x2,10x3,13x4' }),
    sanitizeRules({ suitOrder: ['♦', '♥', '♠', '♣'], flushRank: 'suit', straightOrder: '10JQKA>23456>A2345' }),
  ];
  let games = 0;
  for (let n = 0; n < 400; n++) {
    const rules = variants[n % variants.length];
    const rng = seeded(n + 100);
    let g = newGame(rules, { rng, previousWinner: n % 3 === 0 ? null : n % 4 });
    let steps = 0;
    while (g.phase === 'playing') {
      assert.ok(++steps < 400, 'game tidak berakhir');
      const p = g.turn;
      const move = chooseMove(g, p, rng);
      const r = move ? playCards(g, p, move) : pass(g, p);
      assert.equal(r.error, undefined, `langkah bot tidak sah: ${r.error}`);
      g = r.state;
      const total = g.hands.reduce((a, h) => a + h.length, 0) + g.plays.reduce((a, pl) => a + (pl.combo?.cards.length ?? 0), 0);
      assert.equal(total, 52);
    }
    assert.ok(g.result);
    assert.equal(g.result!.deltas.reduce((a, b) => a + b, 0), 0);
    assert.equal(new Set(g.result!.order).size, 4);
    games++;
  }
  assert.equal(games, 400);
});

test('legalMoves selalu ada saat membuka putaran', () => {
  for (let n = 0; n < 50; n++) {
    const g = newGame(R, { rng: seeded(n), previousWinner: 0 });
    assert.ok(legalMoves(g, 0).length > 0);
  }
});

test('taruhan meja memengaruhi skor di kedua mode; batas kalah maksimum', () => {
  const first = sanitizeRules({ scoring: 'first' });
  let g = custom(['5♠', '6♠ 6♦ 7♦ 8♦ 9♦ 10♦ J♦ Q♦ K♦ A♦ 3♦ 4♦ 5♦', '7♣ 8♣', '3♣ 4♣ J♦'], 0, first);
  g.stake = 2000;
  g = playCards(g, 0, cards('5♠')).state;
  assert.equal(g.result!.deltas[1], -2000 * 13 * 3);
  assert.equal(g.result!.deltas[2], -2000 * 2);
  assert.equal(maxLoss(first, 2000), 2000 * 13 * 3);
  assert.equal(maxLoss(sanitizeRules({ scoring: 'ranking' }), 2000), 12000);
  let r = custom(['4♠', '5♠', '6♠', '7♠ 8♠'], 0);
  r.stake = 100;
  r = playCards(r, 0, cards('4♠')).state; r = playCards(r, 1, cards('5♠')).state; r = playCards(r, 2, cards('6♠')).state;
  assert.deepEqual(r.result!.deltas, [800, 200, -400, -600]);
});

test('playStats menghitung kombinasi yang dimainkan', () => {
  let g = custom(['3♦ 3♣ 5♠ 6♠ 7♠ 8♠ 9♠ 10♦', '4♣ 4♦ 9♥ 9♦', 'K♣ A♦', 'Q♦ J♥'], 0);
  g = playCards(g, 0, cards('3♦ 3♣')).state;
  g = pass(g, 1).state; g = pass(g, 2).state; g = pass(g, 3).state;
  g = playCards(g, 0, cards('5♠ 6♠ 7♠ 8♠ 9♠')).state;
  const st = playStats(g, 0);
  assert.deepEqual(st, { plays: 2, pairs: 1, triples: 0, fiveCards: 1, bombs: 1 });
});
