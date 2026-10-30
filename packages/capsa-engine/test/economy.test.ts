import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_LINES, WHEEL, WHEEL_SLICE_DEG, chipLabel, formatChips, pickWheel, wheelAngle, wheelIndexAt,
} from '@rfp/shared';
import {
  DEFAULT_RULES, DEFAULT_STAKE, MAX_STAKE, RANKING_UNITS, STAKE_TIERS, abandonPenalty, fiveCardLadder, maxLoss, newGame, playCards, sanitizeRules, settle,
  type GameState,
} from '../src/index';
import { cards, seeded } from './helpers';

test('taruhan: delapan tingkat naik terus, maksimal 1.000.000, bawaan termasuk daftar', () => {
  assert.equal(STAKE_TIERS.length, 8);
  assert.equal(STAKE_TIERS[STAKE_TIERS.length - 1], 1_000_000);
  assert.equal(MAX_STAKE, 1_000_000);
  for (let i = 1; i < STAKE_TIERS.length; i++) assert.ok(STAKE_TIERS[i] > STAKE_TIERS[i - 1], 'harus menaik');
  assert.ok((STAKE_TIERS as readonly number[]).includes(DEFAULT_STAKE));
  assert.equal(RANKING_UNITS.reduce((a, b) => a + b, 0), 0);
});

test('taruhan 1.000.000: pembayaran peringkat seimbang (jumlah nol) dan syarat duduk benar', () => {
  const g = {
    rules: DEFAULT_RULES, stake: 1_000_000, finished: [2, 0, 3], hands: [[], [{ r: 'K', s: '♠', v: 13 }], [], []],
  } as unknown as GameState;
  const r = settle(g);
  assert.deepEqual(r.order, [2, 0, 3, 1]);
  assert.equal(r.deltas[2], 8_000_000);
  assert.equal(r.deltas[0], 2_000_000);
  assert.equal(r.deltas[3], -4_000_000);
  assert.equal(r.deltas[1], -6_000_000);
  assert.equal(r.deltas.reduce((a, b) => a + b, 0), 0);
  assert.equal(maxLoss(DEFAULT_RULES, 1_000_000), 6_000_000);
  assert.equal(maxLoss(sanitizeRules({ scoring: 'first' }), 1_000_000), 39_000_000);
  // angka besar tetap bilangan bulat aman dan tampil dengan titik ribuan
  assert.ok(Number.isSafeInteger(maxLoss(sanitizeRules({ scoring: 'first' }), MAX_STAKE)));
  assert.equal(formatChips(8_000_000), '8.000.000');
});

test('taruhan 1.000.000 di mode menang-pertama: lawan membayar sesuai sisa kartu', () => {
  const first = sanitizeRules({ scoring: 'first', firstPlayer: 'winner' });
  let g: GameState = {
    rules: first, stake: 1_000_000, turn: 0, starter: 0, finished: [], phase: 'playing', mustInclude: null, plays: [], result: null,
    trick: { combo: null, by: null, passed: [false, false, false, false] },
    hands: [cards('5♠'), cards('6♠ 6♦ 7♦ 8♦ 9♦ 10♦ J♦ Q♦ K♦ A♦ 3♦ 4♦ 5♦'), cards('7♣ 8♣'), cards('3♣ 4♣ J♦')],
  };
  g = playCards(g, 0, cards('5♠')).state;
  assert.equal(g.result!.deltas[1], -39_000_000);
  assert.equal(g.result!.deltas[2], -2_000_000);
  assert.equal(g.result!.deltas[3], -3_000_000);
  assert.equal(g.result!.deltas[0], 44_000_000);
  assert.equal(g.result!.deltas.reduce((a, b) => a + b, 0), 0);
});

test('chipLabel: label ringkas untuk semua tingkat taruhan', () => {
  assert.deepEqual(STAKE_TIERS.map((s) => chipLabel(s)), ['100', '500', '2K', '10K', '50K', '100K', '500K', '1JT']);
  assert.equal(chipLabel(1_500_000), '1,5JT');
  assert.equal(chipLabel(2_500), '2,5K');
  assert.equal(chipLabel(0), '0');
  assert.equal(chipLabel(-5), '0');
});

