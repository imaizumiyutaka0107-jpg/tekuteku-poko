// Poko's Path: the rules. Poko walks on his own; the player drops blocks to build him a way to
// the door before the water rises over him.
//
// Poko's walk, one step at a time: fall if nothing is under him; otherwise walk forward; climb
// a one-block step if there's room overhead; turn around at anything taller.
//
// No DOM here, so the rules can be tested on their own.

// W × H is what the screen shows. A stage may be taller than H rows (a tower to climb); the
// view then follows Poko up (see viewTop).
export const W = 12, H = 18; // the view, in cells (a stage may be taller: a tower; older stages were 10 × 15)
export const EMPTY = 0, ROCK = 1, BLOCK = 2;
export const START_DELAY = 2.5; // seconds before Poko sets off
const WALK = 0.55; // seconds per step
const FALL = 0.12; // seconds per row while falling
// Seconds per row for the falling piece. Slowed from 0.85 after phone play-testing (more time
// to steer with a thumb); the magma is slowed by the same ratio so stages stay as fair.
const GRAVITY = 1.2;
const MAGMA_SLOW = GRAVITY / 0.85; // the stages' magma speeds were worked out for 0.85
const SOFT = 0.05; // ... while the player holds it down
export const TRIP = 0.9; // seconds Poko lies flat after a near miss
const NEAR_MISS = 1.0; // a piece that was nearly on his head counts as a near miss this long

export const SHAPES = {
  dot: [[0, 0]], bar2: [[0, 0], [1, 0]], bar3: [[0, 0], [1, 0], [2, 0]], corner: [[0, 0], [0, 1], [1, 1]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]], I: [[0, 0], [1, 0], [2, 0], [3, 0]], L: [[0, 0], [0, 1], [0, 2], [1, 2]],
  J: [[1, 0], [1, 1], [1, 2], [0, 2]], T: [[0, 0], [1, 0], [2, 0], [1, 1]], S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]], bomb: [[0, 0]],
};
// Small, friendly pieces come most often.
const WEIGHTS = { dot: 9, bar2: 12, bar3: 10, corner: 10, O: 9, I: 6, L: 6, J: 6, T: 6, S: 4, Z: 4, bomb: 4 };
// Colour index of each piece once it lands (0 is the grey of a stage's own breakable blocks).
export const PIECE_COLOR = { dot: 1, bar2: 2, bar3: 3, corner: 4, O: 5, I: 6, L: 7, J: 8, T: 9, S: 10, Z: 11, bomb: 0 };

/**
 * A stage from its map. Rows top to bottom: `.` empty, `#` rock, `B` breakable block,
 * `R`/`L` Poko facing right/left, `E` the door, `*` a star.
 */
export function parseStage(def) {
  const h = def.rows.length;
  const w = def.rows[0].length;
  const grid = new Uint8Array(w * h);
  const colors = new Uint8Array(w * h);
  let walker = null, exit = null;
  const stars = [];
  def.rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`row ${y} is ${row.length} wide, not ${w}`);
    [...row].forEach((ch, x) => {
      if (ch === '#') grid[y * w + x] = ROCK;
      else if (ch === 'B') grid[y * w + x] = BLOCK;
      else if (ch === 'R' || ch === 'L') walker = { x, y, dir: ch === 'R' ? 1 : -1 };
      else if (ch === 'E') exit = { x, y };
      else if (ch === '*') stars.push({ x, y, got: false });
    });
  });
  if (h < 15 || !walker || !exit) throw new Error('a stage needs at least 15 rows, Poko and a door');
  return { h, w, grid, colors, walker, exit, stars };
}

export function makeGame(def, rand = Math.random) {
  const st = parseStage(def);
  const g = {
    ...st,
    walker: { ...st.walker, fromX: st.walker.x, fromY: st.walker.y, act: 'idle' },
    vh: Math.min(st.h, Math.round(st.w * 1.5)), // rows on screen: 18 on the 12-wide board
    waterEvery: (def.water ?? 14) * MAGMA_SLOW, // seconds for the magma to rise one row
    bombs: def.bombs ?? false,
    weights: def.weights ?? WEIGHTS, // how often each piece comes (harder shapes later on)
    gentle: def.gentle ?? false, // early stages: a piece falling by itself never squashes Poko
    queue: [...(def.first || [])],
    rand,
    time: 0, walkT: 0, gravT: 0, soft: false,
    tripT: 0, // > 0 while Poko is down after a near miss
    nearT: 0, // > 0 for a moment after a piece was nearly on his head
    water: 0.6, // rows of magma, fractional: starts just showing so you can see it rise
    piece: null, next: null,
    status: 'play', reason: null, events: [],
  };
  g.next = pickKind(g);
  spawn(g);
  return g;
}

