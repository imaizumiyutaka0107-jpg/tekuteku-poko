// Bridge stages (added 18 Nov 2026). FROZEN once released, like the other stage makers.
//
// Poko starts on a high cliff; the gold is on another high cliff across a valley. The player
// builds him a bridge over it before he walks off the edge (blocks fall to the valley floor,
// so a bridge stands on pillars; rock stumps in the valley help on wide ones). He is high up,
// so the magma has a long way to rise: the pressure is his walk towards the edge.
//
// Works for any board width: the phone's 12 columns and the PC version's 24. Uses v1's checks
// (Poko's walk, the cheapest path, the magma timing), which read each map's own width.
import { mulberry32, walksHome, checkpoints, timing, pieceWeights } from './v1.js';

const H = 18;

/** Is stage n a bridge stage? One in five, from stage 11 (13, 18, 23, ...). */
export const isBridge = (n) => n >= 11 && n % 5 === 3;

/** One bridge stage, W columns wide; null if this try came out wrong. */
export function bridgeStage(n, rand, W) {
  const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const level = Math.min(1, (n - 11) / 60);
  const wide = W > 12;
  const rows = Array.from({ length: H }, () => Array(W).fill('.'));
  const fill = (x0, x1, y0) => { for (let x = x0; x <= x1; x++) for (let y = y0; y < H; y++) rows[y][x] = '#'; };

  // Cliffs: Poko's on one side, the gold's on the other; the valley in between.
  const top = ri(8, 10); // the row Poko's cliff top is on (high up: the board is 18 rows)
  const startW = wide ? ri(6, 8) : ri(4, 5);
  const gap = wide ? (level < 0.25 ? ri(8, 9) : ri(9, 12)) + Math.round(level * 2) : (level < 0.25 ? 3 : ri(3, 4)) + (level > 0.5 ? 1 : 0); // gentle at first
  const endW = W - startW - gap;
  if (endW < 2) return null;
  const goalTop = top - ri(0, 1); // the gold's cliff: as high, or a step higher
  const floor = top + (wide ? ri(4, 5) : ri(3, 4)) + (level > 0.5 ? 1 : 0); // the valley floor
  if (floor > H - 2) return null;
  fill(0, startW - 1, top);
  fill(startW + gap, W - 1, goalTop);
  fill(startW, startW + gap - 1, floor);
  // Rock stumps in the valley to build from (wide valleys, and sometimes narrow ones).
  const stumps = wide ? ri(1, 2) : rand() < 0.7 ? 1 : 0;
  const used = new Set();
  for (let k = 0; k < stumps; k++) {
    const x = startW + 1 + ri(1, gap - 3);
    if (used.has(x) || used.has(x - 1) || used.has(x + 1)) continue;
    used.add(x);
    fill(x, x, top + ri(2, 3));
  }
  // A crumbly (breakable) block on the edge sometimes, later on: bomb it or build round it.
  if (level > 0.3 && rand() < 0.3) rows[goalTop - 1][startW + gap] = 'B';

  // Poko at the valley's edge but facing away: he walks to the wall and back, which gives the
  // player time to start the bridge. The gold at the far end of its cliff.
  const flip = rand() < 0.5;
  rows[top - 1][startW - 1] = 'L';
  rows[goalTop - 1][W - 1] = 'E';
  // Stars: on his cliff, in the air over the valley (picked up on the bridge), on the far side.
  rows[top - 1][ri(1, startW - 2)] = '*';
  rows[top - 1 - (rand() < 0.4 ? 1 : 0)][startW + Math.floor(gap / 2)] = '*';
  const farX = ri(startW + gap + (rows[goalTop - 1][startW + gap] === 'B' ? 1 : 0), W - 2);
  if (rows[goalTop - 1][farX] !== '.') return null;
  rows[goalTop - 1][farX] = '*';

  let out = rows.map((r) => r.join(''));
  if (flip) out = out.map((r) => [...r].reverse().join('').replace('L', 'R'));
  return { bombs: true, rows: out };
}

/** A bridge stage as hard as stage n, from a seed, on a board W wide. */
export function generateBridge(n, seed, W) {
  const rand = mulberry32(seed);
  let fallback = null;
  for (let attempt = 0; attempt < 300; attempt++) {
    const def = bridgeStage(n, rand, W);
    if (!def || walksHome(def)) continue;
    const cps = checkpoints(def);
    if (!cps) continue;
    const tm = timing(def, n);
    const out = { ...def, water: tm.every, weights: pieceWeights(n) };
    // Not too much building: about what a ground stage of this width asks.
    const cap = Math.round((8 + Math.min(1, (n - 6) / 40) * 12) * (W / 9.6));
    if (!fallback || cps.at(-1).cells < fallback.cells) fallback = { out, cells: cps.at(-1).cells };
    if (cps.at(-1).cells <= cap && tm.slack >= tm.target - 0.01) return out;
  }
  return fallback?.out ?? null;
}

/** Stage n's bridge, on the phone board (12) or the PC one (24). */
export const bridge = (n, W) => generateBridge(n, n * 6271 + (W > 12 ? 41 : 29), W);
