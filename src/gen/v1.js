// Stage maker, version 1. FROZEN: do not change how it makes stages.
//
// Every stage it makes has been released, and players' stars (and later rankings and weekly
// challenges) belong to those exact maps. Changing a line here - even a tuning number - would
// quietly swap released stages for different ones. tests/stage-fingerprints.json records every
// stage and the tests fail if one changes.
//
// To make stages differently, copy this file to v2.js, change the copy, and give v2 only stage
// numbers nobody has reached yet (see ERAS in stages.js).
//
// It depends only on parseStage and the cell codes from game.js (the map format), and on its own
// copy of Poko's walk, so changes to the game's rules or drawing can't change the stages.
import { W, H, parseStage, at, EMPTY } from '../game.js';

const EMPTY_ROW = '..........';

export function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ----- Block shapes -----

// Friendly pieces early on, awkward ones (S, Z, T, L, J, long I) more and more later.
const EASY = { dot: 12, bar2: 13, bar3: 9, corner: 11, O: 9, I: 4, L: 5, J: 5, T: 4, S: 2, Z: 2, bomb: 4 };
const HARD = { dot: 3, bar2: 6, bar3: 7, corner: 6, O: 6, I: 9, L: 9, J: 9, T: 9, S: 9, Z: 9, bomb: 3 };
/** 0 (friendly) to 1 (awkward): flat for the first ten stages, then rising until stage 250. */
export const shapeHardness = (n) => Math.min(1, Math.max(0, (n - 10) / 240));
export function pieceWeights(n) {
  const u = shapeHardness(n);
  return Object.fromEntries(Object.keys(EASY).map((k) => [k, Math.round((EASY[k] + (HARD[k] - EASY[k]) * u) * 10) / 10]));
}

// ----- How high to climb -----

/** The usual climb (rows from Poko's start up to the door) for stage n. */
export function climbMedian(n) {
  if (n < 21) return 2;
  if (n < 100) return 4 + (n - 21) / 79; // 4 → 5
  if (n < 200) return 8;
  return 10;
}
/** This stage's climb: around the usual one, now and then a big tower; never over 20. */
export function pickClimb(n, rand) {
  const m = climbMedian(n);
  const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
  // (one lower from stage 100, so the occasional big tower does not pull the middle up)
  let c = Math.round(m) + ri(-2, 2) - (n >= 100 ? 1 : 0);
  const tall = n >= 200 ? [0.2, 14, 20] : n >= 100 ? [0.15, 11, 16] : [0.1, 7, 10];
  if (rand() < tall[0]) c = ri(tall[1], tall[2]);
  return Math.max(1, Math.min(20, c));
}
export const climbOf = (def) => { const s = parseStage(def); return s.walker.y - s.exit.y; };

// ----- Checking a stage -----

/**
 * Poko's walk on a fixed map from `from` (default: his start). Returns where he first gets to
 * that `goal(x, y)` accepts ({x, y, dir}), or null if he never does.
 */
function walkTo(rows, goal, from) {
  const { h, grid, walker, exit } = parseStage({ rows });
  const g = { grid };
  const solid = (x, y) => x < 0 || x >= W || y < 0 || y >= h || at(g, x, y) !== EMPTY;
  let { x, y, dir } = from || walker;
  goal ||= (px, py) => px === exit.x && py === exit.y;
  for (let i = 0; i < 600; i++) {
    if (!solid(x, y + 1)) y++;
    else if (!solid(x + dir, y)) x += dir;
    else if (!solid(x + dir, y - 1) && !solid(x, y - 1)) { x += dir; y--; }
    else dir = -dir;
    if (goal(x, y)) return { x, y, dir };
  }
  return null;
}
const reaches = (rows) => !!walkTo(rows);

/** Would Poko reach the door on his own, with no blocks dropped? Then the stage is no puzzle. */
export const walksHome = (def) => reaches(def.rows);

/**
 * The cheapest path for Poko from his start to the door, going one way across: how many cells
 * the player must fill (a breakable block in the way counts as 2, for the bomb), and the lowest
 * floor row he stands on along it (where the magma reaches him first). Null if no such path.
 * From his start, or from `from` ({x, y, dir}) if given.
 */