function pickKind(g) {
  if (g.queue.length) return g.queue.shift();
  const kinds = Object.keys(g.weights).filter((k) => g.weights[k] > 0 && (k !== 'bomb' || g.bombs));
  let r = g.rand() * kinds.reduce((a, k) => a + g.weights[k], 0);
  for (const k of kinds) { r -= g.weights[k]; if (r < 0) return k; }
  return 'dot';
}

export const at = (g, x, y) => g.grid[y * g.w + x];
export const pieceCells = (p) => p.cells.map(([cx, cy]) => [p.x + cx, p.y + cy]);

// For pieces: Poko is solid to a piece moved or turned sideways into him, but one that comes
// down on top of him squashes him (see fall).
function blockedForPiece(g, x, y, walkerSolid = true) {
  if (x < 0 || x >= g.w || y >= g.h) return true;
  if (y < 0) return false;
  if (at(g, x, y) !== EMPTY) return true;
  if (!walkerSolid) return false;
  const p = pokoCell(g);
  return p.x === x && p.y === y;
}

/**
 * The cell Poko counts as being in, for the falling pieces: the one he is drawn in. A step
 * takes him a moment, so until he is halfway across he still counts as where he came from
 * (otherwise a block landing in front of him would squash him while it plainly misses).
 */
export function pokoCell(g) {
  const w = g.walker;
  if (g.time < START_DELAY || (w.act !== 'walk' && w.act !== 'climb')) return { x: w.x, y: w.y };
  return g.walkT < walkerInterval(g) / 2 ? { x: w.fromX, y: w.fromY } : { x: w.x, y: w.y };
}
function fits(g, p, walkerSolid = true) { return pieceCells(p).every(([x, y]) => !blockedForPiece(g, x, y, walkerSolid)); }

/** Would the piece, dropped from here, come down on Poko? (A bomb just goes off on his hat.) */
export function landsOnWalker(g) {
  if (!g.piece || g.piece.kind === 'bomb') return false;
  const below = { ...g.piece, y: g.piece.y + dropDistance(g) + 1 };
  return fits(g, below, false);
}

/**
 * How close the piece is to squashing Poko: the rows of air between them (0 = right on his
 * hat), or -1 if it isn't coming down on him at all.
 */
export function crushGap(g) {
  if (g.status !== 'play' || !landsOnWalker(g)) return -1;
  const at = pokoCell(g);
  const above = pieceCells(g.piece).filter(([x]) => x === at.x).map(([, y]) => y);
  return above.length ? Math.max(0, at.y - Math.max(...above) - 1) : -1;
}

/**
 * Move the piece down one row: it falls, lands, or squashes Poko. On the first, gentle stages
 * only the player can squash him: a piece drifting down by itself stops and hovers over his
 * head (its outline shows red) until he moves on or the player moves it.
 */
function fall(g, byPlayer = true) {
  const p = { ...g.piece, y: g.piece.y + 1 };
  if (fits(g, p)) { g.piece = p; return true; }
  if (g.piece.kind !== 'bomb' && fits(g, p, false)) {
    // The only thing in the way is Poko.
    if (g.gentle && !byPlayer) return false;
    for (const [x, y] of pieceCells(g.piece)) {
      if (y < 0) continue;
      g.grid[y * g.w + x] = BLOCK;
      g.colors[y * g.w + x] = PIECE_COLOR[g.piece.kind];
    }
    g.events.push({ type: 'lock', cells: pieceCells(g.piece) });
    g.crushCells = pieceCells(g.piece).filter(([, y]) => y >= 0); // (taken away again by revive)
    g.piece = null;
    end(g, 'lost', 'crushed');
    return false;
  }
  lock(g);
  return false;
}

