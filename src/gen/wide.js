// Stage maker for the PC version's wide board: 24 × 18 cells (the phone board is 12 × 18).
// FROZEN once released, like v1.js and v3.js.
//
// A copy of v3.js with the board's width as W and the few fixed positions scaled to it. It
// reuses v1's checks (Poko's walk, the cheapest path, the magma timing), which read each
// map's own width, so the magma is as fair here as on the phone.
import { parseStage } from '../game.js';
import { mulberry32, pickClimb, walksHome, climbOf, stuckAfter, FIRST_TRAP, checkpoints, timing, pieceWeights, shapeHardness, walkTo } from './v1.js';

export const W = 24, H = 18;
const EMPTY_ROW = '.'.repeat(W);
/** The least climb, in rows from Poko's start up to the door, for stage n. */
export const minClimb = (n) => (n < 21 ? 2 : 3);

/** A stage across the screen: wandering ground with holes, the door some rows up. */
export function groundStage(n, rand, want) {
  const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const level = Math.min(1, (n - 6) / 40);
  const rows = Array.from({ length: H }, () => [...EMPTY_ROW]);
  const ground = [];
  let h = ri(13, 15);
  for (let x = 0; x < W; x++) {
    if (x > 0 && rand() < 0.2 + level * 0.1 && x < W - 1) ground.push(Math.min(17, h + ri(2, 3))); // a hole
    else {
      if (x > 0 && rand() < 0.5) h = Math.max(10, Math.min(15, h + ri(-1 - Math.round(level * 2), 1 + Math.round(level))));
      ground.push(h);
    }
  }
  for (let x = 0; x < W; x++) for (let y = ground[x]; y < H; y++) rows[y][x] = '#';
  const flip = rand() < 0.5;
  const sx = flip ? W - 1 : 0, ex = flip ? 0 : W - 1;
  // Raise the door's side on rock until the climb is what we want.
  const lift = Math.max(0, want - (ground[sx] - ground[ex]));
  for (let k = 1; k <= lift; k++) {
    const y = ground[ex] - k;
    if (y < 6) break;
    rows[y][ex] = '#';
    if (rand() < 0.5) rows[y][ex + (flip ? 1 : -1)] = '#';
  }
  let doorY = ground[ex] - 1;
  while (rows[doorY][ex] === '#') doorY--;
  rows[doorY][ex] = 'E';
  rows[ground[sx] - 1][sx] = flip ? 'L' : 'R';
  if (rand() < 0.35 + level * 0.2) { // a breakable wall
    const bx = ri(3, W - 4), bh = ri(2, 3);
    for (let k = 1; k <= bh; k++) if (rows[ground[bx] - k][bx] === '.') rows[ground[bx] - k][bx] = 'B';
  }
  if (rand() < 0.35) { // a floating rock ledge
    const y = ri(8, 12), x0 = ri(2, W - 5);
    for (let x = x0; x < x0 + ri(2, 3); x++) if (rows[y][x] === '.' && ground[x] > y + 2) rows[y][x] = '#';
  }
  let placed = 0;
  for (let tries = 0; placed < 3 && tries < 60; tries++) {
    const x = ri(1, W - 2);
    let y = ground[x] - 1 - (rand() < 0.4 ? ri(1, 3) : 0);
    while (y > 3 && rows[y][x] !== '.') y--;
    if (y > 3 && rows[y][x] === '.') { rows[y][x] = '*'; placed++; }
  }
  return { bombs: true, rows: rows.map((r) => r.join('')) };
}

