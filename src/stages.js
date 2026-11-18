// The stages. The first five are drawn by hand and each teaches one idea; from stage 6 on they
// are made from the stage number, so there is always a next one (and everyone gets the same
// stage 37).
//
// Difficulty comes from two things: how high Poko has to climb (the rows from his start up to
// the door) and the shapes of the falling blocks (friendly little pieces early, awkward ones
// later). The magma's speed is then worked out from the work each stage takes, so every stage
// is fair.
import * as v1 from './gen/v1.js';
import * as v2 from './gen/v2.js';
import * as v3 from './gen/v3.js';
import * as wide from './gen/wide.js';
import { isBridge, bridge } from './gen/bridge.js';

// The board is 12 × 18 cells (it was 10 × 15 until 17 Nov 2026).
const EMPTY_ROW = '............';
const top = (n) => Array(n).fill(EMPTY_ROW);

const HAND_MAPS = [
  // 1. Fill the hole. (The door sits up a little rock stair Poko climbs by himself.)
  { gentle: true, rows: [...top(12),
    '...........E',
    '..........##',
    'R...*..*.###',
    '######..####',
    '######*.####',
    '############'] },
  // 2. A wall: give Poko some steps.
  { gentle: true, rows: [...top(12),
    '...*.....*.E',
    '........####',
    '........####',
    'R...*...####',
    '############',
    '############'] },
  // 3. The tower: a long staircase.
  { gentle: true, rows: [...top(9),
    '..........*E',
    '..........##',
    '..........##',
    '.......*..##',
    '.......#..##',
    '.......#..##',
    'R...*..#..##',
    '############',
    '############'] },
  // 4. Poko heads the wrong way: stop him or fill the hole.
  { rows: [...top(12),
    '..........*E',
    '..........##',
    '..*.....L###',
    '#...########',
    '#*..########',
    '############'] },
  // 5. Bombs clear blocks (never rock).
  { bombs: true, first: ['bomb'], rows: [...top(12),
    '......*.....',
    '......BB...E',
    '......BB..##',
    'R...*.BB*###',
    '############',
    '############'] },
];

// For the rest of the game and the tests.
export const { shapeHardness, pieceWeights, climbMedian, climbOf, walksHome, planPath, checkpoints, timing, magmaSpeed } = v1;

/**
 * Which stage maker makes which stage numbers. A released stage must never change, so a new
 * maker (gen/v2.js, ...) only ever takes over from a stage number nobody has reached yet:
 * add { from: <that number>, make: v2.generate } at the end.
 */
//
// v2 replaced v1 for every stage on 17 Nov 2026, one day after the game first went public
// (doors raised after phone play-testing); the fingerprints were recorded again then. From now
// on, only add eras.
//
// v3 (the 12 × 18 board) replaced v2 for every stage the same day, after more play-testing.
//
// Bridge stages (gen/bridge.js) took over one stage in five from stage 11 on 18 Nov 2026
// (13, 18, 23, ...): high cliffs, the gold across a valley.
const ERAS = [
  { from: 6, make: v3.generate },
  { from: 11, make: (n) => (isBridge(n) ? bridge(n, 12) : v3.generate(n)) },
];

/** Stage n (6 and up), made from its number by the maker of its era. */
export function generateStage(n) {
  return ERAS.filter((e) => n >= e.from).pop().make(n); // (not findLast: older phones lack it)
}

export const HAND = HAND_MAPS.map((def, i) => ({ ...def, water: v1.magmaSpeed(def, i + 1), weights: v1.pieceWeights(i + 1) }));

/**
 * Stage n. With { wide: true }, the PC version's 24-column stage of that number instead: the
 * same lessons and difficulty curve on a board twice as wide (see gen/wide.js).
 */
export function getStage(n, { wide: isWide = false } = {}) {
  if (!isWide) return n <= HAND.length ? HAND[n - 1] : generateStage(n);
  if (n <= HAND_MAPS.length) {
    const def = wide.widenHand(HAND_MAPS[n - 1]);
    return { ...def, water: v1.magmaSpeed(def, n), weights: v1.pieceWeights(n) };
  }
  return isBridge(n) ? bridge(n, wide.W) : wide.generate(n);
}

/** Stages 1 to RELEASED are recorded in tests/stage-fingerprints.json and may never change. */
export const RELEASED = 1000;
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${k}:${canon(v[k])}`).join(',')}}`
  : String(v));
/** A short code for a stage's exact contents: the same code means the very same stage. */
export function stageFingerprint(def) {
  const s = canon(def);
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    a = Math.imul(a ^ s.charCodeAt(i), 0x01000193) >>> 0;
    b = Math.imul(b ^ s.charCodeAt(i), 0x5bd1e995) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}