// For Poko: the edges, the ground and the falling piece are all solid.
function blockedForWalker(g, x, y) {
  if (x < 0 || x >= g.w || y < 0 || y >= g.h) return true;
  if (at(g, x, y) !== EMPTY) return true;
  return !!g.piece && pieceCells(g.piece).some(([px, py]) => px === x && py === y);
}

function spawn(g) {
  const kind = g.next;
  g.next = pickKind(g);
  const cells = SHAPES[kind].map((c) => [...c]);
  const width = Math.max(...cells.map((c) => c[0])) + 1;
  // New pieces appear at the top of the view, in the middle (a little higher, or to the side,
  // if a ledge is in the way).
  const top = viewTop(g);
  const mid = Math.floor((g.w - width) / 2);
  g.gravT = 0;
  for (let y = top; y >= Math.max(0, top - 6); y--) {
    for (const dx of [0, -1, 1, -2, 2, -3, 3]) {
      g.piece = { kind, cells, x: mid + dx, y };
      if (fits(g, g.piece)) return;
    }
  }
  g.piece = null;
  end(g, 'lost', 'full');
}

export function move(g, dx) {
  if (g.status !== 'play' || !g.piece) return false;
  const p = { ...g.piece, x: g.piece.x + dx };
  if (!fits(g, p)) return false;
  g.piece = p;
  g.events.push('move');
  return true;
}

/** Turn the piece a quarter clockwise, nudging it sideways if it would hit something. */
export function rotate(g) {
  if (g.status !== 'play' || !g.piece || ['dot', 'O', 'bomb'].includes(g.piece.kind)) return false;
  const maxY = Math.max(...g.piece.cells.map((c) => c[1]));
  const cells = g.piece.cells.map(([x, y]) => [maxY - y, x]);
  for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]) {
    const p = { ...g.piece, cells, x: g.piece.x + dx, y: g.piece.y + dy };
    if (fits(g, p)) { g.piece = p; g.events.push('rotate'); return true; }
  }
  return false;
}

/** How far the piece would fall from here. */
export function dropDistance(g) {
  if (!g.piece) return 0;
  let d = 0;
  while (fits(g, { ...g.piece, y: g.piece.y + d + 1 })) d++;
  return d;
}

export function hardDrop(g) {
  if (g.status !== 'play' || !g.piece) return;
  g.piece = { ...g.piece, y: g.piece.y + dropDistance(g) };
  fall(g);
}

export function setSoft(g, on) { g.soft = on; }

function lock(g) {
  const p = g.piece;
  const cells = pieceCells(p);
  if (p.kind === 'bomb') {
    // Clears the blocks (never rock) in the 3×3 under and beside where it lands.
    const [bx, by] = cells[0];
    for (let y = by; y <= by + 2; y++) {
      for (let x = bx - 1; x <= bx + 1; x++) {
        if (x >= 0 && x < g.w && y < g.h && at(g, x, y) === BLOCK) g.grid[y * g.w + x] = EMPTY;
      }
    }
    g.events.push({ type: 'boom', x: bx, y: by + 1 });
  } else {
    for (const [x, y] of cells) {
      if (y < 0) continue;
      g.grid[y * g.w + x] = BLOCK;
      g.colors[y * g.w + x] = PIECE_COLOR[p.kind];
    }
    g.events.push({ type: 'lock', cells });
    // Landed in the cell he was just stepping into: he bumps into it and turns back.
    const w = g.walker;
    if (cells.some(([x, y]) => x === w.x && y === w.y)) {
      w.x = w.fromX; w.y = w.fromY;
      w.dir = -w.dir;
      w.act = 'turn';
      g.walkT = 0;
    }
    checkNearMiss(g, cells);
  }
  g.piece = null;
  spawn(g);
}

/**
 * A close shave: a piece that was just about on Poko's head lands right beside him instead
 * (he stepped out from under it in time, or the player pulled it away at the last moment).
 * The fright knocks him flat for a moment.
 */
function checkNearMiss(g, cells) {
  const w = g.walker;
  if (g.nearT <= 0 || w.act === 'fall' || g.tripT > 0) return;
  const beside = cells.some(([x, y]) => Math.abs(x - w.x) === 1 && (y === w.y || y === w.y - 1));
  if (!beside) return;
  g.tripT = TRIP;
  g.nearT = 0;
  w.fromX = w.x;
  w.fromY = w.y;
  w.act = 'trip';
  g.walkT = 0;
  g.events.push({ type: 'trip', x: w.x, y: w.y });
}