/** A tower (see v1.js): ledges from the left and right walls in turn, a post at each inner end. */
export function towerStage(n, rand, climb) {
  const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const ok = (r) => r === 0 || r === 3 || r === 4 || r >= 6;
  const gaps = [];
  for (let left = climb; left > 0;) {
    const order = !gaps.length ? [2, 3, 4] : rand() < 0.5 + shapeHardness(n) * 0.3 ? [4, 3] : [3, 4];
    const g = order.find((k) => k <= left && ok(left - k));
    if (!g) return null;
    gaps.push(g);
    left -= g;
  }
  const h = Math.max(H, climb + 9);
  const rows = Array.from({ length: h }, () => [...EMPTY_ROW]);
  for (const y of [h - 2, h - 1]) rows[y].fill('#');
  let side = rand() < 0.5 ? -1 : 1;
  let post = side < 0 ? ri(2, W / 2 - 1) : ri(W / 2, W - 3);
  let floor = h - 2;
  const ledges = [];
  for (let i = 0; i < gaps.length; i++) {
    floor -= gaps[i];
    if (side < 0 ? post < 2 : post > W - 3) return null;
    const span = side < 0 ? [0, post] : [post, W - 1];
    for (let x = span[0]; x <= span[1]; x++) for (let y = floor; y <= (i === 0 ? h - 3 : floor); y++) rows[y][x] = '#';
    rows[floor - 1][post] = rows[floor - 2][post] = '#';
    ledges.push({ floor, side, span, post, gap: gaps[i] });
    const g2 = gaps[i + 1] ?? 3;
    post = side < 0 ? post + g2 : post - g2;
    side = -side;
  }
  const first = ledges[0], last = ledges.at(-1);
  const sx = first.side < 0 ? W - 1 : 0;
  rows[h - 3][sx] = sx === 0 ? 'R' : 'L';
  const ex = last.side < 0 ? 0 : W - 1;
  rows[last.floor - 1][ex] = 'E';
  const walkway = (L) => (L.side < 0 ? [0, L.post - 1] : [L.post + 1, W - 1]);
  const starAt = (floorRow, [a, b]) => { for (let k = 0; k < 8; k++) { const x = ri(a, b); if (rows[floorRow - 1][x] === '.') { rows[floorRow - 1][x] = '*'; return true; } } return false; };
  starAt(h - 2, [2, W - 3]);
  starAt(ledges[Math.floor(ledges.length / 2)].floor, walkway(ledges[Math.floor(ledges.length / 2)]));
  if (!starAt(last.floor, walkway(last)) && !starAt(first.floor, walkway(first))) starAt(h - 2, [1, W - 2]);
  const def = { bombs: true, rows: rows.map((r) => r.join('')) };
  if (parseStage(def).stars.length !== 3) return null;

  // The solution, level by level.
  const sol = rows.map((r) => [...r]);
  const text = () => sol.map((r) => r.join(''));
  const fill = (x, topRow) => {
    let c = 0;
    for (let y = topRow; y < h && sol[y][x] !== '#' && sol[y][x] !== 'B'; y++) {
      if (sol[y][x] === '.' || sol[y][x] === '*') { sol[y][x] = 'B'; c++; }
    }
    return c;
  };
  const plan = [];
  let cells = 0, pos = null, prev = null;
  for (const L of ledges) {
    const out = L.side < 0 ? 1 : -1;
    const count = prev ? L.gap - 1 : L.gap + 1;
    const build = [];
    for (let j = 1; j <= count; j++) { build.push([L.post + out * j, L.floor - 2 + j]); cells += fill(L.post + out * j, L.floor - 2 + j); }
    let key = null;
    if (prev) {
      const fell = walkTo(text(), (x, y) => y > prev.floor - 1, pos);
      if (fell) return null;
      key = [prev.post + (prev.side < 0 ? -1 : 1), prev.floor - 1];
      cells += fill(...key);
    }
    plan.push({ cells, low: prev ? prev.floor : h - 2, steps: 12, build, key });
    pos = walkTo(text(), (x, y) => y === L.floor - 1 && x !== L.post && x >= L.span[0] && x <= L.span[1], pos);
    if (!pos) return null;
    prev = L;
  }
  if (!walkTo(text(), null, pos)) return null;
  return { ...def, climbPlan: plan };
}

/** Stage n (6 and up), made from its number. */
export const generate = (n) => generateWith(n, n * 7919 + 23);

/** A stage as hard as stage n, from any seed (the weekly challenge picks its own). */
export function generateWith(n, seed) {
  const rand = mulberry32(seed);
  const level = Math.min(1, (n - 6) / 40);
  const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const want = n >= 21 ? Math.max(minClimb(n), pickClimb(n, rand)) : ri(2, 3);
  let fallback = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const def = want >= 7 ? towerStage(n, rand, want) : groundStage(n, rand, want);
    if (!def || walksHome(def)) continue;
    if (climbOf(def) !== want) continue;
    if (!def.climbPlan && stuckAfter(def) < FIRST_TRAP) continue;
    const cps = checkpoints(def);
    if (!cps) continue;
    // A wider board takes more cells to cross than v1's 10 columns.
    const cap = def.climbPlan ? Infinity : Math.round((6 + level * 14) * (W / 9.6)) + want;
    const tm = timing(def, n);
    const out = { ...def, water: tm.every, weights: pieceWeights(n) };
    if (!fallback || tm.slack > fallback.slack) fallback = { out, slack: tm.slack };
    if (cps.at(-1).cells <= cap && tm.slack >= tm.target - 0.01) return out;
  }
  if (fallback) return fallback.out;
  for (let k = 1; ; k++) {
    const def = towerStage(n, mulberry32(seed + k * 7907), 7);
    if (def) return { ...def, water: timing(def, n).every, weights: pieceWeights(n) };
  }
}

/**
 * One of the hand-drawn teaching stages (12 wide) made W wide: more of the ground Poko starts
 * on, added on his side, so the lesson (the hole, the wall...) is the same, just further away.
 */
export function widenHand(def) {
  const rows = def.rows;
  const w = rows[0].length, extra = W - w;
  if (extra <= 0) return def;
  const startRow = rows.find((r) => r.includes('R') || r.includes('L'));
  const right = startRow.includes('R');
  const sx = startRow.indexOf(right ? 'R' : 'L');
  // Copies of Poko's own column, put just ahead of him: a longer walk to the same lesson.
  const at = right ? sx + 1 : sx;
  const out = rows.map((r) => {
    const c = r[sx];
    const fill = c === 'R' || c === 'L' || c === '*' || c === 'E' ? '.' : c;
    return r.slice(0, at) + fill.repeat(extra) + r.slice(at);
  });
  return { ...def, rows: out };
}