test('obrolan cepat: ada, unik, pendek, dan tidak kosong', () => {
  assert.ok(CHAT_LINES.length >= 8);
  assert.equal(new Set(CHAT_LINES).size, CHAT_LINES.length);
  for (const l of CHAT_LINES) assert.ok(l.length > 0 && l.length <= 14, l);
});

test('roda: bobot, hadiah tertinggi 1.000.000, dan pemilihan mencakup semua irisan', () => {
  assert.equal(WHEEL.length, 8);
  assert.equal(Math.max(...WHEEL.map((s) => s.prize)), 1_000_000);
  assert.equal(WHEEL.reduce((a, s) => a + s.weight, 0), 100);
  assert.equal(new Set(WHEEL.map((s) => s.prize)).size, WHEEL.length);
  // rng ekstrem
  assert.equal(pickWheel(() => 0), 0);
  assert.equal(pickWheel(() => 0.9999999), WHEEL.length - 1);
  assert.equal(pickWheel(() => 5), WHEEL.length - 1); // di luar rentang tetap aman
  assert.equal(pickWheel(() => -1), 0);
  // sapuan rata: tiap irisan terpilih sebanding bobotnya
  const hit = new Array(WHEEL.length).fill(0);
  const N = 20000;
  for (let i = 0; i < N; i++) hit[pickWheel(() => (i + 0.5) / N)]++;
  WHEEL.forEach((s, i) => assert.ok(Math.abs(hit[i] / N - s.weight / 100) < 0.002, `irisan ${i}`));
  const ev = WHEEL.reduce((a, s) => a + (s.prize * s.weight) / 100, 0);
  assert.ok(ev > 50_000 && ev < 150_000, `nilai harapan ${ev}`);
});

test('roda: sudut akhir selalu berhenti di irisan yang dituju, juga dengan geseran', () => {
  const rng = seeded(3);
  for (let i = 0; i < WHEEL.length; i++) {
    for (const j of [-1, -0.5, 0, 0.5, 1]) assert.equal(wheelIndexAt(wheelAngle(i, 6, j)), i, `i=${i} j=${j}`);
    for (let k = 0; k < 20; k++) assert.equal(wheelIndexAt(wheelAngle(i, 5 + (k % 3), rng() * 2 - 1)), i);
  }
  // putaran searah jarum jam dan cukup banyak
  assert.ok(wheelAngle(0, 6, 0) > 5 * 360);
  assert.equal(WHEEL_SLICE_DEG, 45);
});

test('tangga kombinasi 5 kartu mengikuti aturan', () => {
  assert.deepEqual(fiveCardLadder(DEFAULT_RULES), ['straight', 'flush', 'fullhouse', 'quad', 'straightflush']);
  assert.deepEqual(fiveCardLadder(sanitizeRules({ straightBeatsFullHouse: true })), ['flush', 'fullhouse', 'straight', 'quad', 'straightflush']);
  assert.deepEqual(fiveCardLadder(sanitizeRules({ allowFlush: false })), ['straight', 'fullhouse', 'quad', 'straightflush']);
});

test('penalti keluar di tengah game tidak pernah melebihi "kalah maks." meja', () => {
  for (const scoring of ['ranking', 'first'] as const) {
    const rules = sanitizeRules({ scoring });
    for (const stake of STAKE_TIERS) {
      const g = newGame(rules, { stake });
      const mine = abandonPenalty(g, 0); // 13 kartu di tangan
      assert.ok(mine <= maxLoss(rules, stake), `${scoring} ${stake}: ${mine} > ${maxLoss(rules, stake)}`);
      if (scoring === 'ranking') assert.equal(mine, 6 * stake); // 13 kartu: sama seperti finis terakhir
      else assert.equal(mine, 39 * stake);
    }
  }
  // sisa kartu sedikit tetap lebih murah daripada finis terakhir (mode peringkat)
  const g = newGame(sanitizeRules({ scoring: 'ranking' }), { stake: 1_000_000 });
  g.hands[0] = g.hands[0].slice(0, 2);
  assert.equal(abandonPenalty(g, 0), 2_000_000);
});