function walkerStep(g) {
  const w = g.walker;
  w.fromX = w.x;
  w.fromY = w.y;
  if (!blockedForWalker(g, w.x, w.y + 1)) {
    w.y++;
    w.act = 'fall';
  } else {
    const nx = w.x + w.dir;
    if (!blockedForWalker(g, nx, w.y)) {
      w.x = nx;
      w.act = 'walk';
    } else if (!blockedForWalker(g, nx, w.y - 1) && !blockedForWalker(g, w.x, w.y - 1)) {
      w.x = nx;
      w.y--;
      w.act = 'climb';
    } else {
      w.dir = -w.dir;
      w.act = 'turn';
    }
  }
  for (const s of g.stars) {
    if (!s.got && s.x === w.x && s.y === w.y) { s.got = true; g.events.push({ type: 'star', x: s.x, y: s.y }); }
  }
  if (w.x === g.exit.x && w.y === g.exit.y) end(g, 'won');
}

/** How long Poko's current move takes, for drawing him part-way through it. */
export const walkerInterval = (g) => (g.walker.act === 'fall' ? FALL : WALK);

/** The magma's surface, in rows from the top of the stage. */
export const waterTop = (g) => g.h - g.water;

/** The first stage row on screen: Poko is kept about two-thirds of the way down. */
// The view: g.w × g.vh cells (12 × 18; a stage from the old 10-column board gets 10 × 15).
export const viewTop = (g) => Math.max(0, Math.min(g.h - g.vh, g.walker.y - Math.round((g.vh * 2) / 3)));

function end(g, status, reason = null) {
  g.status = status;
  g.reason = reason;
  g.events.push(status);
}

export function update(g, dt) {
  if (g.status !== 'play') return;
  g.time += dt;
  if (g.time > START_DELAY) g.water += dt / g.waterEvery;

  g.gravT += dt;
  const gi = g.soft ? SOFT : GRAVITY;
  while (g.piece && g.gravT >= gi && g.status === 'play') {
    g.gravT -= gi;
    fall(g, g.soft);
  }
  if (g.status !== 'play') return;

  // Remember a piece nearly on Poko's head (2 rows of air or less) for a moment.
  g.nearT = Math.max(0, g.nearT - dt);
  if (g.piece && crushGap(g) >= 0 && crushGap(g) <= 2) g.nearT = NEAR_MISS;

  if (g.tripT > 0) {
    // Down after a near miss: he gets up again when it's over (his walk resumes then).
    g.tripT = Math.max(0, g.tripT - dt);
    if (g.tripT === 0) g.walker.act = 'idle';
  } else if (g.time >= START_DELAY) {
    g.walkT += dt;
    if (g.walkT >= walkerInterval(g)) {
      g.walkT = 0;
      walkerStep(g);
    }
  }
  // Poko is in trouble once the water is over his middle.
  if (g.status === 'play' && waterTop(g) < g.walker.y + 0.5) end(g, 'lost', 'water');
}

/** Can this lost game be carried on (once: after the magma or a block got Poko)? */
export const canRevive = (g) => g.status === 'lost' && !g.revived && (g.reason === 'water' || g.reason === 'crushed');

/**
 * Carry on after a loss (the reward for watching an ad): the block that squashed Poko is
 * lifted off him, or the magma sinks to a few rows below his feet. Only once per try.
 */
export function revive(g) {
  if (!canRevive(g)) return false;
  if (g.reason === 'crushed') for (const [x, y] of g.crushCells || []) g.grid[y * g.w + x] = EMPTY;
  else g.water = Math.max(0.6, g.h - (g.walker.y + 1) - 3);
  g.crushCells = null;
  g.status = 'play';
  g.reason = null;
  g.revived = true;
  g.nearT = 0;
  g.walker.fromX = g.walker.x; g.walker.fromY = g.walker.y; g.walker.act = 'idle';
  g.walkT = 0;
  spawn(g);
  return true;
}

export function takeEvents(g) { return g.events.splice(0); }
export const starsGot = (g) => g.stars.filter((s) => s.got).length;