export function planPath(def, from) {
  const s = parseStage(def);
  if (from) s.walker = from;
  const cell = (x, y) => (y >= s.h ? 1 : at(s, x, y));
  const free = (x, y) => y >= 0 && cell(x, y) === EMPTY;
  const dir = s.exit.x > s.walker.x ? 1 : -1;
  const cols = [];
  for (let x = s.walker.x; x !== s.exit.x + dir; x += dir) cols.push(x);
  const cost = (x, f) => {
    if (f < 1 || f > s.h) return Infinity;
    let c = 0;
    if (!free(x, f - 1)) {
      if (cell(x, f - 1) !== 2) return Infinity; // rock in his way
      c += 2; // breakable: a bomb clears it
    }
    for (let y = f; !(y >= s.h || cell(x, y) !== EMPTY); y++) c++;
    return c;
  };
  // Facing away from the door: a block to turn him round first.
  let best = new Map([[s.walker.y + 1, { cells: s.walker.dir === dir ? 0 : 1, low: s.walker.y + 1 }]]);
  for (let i = 1; i < cols.length; i++) {
    const next = new Map();
    for (const [f, v] of best) {
      for (let f2 = f - 1; f2 <= s.h; f2++) { // up one at most, down any way
        const k = cost(cols[i], f2);
        if (k === Infinity) continue;
        if (f2 === f - 1 && !free(cols[i - 1], f - 2)) continue; // no headroom to climb
        const cells = v.cells + k, low = Math.max(v.low, f2);
        const o = next.get(f2);
        if (!o || cells < o.cells || (cells === o.cells && low < o.low)) next.set(f2, { cells, low });
      }
    }
    best = next;
  }
  const end = best.get(s.exit.y + 1);
  return end ? { ...end, steps: cols.length - 1 } : null;
}

/**
 * The work a stage takes, as checkpoints: after filling `cells` cells in all, Poko can leave
 * the floor at row `low` (until then he is down there and the magma can catch him).
 */
export function checkpoints(def) {
  if (def.climbPlan) return def.climbPlan;
  const p = planPath(def);
  return p ? [{ cells: p.cells, low: p.low, steps: p.steps }] : null;
}

/**
 * Seconds per row for the magma. A player needs about 3.5 s per piece (~2.2 useful cells; up
 * to 4.5 s once the awkward shapes come) plus Poko's walk, and gets `target` times that before
 * the magma reaches him at each checkpoint. The target shrinks with the stage number (3.2× on
 * stage 1 down to 1.5× from about stage 50).
 */
export function timing(def, n) {
  const h = def.rows.length;
  const cps = checkpoints(def) || [{ cells: 12, low: h - 2, steps: 10 }];
  const target = Math.max(1.5, 3.2 - (n - 1) * 0.035);
  const perPiece = 3.5 + shapeHardness(n);
  const sums = cps.map((c) => ({ need: (c.cells / 2.2) * perPiece + c.steps * 0.55, rise: Math.max(0.9, h - 0.6 - (c.low - 0.5)) }));
  const fastest = Math.max(5, 12 - n * 0.15); // never too quick early on
  let every = Math.max(...sums.map((s) => (s.need * target - 2.5) / s.rise));
  every = Math.min(24, Math.max(fastest, every)); // never so slow you can't see it move
  const slack = Math.min(...sums.map((s) => (2.5 + s.rise * every) / s.need));
  return { every, target, slack };
}
export const magmaSpeed = (def, n) => timing(def, n).every;

/**
 * Seconds from the start until Poko, left alone, is stuck for good (fallen somewhere with no
 * way on to the door), or Infinity if he never is. Early on that is how long the player has to
 * get the first piece in the right place - with whatever piece comes.
 */
export function stuckAfter(def) {
  const s = parseStage(def);
  const solid = (x, y) => x < 0 || x >= W || y < 0 || y >= s.h || at(s, x, y) !== EMPTY;
  let { x, y, dir } = s.walker;
  let t = 2.5; // the start delay
  for (let i = 0; i < 200; i++) {
    if (!solid(x, y + 1)) { y++; t += 0.12; continue; }
    if (!planPath(def, { x, y, dir })) return t;
    if (!solid(x + dir, y)) x += dir;
    else if (!solid(x + dir, y - 1) && !solid(x, y - 1)) { x += dir; y--; }
    else dir = -dir;
    t += 0.55;
  }
  return Infinity;
}
/** Seconds the player gets before Poko can first get stuck (bot tests: under about 5 s is luck). */
export const FIRST_TRAP = 6;

// ----- Making stages -----

/** A stage across the screen: wandering ground with holes, the door some rows up. */
export function groundStage(n, rand, want) {
  const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const level = Math.min(1, (n - 6) / 40);
  const rows = Array.from({ length: H }, () => [...EMPTY_ROW]);
  const ground = [];
  let h = ri(10, 12);
  for (let x = 0; x < W; x++) {
    if (x > 0 && rand() < 0.22 + level * 0.12 && x < W - 1) ground.push(Math.min(14, h + ri(2, 3))); // a hole
    else {
      if (x > 0 && rand() < 0.5) h = Math.max(7, Math.min(12, h + ri(-1 - Math.round(level * 2), 1 + Math.round(level))));
      ground.push(h);
    }
  }
  for (let x = 0; x < W; x++) for (let y = ground[x]; y < H; y++) rows[y][x] = '#';
  const flip = rand() < 0.5;
  const sx = flip ? W - 1 : 0, ex = flip ? 0 : W - 1;
  // Raise the door's side on rock until the climb is what we want.
  const lift = want === undefined ? ri(0, 2 + Math.round(level * 4)) : Math.max(0, want - (ground[sx] - ground[ex]));
  for (let k = 1; k <= lift; k++) {
    const y = ground[ex] - k;
    if (y < 5) break;
    rows[y][ex] = '#';
    if (rand() < 0.5) rows[y][ex + (flip ? 1 : -1)] = '#';
  }
  let doorY = ground[ex] - 1;
  while (rows[doorY][ex] === '#') doorY--;
  rows[doorY][ex] = 'E';
  rows[ground[sx] - 1][sx] = flip ? 'L' : 'R';
  if (rand() < 0.35 + level * 0.2) { // a breakable wall
    const bx = ri(3, 6), bh = ri(2, 3);
    for (let k = 1; k <= bh; k++) if (rows[ground[bx] - k][bx] === '.') rows[ground[bx] - k][bx] = 'B';
  }
  if (rand() < 0.3) { // a floating rock ledge
    const y = ri(6, 9), x0 = ri(2, 5);
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

/**
 * A tower: rock ledges jutting from the left and right walls in turn, each 3 or 4 rows above
 * the last. Each ledge ends in a 2-row post at its inner end, so Poko paces safely between the
 * wall and the post while the player builds. To send him up: build steps across the gap to the
 * next ledge's post, then drop one "key" block in front of his post; he climbs the lot and
 * hops down onto the next ledge (whose post then keeps him from wandering back). Taller than
 * the screen when the climb is big (the view follows Poko up).
 *
 * Also works out that solution level by level, to check that Poko waits safely and really
 * gets up, and to time the magma.
 */
export function towerStage(n, rand, climb) {
  const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
  // Rise of each ledge over the last: 3s and 4s adding up to the climb.
  const ok = (r) => r === 0 || r === 3 || r === 4 || r >= 6;
  const gaps = [];
  for (let left = climb; left > 0;) {
    // The first rise is kept low (2 if it can be: the steps up from the floor are the longest
    // to build, and the first ledge is solid so a low one has no overhang problems).
    const order = !gaps.length ? [2, 3, 4] : rand() < 0.5 + shapeHardness(n) * 0.3 ? [4, 3] : [3, 4];
    const g = order.find((k) => k <= left && ok(left - k));
    if (!g) return null;
    gaps.push(g);
    left -= g;
  }
  const h = Math.max(H, climb + 9);
  const rows = Array.from({ length: h }, () => [...EMPTY_ROW]);
  for (const y of [h - 2, h - 1]) rows[y].fill('#');
  // Ledges, alternating sides. `post` is the inner end's column.
  let side = rand() < 0.5 ? -1 : 1; // -1: on the left wall
  let post = side < 0 ? ri(2, 4) : ri(5, 7);
  let floor = h - 2;
  const ledges = [];
  for (let i = 0; i < gaps.length; i++) {
    floor -= gaps[i];
    if (side < 0 ? post < 2 : post > W - 3) return null; // room for Poko to pace
    const span = side < 0 ? [0, post] : [post, W - 1];
    // The first ledge is solid down to the floor, so Poko can't wander in under it.
    for (let x = span[0]; x <= span[1]; x++) for (let y = floor; y <= (i === 0 ? h - 3 : floor); y++) rows[y][x] = '#';
    rows[floor - 1][post] = rows[floor - 2][post] = '#';
    ledges.push({ floor, side, span, post, gap: gaps[i] });
    // The next ledge, on the other wall: its post sits gap - 1 columns across from this one.
    const g2 = gaps[i + 1] ?? 3;
    post = side < 0 ? post + g2 : post - g2;
    side = -side;
  }
  // Poko starts on the bottom, on the side away from the first steps; the door at the top.
  const first = ledges[0], last = ledges.at(-1);
  const sx = first.side < 0 ? W - 1 : 0;
  rows[h - 3][sx] = sx === 0 ? 'R' : 'L';
  const ex = last.side < 0 ? 0 : W - 1;
  rows[last.floor - 1][ex] = 'E';
  // Stars: on the floor and on two ledges along the way (not on a post).
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
  const fill = (x, topRow) => { // drop blocks in column x until it reaches topRow
    let c = 0;
    for (let y = topRow; y < h && sol[y][x] !== '#' && sol[y][x] !== 'B'; y++) {
      if (sol[y][x] === '.' || sol[y][x] === '*') { sol[y][x] = 'B'; c++; }
    }
    return c;
  };
  const plan = [];
  let cells = 0, pos = null, prev = null;
  for (const L of ledges) {
    // Steps rising toward this ledge's post: one column out from it per row.
    const out = L.side < 0 ? 1 : -1;
    const count = prev ? L.gap - 1 : L.gap + 1;
    const build = [];
    for (let j = 1; j <= count; j++) { build.push([L.post + out * j, L.floor - 2 + j]); cells += fill(L.post + out * j, L.floor - 2 + j); }
    let key = null;
    if (prev) {
      // Before the key block goes in, Poko must be pacing safely up on his ledge.
      const fell = walkTo(text(), (x, y) => y > prev.floor - 1, pos);
      if (fell) return null;
      key = [prev.post + (prev.side < 0 ? -1 : 1), prev.floor - 1]; // the key block
      cells += fill(...key);
    }
    plan.push({ cells, low: prev ? prev.floor : h - 2, steps: 10, build, key });
    pos = walkTo(text(), (x, y) => y === L.floor - 1 && x !== L.post && x >= L.span[0] && x <= L.span[1], pos);
    if (!pos) return null;
    prev = L;
  }
  if (!walkTo(text(), null, pos)) return null;
  return { ...def, climbPlan: plan };
}

/** Stage n (6 and up), made from its number. */
export const generate = (n) => generateWith(n, n * 7919 + 17);

/** A stage as hard as stage n, from any seed (the weekly challenge picks its own). */
export function generateWith(n, seed) {
  const rand = mulberry32(seed);
  const level = Math.min(1, (n - 6) / 40);
  const want = n >= 21 ? pickClimb(n, rand) : undefined;
  let fallback = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const def = want !== undefined && want >= 7 ? towerStage(n, rand, want) : groundStage(n, rand, want);
    if (!def || walksHome(def)) continue;
    if (want !== undefined && climbOf(def) !== want) continue;
    // Time to react: left alone, Poko must not be stuck for good before FIRST_TRAP seconds.
    if (!def.climbPlan && stuckAfter(def) < FIRST_TRAP) continue; // (towers: he paces safely on the floor)
    const cps = checkpoints(def);
    if (!cps) continue;
    const cap = def.climbPlan ? Infinity : 6 + Math.round(level * 14);
    const tm = timing(def, n);
    const out = { ...def, water: tm.every, weights: pieceWeights(n) };
    if (!fallback || tm.slack > fallback.slack) fallback = { out, slack: tm.slack }; // the fairest so far
    if (cps.at(-1).cells <= cap && tm.slack >= tm.target - 0.01) return out;
  }
  if (fallback) return fallback.out;
  // Nothing at all fitted: a small tower (always works out within a few seeds).
  for (let k = 1; ; k++) {
    const def = towerStage(n, mulberry32(seed + k * 7907), 7);
    if (def) return { ...def, water: timing(def, n).every, weights: pieceWeights(n) };
  }
}
