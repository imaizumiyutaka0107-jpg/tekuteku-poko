// Drawing the stage: rock, blocks, the falling piece and where it will land, Poko, the door,
// stars and the water. Everything is in board units: one cell is CELL wide.
import { W, H, ROCK, BLOCK, at, pieceCells, dropDistance, landsOnWalker, crushGap, walkerInterval, waterTop, viewTop, START_DELAY, SHAPES, PIECE_COLOR, TRIP } from './game.js';
import { realBackground, realTerrain, realCrate, realStone, realLava } from './real.js';

export const CELL = 40;
export const BLOCK_COLORS = ['#9aa3b5', '#ff6b8b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#748ffc', '#b197fc', '#f783ac', '#63e6be', '#ff8787'];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

/** The realistic look (textured rock, crates, lava); false brings back the flat cartoon look. */
export const REAL = true;

export function drawBlock(ctx, x, y, color, size = CELL, alpha = 1) {
  if (REAL && typeof document !== 'undefined') {
    // A crate stained in the piece's colour (grey: a stage's own breakable stone).
    ctx.globalAlpha = alpha;
    ctx.drawImage(color === BLOCK_COLORS[0] ? realStone() : realCrate(color), x, y, size, size);
    ctx.globalAlpha = 1;
    return;
  }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  roundRect(ctx, x + 1.5, y + 1.5, size - 3, size - 3, size * 0.22);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  roundRect(ctx, x + size * 0.18, y + size * 0.14, size * 0.4, size * 0.16, size * 0.08);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  roundRect(ctx, x + 3, y + size * 0.72, size - 6, size * 0.2, size * 0.1);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawBomb(ctx, x, y, t, size = CELL) {
  const cx = x + size / 2, cy = y + size * 0.56;
  ctx.fillStyle = '#2b2d42';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.arc(cx - size * 0.12, cy - size * 0.12, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c9a26b';
  ctx.lineWidth = size * 0.07;
  ctx.beginPath();
  ctx.moveTo(cx + size * 0.18, cy - size * 0.26);
  ctx.quadraticCurveTo(cx + size * 0.3, cy - size * 0.46, cx + size * 0.12, cy - size * 0.48);
  ctx.stroke();
  ctx.fillStyle = Math.sin(t * 30) > 0 ? '#ffd43b' : '#ff6b6b';
  ctx.beginPath();
  ctx.arc(cx + size * 0.12, cy - size * 0.48, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

/** A piece on its own, centred in a small box (the "next" preview). */
export function drawPiecePreview(ctx, kind, box, t) {
  ctx.clearRect(0, 0, box, box);
  const cells = SHAPES[kind];
  const w = Math.max(...cells.map((c) => c[0])) + 1, h = Math.max(...cells.map((c) => c[1])) + 1;
  const size = Math.min(box / 2.6, box / (Math.max(w, h) + 0.6));
  const ox = (box - w * size) / 2, oy = (box - h * size) / 2;
  for (const [x, y] of cells) {
    if (kind === 'bomb') drawBomb(ctx, ox + x * size, oy + y * size, t, size);
    else drawBlock(ctx, ox + x * size, oy + y * size, BLOCK_COLORS[PIECE_COLOR[kind]], size);
  }
}

function drawRock(ctx, g, x, y, colors) {
  const px = x * CELL, py = y * CELL;
  ctx.fillStyle = colors.rock;
  ctx.fillRect(px, py, CELL, CELL);
  // Pebbles, always in the same places for the same cell.
  ctx.fillStyle = colors.rockDot;
  const s = (x * 31 + y * 17) % 7;
  ctx.beginPath();
  ctx.arc(px + 8 + s * 3, py + 12 + (s % 3) * 7, 3, 0, Math.PI * 2);
  ctx.arc(px + 30 - s * 2, py + 28 - (s % 2) * 6, 2.4, 0, Math.PI * 2);
  ctx.fill();
  // Grass on top of open ground.
  if (y === 0 || at(g, x, y - 1) !== ROCK) {
    ctx.fillStyle = colors.grass;
    roundRect(ctx, px - 1, py - 2, CELL + 2, 10, 5);
    ctx.fill();
  }
}

/** The realistic door: wooden planks in a stone arch, with a little flag. */
function drawRealDoor(ctx, ex, ey, t) {
  const x = ex * CELL, y = ey * CELL;
  const arch = ctx.createLinearGradient(x, 0, x + CELL, 0);
  arch.addColorStop(0, '#5e5b57'); arch.addColorStop(0.5, '#9a958e'); arch.addColorStop(1, '#55524e');
  ctx.fillStyle = arch;
  ctx.beginPath(); ctx.moveTo(x + 3, y + CELL); ctx.lineTo(x + 3, y + 15); ctx.arc(x + CELL / 2, y + 15, CELL / 2 - 3, Math.PI, 0); ctx.lineTo(x + CELL - 3, y + CELL); ctx.fill();
  ctx.strokeStyle = 'rgba(40,38,36,0.6)'; ctx.lineWidth = 1;
  for (const a of [-2.6, -1.9, -1.2, -0.5]) { ctx.beginPath(); ctx.moveTo(x + CELL / 2 + Math.cos(a) * 9, y + 15 + Math.sin(a) * 9); ctx.lineTo(x + CELL / 2 + Math.cos(a) * 17, y + 15 + Math.sin(a) * 17); ctx.stroke(); }
  const wood = ctx.createLinearGradient(x, 0, x + CELL, 0);
  wood.addColorStop(0, '#4a2e1a'); wood.addColorStop(0.5, '#8a5a34'); wood.addColorStop(1, '#3e2614');
  ctx.fillStyle = wood;
  ctx.beginPath(); ctx.moveTo(x + 8, y + CELL); ctx.lineTo(x + 8, y + 16); ctx.arc(x + CELL / 2, y + 16, CELL / 2 - 8, Math.PI, 0); ctx.lineTo(x + CELL - 8, y + CELL); ctx.fill();
  ctx.strokeStyle = 'rgba(25,14,8,0.6)';
  for (const k of [15, 20, 25]) { ctx.beginPath(); ctx.moveTo(x + k, y + 9); ctx.lineTo(x + k, y + CELL); ctx.stroke(); }
  ctx.fillStyle = '#3a3a3e'; ctx.fillRect(x + 9, y + 20, 22, 2.5); ctx.fillRect(x + 9, y + 32, 22, 2.5);
  ctx.fillStyle = '#e1b84a'; ctx.beginPath(); ctx.arc(x + CELL - 13, y + 27, 2.2, 0, Math.PI * 2); ctx.fill();
  // The flag on top, flapping.
  ctx.strokeStyle = '#3a3a3e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + CELL / 2, y - 1); ctx.lineTo(x + CELL / 2, y - 16); ctx.stroke();
  const f = Math.sin(t * 5) * 2;
  ctx.fillStyle = '#e8484f'; ctx.beginPath(); ctx.moveTo(x + CELL / 2, y - 16); ctx.quadraticCurveTo(x + CELL / 2 + 7, y - 15 + f, x + CELL / 2 + 13, y - 12); ctx.lineTo(x + CELL / 2, y - 8); ctx.fill();
}

/** A gold star with a shine sweeping across it. */
function drawGoldStar(ctx, cx, cy, r, t) {
  const g = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#fff7cc'); g.addColorStop(0.4, '#f5c535'); g.addColorStop(1, '#a8740c');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.43 : r; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(120,80,10,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  const s = (t * 0.8) % 3; // a glint now and then
  if (s < 0.6) { ctx.fillStyle = `rgba(255,255,255,${0.8 * Math.sin((s / 0.6) * Math.PI)})`; ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.18, 0, Math.PI * 2); ctx.fill(); }
}

function drawDoor(ctx, ex, ey, t) {
  const x = ex * CELL, y = ey * CELL;
  ctx.fillStyle = '#8d5a3b';
  ctx.beginPath();
  ctx.moveTo(x + 6, y + CELL);
  ctx.lineTo(x + 6, y + 16);
  ctx.arc(x + CELL / 2, y + 16, CELL / 2 - 6, Math.PI, 0);
  ctx.lineTo(x + CELL - 6, y + CELL);
  ctx.fill();
  ctx.fillStyle = '#ffd43b';
  ctx.beginPath();
  ctx.arc(x + CELL - 13, y + 26, 2.6, 0, Math.PI * 2);
  ctx.fill();
  // A little flag on top, waving.
  ctx.strokeStyle = '#5c3d2e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + CELL / 2, y + 2);
  ctx.lineTo(x + CELL / 2, y - 16);
  ctx.stroke();
  ctx.fillStyle = '#ff6b8b';
  ctx.beginPath();
  ctx.moveTo(x + CELL / 2, y - 16);
  ctx.quadraticCurveTo(x + CELL / 2 + 8, y - 15 + Math.sin(t * 6) * 2, x + CELL / 2 + 15, y - 11);
  ctx.lineTo(x + CELL / 2, y - 6);
  ctx.fill();
}

export function drawStar(ctx, cx, cy, r, fill = '#ffd43b') {
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Poko: a little builder in a yellow hard hat and red overalls, striding along with a big
 * sledgehammer held out in front in both gloved hands. Drawn standing on (cx, by), the middle of
 * the cell's floor. `size` scales the drawing (CELL is life size).
 */
export function drawPoko(ctx, cx, by, dir, t, mood = 'walk', size = CELL) {
  const s = size / CELL;
  const walking = mood === 'walk' || mood === 'climb';
  const swing = walking ? Math.sin(t * 11) : 0;
  const bob = walking ? Math.abs(swing) * 1.5 * s : 0;
  const ink = '#2b2d42';
  const skin = '#ffd6b0';
  const red = '#e03131';
  const redDark = '#b02525';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const rr = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
  };
  // Everything is drawn facing right and mirrored for left.
  // A block is right over his head: flailing, wide-eyed ('panic2': it's nearly on him - worse).
  const panic = mood === 'panic' || mood === 'panic2';
  const shake = mood === 'panic2' ? 2.4 : 1.2, jump = mood === 'panic2' ? 4.5 : 2.5;
  ctx.save();
  ctx.translate(cx + (panic ? Math.sin(t * 45) * shake * s : 0), by - (panic ? Math.abs(Math.sin(t * (mood === 'panic2' ? 20 : 14))) * jump * s : 0));
  ctx.scale(dir * s, s);
  const B = -bob / s; // body lift

  // Legs in a long stride (back leg darker), chunky boots.
  for (const k of [-1, 1]) {
    const stride = k * swing * 6;
    ctx.strokeStyle = k < 0 ? redDark : red;
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(k * 1.5, -11 + B);
    ctx.lineTo(stride, -4.5);
    ctx.stroke();
    ctx.fillStyle = k < 0 ? '#5a3418' : '#6b3f22';
    rr(stride - 3, -6, 8, 5.5, 2.5);
    ctx.fill();
  }

  // Back arm reaching forward to the handle.
  const armsUp = mood === 'won' || mood === 'fall' || mood === 'scared' || mood === 'trip' || panic;
  const shoulder = [0, -19 + B];
  // The hammer: held low in front while walking, raised high when cheering or falling,
  // waved wildly overhead in a panic.
  const hammerAngle = mood === 'won' ? -1.9 + Math.sin(t * 12) * 0.6
    : panic ? -2.0 + Math.sin(t * 28) * 0.55
    : armsUp ? -2.2 + (mood === 'scared' ? Math.sin(t * 25) * 0.15 : 0)
    : -1.05 + swing * 0.12;
  const grip = armsUp ? [3, -30 + B] : [9, -14 + B];
  ctx.strokeStyle = '#4dabf7';
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(shoulder[0] - 2, shoulder[1]);
  ctx.lineTo(grip[0] - 1.5, grip[1] + 2);
  ctx.stroke();

  // Body: light blue shirt, red overall bib with yellow buttons, a brown tool belt with a pouch.
  ctx.fillStyle = '#4dabf7';
  rr(-6.5, -22 + B, 12, 9, 4);
  ctx.fill();
  ctx.fillStyle = red;
  rr(-6.5, -17 + B, 12.5, 8.5, 3);
  ctx.fill();
  ctx.fillRect(-4, -22 + B, 2.4, 5.5);
  ctx.fillRect(2, -22 + B, 2.4, 5.5);
  ctx.fillStyle = '#ffd43b';
  ctx.beginPath();
  ctx.arc(-2.8, -17 + B, 1.1, 0, Math.PI * 2);
  ctx.arc(3.2, -17 + B, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a4b2a';
  ctx.fillRect(-6.8, -12.5 + B, 13, 2.6);
  rr(-8.5, -13 + B, 4.5, 5, 1.2);
  ctx.fill();
  ctx.fillStyle = '#c9a26b';
  ctx.fillRect(-0.8, -12.3 + B, 2.6, 2.2);

  // The sledgehammer.
  ctx.save();
  ctx.translate(grip[0], grip[1]);
  ctx.rotate(hammerAngle);
  ctx.strokeStyle = '#e8873a';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.lineTo(13, 0);
  ctx.stroke();
  ctx.fillStyle = '#3b3f4a';
  rr(11, -6.5, 8, 13, 2.5);
  ctx.fill();
  ctx.fillStyle = '#5c6270';
  rr(12.2, -5.3, 2, 10.6, 1);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(17, -5.5, 1.2, 11);
  ctx.restore();

  // Front arm and both big white gloves on the handle.
  ctx.strokeStyle = '#4dabf7';
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.moveTo(shoulder[0] + 2, shoulder[1] + 1);
  ctx.lineTo(grip[0], grip[1]);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 0.8;
  for (const off of [0, 3.5]) {
    const gx = grip[0] + Math.cos(hammerAngle) * off, gy = grip[1] + Math.sin(hammerAngle) * off;
    ctx.beginPath();
    ctx.arc(gx, gy, 2.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(0, -29 + B);
  pokoHead(ctx, mood, t);
  ctx.restore();
  ctx.restore();
}

/*
 * Poko with joints, for the fall after a near miss. Facing right, feet on the ground at (0, 0),
 * in Poko's own units (a cell is 40). Angles: limbs measure from straight down, positive
 * swinging forward; the torso from upright, positive leaning forward; knees and elbows bend
 * the way real ones do (positive only).
 */
const THIGH = 3.4, SHIN = 3.2, UPPER = 5.2, FORE = 4.8;
const dirOf = (a) => [Math.sin(a), Math.cos(a)]; // a limb angle as a direction on screen

function limb(ctx, x, y, a1, len1, a2, len2, color, width) {
  const [dx1, dy1] = dirOf(a1), [dx2, dy2] = dirOf(a2);
  const kx = x + dx1 * len1, ky = y + dy1 * len1;
  const ex = kx + dx2 * len2, ey = ky + dy2 * len2;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(kx, ky);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  return [ex, ey];
}

function drawPosed(ctx, cx, by, dir, t, P, size = CELL) {
  const s = size / CELL;
  const red = '#e03131', redDark = '#b02525';
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); };
  ctx.save();
  ctx.translate(cx, by);
  ctx.scale(dir * s, s);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const [hx, hy] = P.hip;
  const up = (dx, dy) => [hx + dx * Math.cos(P.torso) - dy * Math.sin(P.torso), hy + dx * Math.sin(P.torso) + dy * Math.cos(P.torso)];
  const shoulder = up(0, -8);

  // Legs (back one darker) with boots set square to the shin.
  P.legs.forEach((L, i) => {
    const shin = L.th - L.kn;
    const [ax, ay] = limb(ctx, hx + (i ? 1.2 : -1.2), hy, L.th, THIGH, shin, SHIN, i ? red : redDark, 5.5);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(-shin);
    ctx.fillStyle = i ? '#6b3f22' : '#5a3418';
    rr(-3, -1.5, 8, 5.5, 2.5);
    ctx.fill();
    ctx.restore();
  });

  // Back arm, the body, the hammer, then the front arm (both white gloves).
  const hand = (A) => limb(ctx, shoulder[0], shoulder[1], A.sh, UPPER, A.sh - A.el, FORE, '#4dabf7', 3.6);
  const glove = ([x, y]) => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(x, y, 2.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };
  glove(hand(P.arms[0]));

  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(P.torso);
  ctx.fillStyle = '#4dabf7';
  rr(-6.5, -11, 12, 9, 4);
  ctx.fill();
  ctx.fillStyle = red;
  rr(-6.5, -6, 12.5, 8.5, 3);
  ctx.fill();
  ctx.fillRect(-4, -11, 2.4, 5.5);
  ctx.fillRect(2, -11, 2.4, 5.5);
  ctx.fillStyle = '#ffd43b';
  ctx.beginPath();
  ctx.arc(-2.8, -6, 1.1, 0, Math.PI * 2);
  ctx.arc(3.2, -6, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a4b2a';
  ctx.fillRect(-6.8, -1.5, 13, 2.6);
  rr(-8.5, -2, 4.5, 5, 1.2);
  ctx.fill();
  ctx.fillStyle = '#c9a26b';
  ctx.fillRect(-0.8, -1.3, 2.6, 2.2);
  ctx.restore();

  const front = hand(P.arms[1]);
  ctx.save(); // the sledgehammer, still in his front hand
  ctx.translate(front[0], front[1]);
  ctx.rotate(P.hammer);
  ctx.strokeStyle = '#e8873a';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.lineTo(13, 0);
  ctx.stroke();
  ctx.fillStyle = '#3b3f4a';
  rr(11, -6.5, 8, 13, 2.5);
  ctx.fill();
  ctx.fillStyle = '#5c6270';
  rr(12.2, -5.3, 2, 10.6, 1);
  ctx.fill();
  ctx.restore();
  glove(front);

  const [nx, ny] = up(1, -18);
  ctx.save();
  ctx.translate(nx, ny);
  ctx.rotate(P.torso + P.head);
  pokoHead(ctx, 'trip', t);
  ctx.restore();
  ctx.restore();
  return { head: [cx + dir * s * nx, by + s * ny], belly: [cx + dir * s * up(0, -4)[0], by + s * up(0, -4)[1]] };
}

// The fall, as poses through time (seconds into TRIP). Between keys the joints blend smoothly;
// `ease` is how each stretch moves: 'in' speeds up (falling), 'out' slows down (landing,
// standing up), 'io' both.
const TRIP_KEYS = [
  { k: 0, hip: [0, -11], torso: 0, head: 0, legs: [{ th: -0.25, kn: 0 }, { th: 0.25, kn: 0 }], arms: [{ sh: 0.9, el: 0.2 }, { sh: 1.0, el: 0.3 }], hammer: -1.05 },
  // The back foot catches: he lurches forward, arms fly up.
  { k: 0.1, ease: 'out', hip: [2.5, -10.6], torso: 0.45, head: -0.2, legs: [{ th: -0.75, kn: 0.6 }, { th: 0.6, kn: 0.25 }], arms: [{ sh: 1.7, el: 0.3 }, { sh: 2.0, el: 0.2 }], hammer: -1.7 },
  // Knees hit the ground, hands shoot out.
  { k: 0.22, ease: 'in', hip: [5, -6.2], torso: 0.95, head: -0.35, legs: [{ th: 0.2, kn: 1.75 }, { th: 0.5, kn: 1.9 }], arms: [{ sh: 1.25, el: 0.1 }, { sh: 1.05, el: 0 }], hammer: -0.35 },
  // Down on his tummy, propped on his big head (face turned out), arms out ahead, heels up.
  { k: 0.34, ease: 'in', hip: [7.5, -3.6], torso: 1.2, head: -0.55, legs: [{ th: -1.4, kn: 0.7 }, { th: -1.5, kn: 0.95 }], arms: [{ sh: 1.35, el: 0.15 }, { sh: 1.5, el: 0 }], hammer: 0 },
  { k: 0.6, ease: 'io', hip: [7.5, -3.6], torso: 1.2, head: -0.45, legs: [{ th: -1.4, kn: 0.9 }, { th: -1.5, kn: 0.7 }], arms: [{ sh: 1.35, el: 0.15 }, { sh: 1.5, el: 0 }], hammer: 0 },
  // Pushes up onto hands and knees.
  { k: 0.7, ease: 'io', hip: [5.5, -6], torso: 1.05, head: -0.15, legs: [{ th: 0.2, kn: 1.75 }, { th: 0.45, kn: 1.85 }], arms: [{ sh: 0.35, el: 0 }, { sh: 0.45, el: 0 }], hammer: -0.5 },
  // One foot forward, rising.
  { k: 0.8, ease: 'io', hip: [2.2, -9.6], torso: 0.35, head: 0, legs: [{ th: -0.35, kn: 0.6 }, { th: 0.7, kn: 1.1 }], arms: [{ sh: 0.8, el: 0.4 }, { sh: 0.95, el: 0.4 }], hammer: -1.0 },
  { k: TRIP, ease: 'out', hip: [0, -11], torso: 0, head: 0, legs: [{ th: -0.25, kn: 0 }, { th: 0.25, kn: 0 }], arms: [{ sh: 0.9, el: 0.2 }, { sh: 1.0, el: 0.3 }], hammer: -1.05 },
];
const EASE = { in: (u) => u * u, out: (u) => 1 - (1 - u) * (1 - u), io: (u) => u * u * (3 - 2 * u) };
function lerpPose(A, B, u) {
  const m = (x, y) => x + (y - x) * u;
  return {
    hip: [m(A.hip[0], B.hip[0]), m(A.hip[1], B.hip[1])], torso: m(A.torso, B.torso), head: m(A.head, B.head),
    legs: A.legs.map((L, i) => ({ th: m(L.th, B.legs[i].th), kn: m(L.kn, B.legs[i].kn) })),
    arms: A.arms.map((L, i) => ({ sh: m(L.sh, B.arms[i].sh), el: m(L.el, B.arms[i].el) })),
    hammer: m(A.hammer, B.hammer),
  };
}
export function tripPose(k) {
  let i = 1;
  while (i < TRIP_KEYS.length - 1 && k > TRIP_KEYS[i].k) i++;
  const A = TRIP_KEYS[i - 1], B = TRIP_KEYS[i];
  const u = Math.min(1, Math.max(0, (k - A.k) / (B.k - A.k)));
  const P = lerpPose(A, B, EASE[B.ease || 'io'](u));
  // A little bounce as he lands on his tummy, and his feet kicking while he's down.
  if (k > 0.34 && k < 0.46) P.hip[1] -= Math.sin(((k - 0.34) / 0.12) * Math.PI) * 1.4;
  if (k > 0.38 && k < 0.62) P.legs.forEach((L, j) => { L.kn += Math.max(0, Math.sin(k * 30 + j * 2)) * 0.45; });
  return P;
}

/**
 * Poko knocked flat by a near miss, `k` seconds in (of TRIP): he catches his foot, goes down
 * on his knees and hands and onto his tummy (a puff of dust, stars round his head), then pushes
 * himself up and stands.
 */
function drawTripped(ctx, px, py, dir, t, k) {
  const P = tripPose(k);
  // Dust where he lands.
  if (k > 0.2 && k < 0.6) {
    const a = 1 - (k - 0.2) / 0.4;
    ctx.fillStyle = `rgba(200,180,150,${0.65 * a})`;
    for (const [dx, r0] of [[2, 5], [12, 6], [22, 4]]) {
      ctx.beginPath();
      ctx.arc(px + dir * dx, py - 3 - (k - 0.2) * 14, r0 + (k - 0.2) * 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const at = drawPosed(ctx, px, py, dir, t, P, CELL * 1.15);
  // Stars circling his head while he's down.
  if (k > 0.3 && k < 0.66) {
    const [hx, hy] = at.head;
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + (i * Math.PI * 2) / 3;
      drawStar(ctx, hx + Math.cos(a) * 11, hy - 13 + Math.sin(a) * 4, 4.5);
    }
  }
}

/** Poko's head, hard hat and face, drawn around the centre of his head (facing right). */
function pokoHead(ctx, mood, t) {
  const panic = mood === 'panic' || mood === 'panic2';
  const ink = '#2b2d42';
  const skin = '#ffd6b0';
  const rr = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
  };
  // Head, ear and a tuft of brown hair.
  const hy = 0;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(1, hy, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a2e1c';
  ctx.beginPath();
  ctx.ellipse(-6, hy, 3.6, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(-3.5, hy + 1.5, 2.3, 0, Math.PI * 2);
  ctx.fill();

  // Yellow hard hat: a big dome, a ridge and a peak out front.
  ctx.fillStyle = '#ffc61a';
  ctx.beginPath();
  ctx.ellipse(0.5, hy - 3.5, 11, 9.5, 0, Math.PI, 0);
  ctx.fill();
  rr(-11, hy - 5, 25, 3.4, 1.7);
  ctx.fill();
  ctx.fillStyle = '#f0a500';
  ctx.beginPath();
  ctx.ellipse(0.5, hy - 3.5, 2, 9.5, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(-11, hy - 2.4, 25, 0.9);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-4.5, hy - 9, 2.8, 1.5, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Face, in profile-ish three-quarter view looking ahead.
  const ex = 5, ey = hy + 1.5;
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  if (mood === 'trip') {
    ctx.lineWidth = 1.4;
    for (const k of [-1, 1]) {
      const cx = ex + k * 3;
      ctx.beginPath();
      ctx.moveTo(cx - k * 1.6, ey - 1.6);
      ctx.lineTo(cx + k * 1.2, ey);
      ctx.lineTo(cx - k * 1.6, ey + 1.6);
      ctx.stroke();
    }
  } else if (mood === 'won') {
    ctx.lineWidth = 1.5;
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(ex + k * 3, ey + 0.5, 1.7, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  } else {
    const blink = panic ? 1 : Math.sin(t * 1.7) > 0.985 ? 0.2 : 1;
    const big = panic ? 1.5 : mood === 'scared' || mood === 'fall' || mood === 'lost' ? 1.3 : 1;
    for (const k of [-1, 1]) {
      if (panic) { // wide white eyes looking up at the block
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex + k * 3, ey - 0.5, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = ink;
      }
      ctx.beginPath();
      ctx.ellipse(ex + k * 3, ey - (panic ? 1.6 : 0), 1.3 * (panic ? 0.9 : big), 2.1 * (panic ? 0.7 : big) * blink, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (panic) { // worried eyebrows shooting up (inner ends raised)
      ctx.lineWidth = 1.2;
      for (const k of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(ex + k * 3 - 1.8, ey - 5.5 - k * 0.8);
        ctx.lineTo(ex + k * 3 + 1.8, ey - 5.5 + k * 0.8);
        ctx.stroke();
      }
    }
  }
  ctx.fillStyle = '#ffb48a';
  ctx.beginPath();
  ctx.arc(ex + 4.5, ey + 2.8, 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff8f8f';
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(ex - 4.5, ey + 3.2, 2, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  if (panic) { // a big open, wobbling mouth
    ctx.fillStyle = '#7a2626';
    ctx.ellipse(ex + 1, ey + 6, 2.2, 2.4 + Math.sin(t * 30) * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (mood === 'scared' || mood === 'lost' || mood === 'fall' || mood === 'trip') ctx.ellipse(ex + 1, ey + 5.8, 1.4, 1.8, 0, 0, Math.PI * 2);
  else { ctx.strokeStyle = '#a34848'; ctx.lineWidth = 1.1; ctx.arc(ex + 0.5, ey + 5, 1.7, 0.3, Math.PI - 0.3); } // a small smile
  ctx.stroke();
  if (mood === 'scared') { // a drop of sweat
    ctx.fillStyle = '#74c0fc';
    ctx.beginPath();
    ctx.ellipse(-9, hy - 1 + ((t * 20) % 6), 1.8, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (panic) { // sweat flying off both sides
    ctx.fillStyle = '#74c0fc';
    for (const [k, ph] of [[-1, 0], [1, 0.5]]) {
      const a = (t * 2.2 + ph) % 1;
      ctx.globalAlpha = 1 - a;
      ctx.beginPath();
      ctx.ellipse(1 + k * (10 + a * 8), hy - 6 + a * 6 - Math.sin(a * Math.PI) * 5, 1.6, 2.4, k * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ----- Scenery: Poko's journey, five stages in each place, then round again -----

export const THEMES = ['forest', 'cave', 'ruins', 'desert', 'snow', 'volcano'];
/** The scenery for stage n (hand-made stages 1–5 are the forest), or for a weekly challenge. */
export const themeOf = (n, week) => (week !== undefined ? THEMES[week % THEMES.length] : THEMES[Math.floor((n - 1) / 5) % THEMES.length]);

// Each place has its own rock and edge colours (the edge is grass in the forest, a pale stone
// lip in the cave, moss on the ruins' sandstone, sand in the desert, snow on the mountain,
// glowing cracks on the volcano's dark rock).
// The veil over each place's scenery (light on bright places, dark in the cave and volcano).
const HAZE = {
  forest: 'rgba(236,248,240,0.38)', cave: 'rgba(16,12,26,0.32)', ruins: 'rgba(255,242,220,0.36)',
  desert: 'rgba(255,246,228,0.36)', snow: 'rgba(242,247,255,0.34)', volcano: 'rgba(24,10,12,0.32)',
};

const THEME_COLORS = {
  forest: { rock: '#7a5a40', rockDot: '#5e4430', grass: '#5cbf4a' },
  cave: { rock: '#5d566b', rockDot: '#463f56', grass: '#a29bb8', ghost: 'rgba(255,255,255,0.6)', text: '#eef3ff' },
  ruins: { rock: '#b48f63', rockDot: '#8f6e48', grass: '#6aa84f' },
  desert: { rock: '#c8925a', rockDot: '#a8743f', grass: '#f1d394' },
  snow: { rock: '#4b5874', rockDot: '#3a4560', grass: '#f6faff' },
  volcano: { rock: '#4a3a3c', rockDot: '#33282a', grass: '#d8642f', ghost: 'rgba(255,255,255,0.65)', text: '#fff1e6' },
};

/** A little seeded random, so the scenery is the same every time. */
function seeded(seed) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

function paintForest(c) {
  const BW = 400, BH = 600, r = seeded(11);
  const sky = c.createLinearGradient(0, 0, 0, BH);
  sky.addColorStop(0, '#9fdcef'); sky.addColorStop(0.55, '#d4f1dc'); sky.addColorStop(1, '#eefbe6');
  c.fillStyle = sky; c.fillRect(0, 0, BW, BH);
  // Far trees: pale, round, overlapping.
  const crowns = (base, color, size, count) => {
    c.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const x = (i / (count - 1)) * BW + (r() - 0.5) * 30, y = base + (r() - 0.5) * 40, s = size * (0.7 + r() * 0.6);
      c.fillRect(x - s * 0.08, y, s * 0.16, BH - y);
      c.beginPath(); c.arc(x, y, s * 0.55, 0, Math.PI * 2); c.arc(x - s * 0.35, y + s * 0.2, s * 0.4, 0, Math.PI * 2); c.arc(x + s * 0.35, y + s * 0.2, s * 0.42, 0, Math.PI * 2); c.fill();
    }
  };
  crowns(330, 'rgba(120,180,150,0.45)', 90, 7);
  crowns(390, 'rgba(70,140,100,0.55)', 110, 6);
  // Sunbeams through the leaves.
  c.fillStyle = 'rgba(255,255,220,0.18)';
  for (const x of [60, 170, 300]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 40, 0); c.lineTo(x + 140, BH); c.lineTo(x + 70, BH); c.fill(); }
  // Leaves and vines hanging from the top.
  c.fillStyle = '#3f8f4f';
  for (let x = -20; x < BW + 20; x += 34) { c.beginPath(); c.ellipse(x + r() * 10, 6 + r() * 12, 30, 22, 0, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = '#2f7a3f'; c.lineWidth = 3;
  for (const x of [35, 140, 255, 360]) {
    const len = 60 + r() * 90;
    c.beginPath(); c.moveTo(x, 20); c.quadraticCurveTo(x + 12, 20 + len / 2, x - 4, 20 + len); c.stroke();
    c.fillStyle = '#4caf50';
    for (let k = 30; k < len; k += 22) { c.beginPath(); c.ellipse(x + 4, 20 + k, 6, 3.5, 0.6, 0, Math.PI * 2); c.fill(); }
  }
  // Little flowers and fireflies of light.
  c.fillStyle = 'rgba(255,255,200,0.7)';
  for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(r() * BW, 120 + r() * 300, 1.5 + r() * 1.5, 0, Math.PI * 2); c.fill(); }
}

function paintCave(c) {
  const BW = 400, BH = 600, r = seeded(23);
  const bg = c.createLinearGradient(0, 0, 0, BH);
  bg.addColorStop(0, '#1d1828'); bg.addColorStop(0.6, '#2f2640'); bg.addColorStop(1, '#43344f');
  c.fillStyle = bg; c.fillRect(0, 0, BW, BH);
  // Far cave walls: lumpy dark shapes on both sides.
  c.fillStyle = 'rgba(15,10,24,0.55)';
  for (const side of [0, 1]) {
    c.beginPath(); c.moveTo(side ? BW : 0, 0);
    for (let y = 0; y <= BH; y += 40) c.lineTo(side ? BW - (30 + r() * 50) : 30 + r() * 50, y);
    c.lineTo(side ? BW : 0, BH); c.fill();
  }
  // Rock columns in the distance.
  c.fillStyle = 'rgba(80,66,100,0.5)';
  for (const x of [110, 270]) { c.beginPath(); c.moveTo(x - 18, BH); c.lineTo(x - 8, 0); c.lineTo(x + 10, 0); c.lineTo(x + 22, BH); c.fill(); }
  // Stalactites.
  c.fillStyle = '#15111e';
  c.fillRect(0, 0, BW, 10);
  for (let x = 0; x < BW; x += 18 + r() * 18) {
    const len = 20 + r() * 70, w = 10 + r() * 14;
    c.beginPath(); c.moveTo(x - w / 2, 8); c.lineTo(x, 8 + len); c.lineTo(x + w / 2, 8); c.fill();
  }
  // Glowing crystals.
  const crystal = (x, y, s, hue) => {
    const glow = c.createRadialGradient(x, y, 0, x, y, s * 3);
    glow.addColorStop(0, `hsla(${hue},90%,70%,0.45)`); glow.addColorStop(1, `hsla(${hue},90%,70%,0)`);
    c.fillStyle = glow; c.beginPath(); c.arc(x, y, s * 3, 0, Math.PI * 2); c.fill();
    c.fillStyle = `hsl(${hue},80%,72%)`;
    for (const [dx, h, a] of [[0, s * 1.6, 0], [-s * 0.6, s, -0.4], [s * 0.6, s * 1.1, 0.4]]) {
      c.save(); c.translate(x + dx, y + s * 0.4); c.rotate(a);
      c.beginPath(); c.moveTo(-s * 0.3, 0); c.lineTo(0, -h); c.lineTo(s * 0.3, 0); c.fill(); c.restore();
    }
  };
  crystal(40, 160, 9, 190); crystal(355, 120, 8, 280); crystal(300, 330, 10, 190); crystal(70, 400, 7, 300); crystal(200, 70, 6, 200);
  // Specks of light drifting in the dark.
  c.fillStyle = 'rgba(190,230,255,0.5)';
  for (let i = 0; i < 24; i++) { c.beginPath(); c.arc(r() * BW, 40 + r() * 460, 0.8 + r() * 1.2, 0, Math.PI * 2); c.fill(); }
}

function paintRuins(c) {
  const BW = 400, BH = 600, r = seeded(37);
  const sky = c.createLinearGradient(0, 0, 0, BH);
  sky.addColorStop(0, '#f2a46f'); sky.addColorStop(0.5, '#ffd39a'); sky.addColorStop(1, '#fff0cf');
  c.fillStyle = sky; c.fillRect(0, 0, BW, BH);
  // The sun, low.
  const sun = c.createRadialGradient(290, 230, 0, 290, 230, 90);
  sun.addColorStop(0, 'rgba(255,250,220,0.95)'); sun.addColorStop(0.35, 'rgba(255,235,170,0.6)'); sun.addColorStop(1, 'rgba(255,220,150,0)');
  c.fillStyle = sun; c.beginPath(); c.arc(290, 230, 90, 0, Math.PI * 2); c.fill();
  // A stepped temple far away.
  c.fillStyle = 'rgba(170,110,80,0.35)';
  for (let k = 0; k < 6; k++) c.fillRect(170 - k * 22 + 0, 300 + k * 22, 120 + k * 44, 24);
  c.fillRect(205, 270, 50, 32);
  // Broken columns and an arch.
  const column = (x, base, h, broken) => {
    c.fillStyle = 'rgba(150,105,75,0.55)';
    c.fillRect(x - 13, base - h, 26, h);
    c.fillRect(x - 18, base - 10, 36, 10);
    if (!broken) c.fillRect(x - 18, base - h - 9, 36, 10);
    else { c.beginPath(); c.moveTo(x - 13, base - h); c.lineTo(x - 4, base - h - 12); c.lineTo(x + 4, base - h - 3); c.lineTo(x + 13, base - h - 9); c.lineTo(x + 13, base - h); c.fill(); }
    c.fillStyle = 'rgba(120,80,55,0.35)';
    for (let k = -8; k <= 8; k += 8) c.fillRect(x + k - 1, base - h + 4, 2, h - 14);
  };
  column(40, 520, 230, true); column(120, 520, 160, false); column(355, 520, 260, false); column(300, 520, 120, true);
  c.strokeStyle = 'rgba(150,105,75,0.55)'; c.lineWidth = 16;
  c.beginPath(); c.arc(80, 362, 40, Math.PI, 0); c.stroke();
  // Vines and leaves on the stones, and from the top.
  c.strokeStyle = '#4f8f3a'; c.lineWidth = 2.5;
  for (const [x, y0, len] of [[355, 255, 120], [42, 290, 90], [120, 360, 60], [180, 0, 70], [250, 0, 110]]) {
    c.beginPath(); c.moveTo(x, y0); c.bezierCurveTo(x + 10, y0 + len / 3, x - 10, y0 + (2 * len) / 3, x + 3, y0 + len); c.stroke();
    c.fillStyle = '#5fa046';
    for (let k = 10; k < len; k += 16) { c.beginPath(); c.ellipse(x + (k % 32 ? 5 : -5), y0 + k, 5, 3, k % 32 ? 0.5 : -0.5, 0, Math.PI * 2); c.fill(); }
  }
  // Birds.
  c.strokeStyle = 'rgba(90,60,50,0.55)'; c.lineWidth = 2;
  for (let i = 0; i < 4; i++) { const x = 40 + r() * 300, y = 50 + r() * 120; c.beginPath(); c.moveTo(x - 7, y); c.quadraticCurveTo(x - 3, y - 5, x, y); c.quadraticCurveTo(x + 3, y - 5, x + 7, y); c.stroke(); }
}

function paintDesert(c) {
  const BW = 400, BH = 600, r = seeded(51);
  const sky = c.createLinearGradient(0, 0, 0, BH);
  sky.addColorStop(0, '#7cc8f0'); sky.addColorStop(0.55, '#bfe6f3'); sky.addColorStop(1, '#ffe6b0');
  c.fillStyle = sky; c.fillRect(0, 0, BW, BH);
  // A hot white sun, high up.
  const sun = c.createRadialGradient(320, 90, 0, 320, 90, 110);
  sun.addColorStop(0, 'rgba(255,255,240,1)'); sun.addColorStop(0.2, 'rgba(255,250,210,0.85)'); sun.addColorStop(1, 'rgba(255,240,190,0)');
  c.fillStyle = sun; c.beginPath(); c.arc(320, 90, 110, 0, Math.PI * 2); c.fill();
  // Flat-topped mesas far away.
  c.fillStyle = 'rgba(205,140,95,0.45)';
  for (const [x, w, h] of [[30, 90, 120], [150, 60, 80], [280, 110, 140]]) {
    c.beginPath(); c.moveTo(x - 20, 420); c.lineTo(x, 420 - h); c.lineTo(x + w, 420 - h); c.lineTo(x + w + 20, 420); c.fill();
    c.fillStyle = 'rgba(185,115,75,0.35)'; c.fillRect(x, 420 - h, w, 8); c.fillStyle = 'rgba(205,140,95,0.45)';
  }
  // Rolling dunes, far to near.
  const dune = (base, amp, color, phase) => {
    c.fillStyle = color; c.beginPath(); c.moveTo(0, BH);
    for (let x = 0; x <= BW; x += 10) c.lineTo(x, base + Math.sin(x / 70 + phase) * amp + Math.sin(x / 31 + phase * 2) * amp * 0.3);
    c.lineTo(BW, BH); c.fill();
  };
  dune(400, 18, 'rgba(240,200,140,0.75)', 0.5);
  dune(450, 22, 'rgba(232,184,118,0.85)', 2.1);
  // Cacti.
  const cactus = (x, base, h) => {
    c.fillStyle = 'rgba(70,140,90,0.75)';
    c.beginPath(); c.roundRect ? c.roundRect(x - 7, base - h, 14, h, 7) : c.rect(x - 7, base - h, 14, h); c.fill();
    c.beginPath(); c.roundRect ? c.roundRect(x - 22, base - h * 0.7, 9, h * 0.35, 5) : c.rect(x - 22, base - h * 0.7, 9, h * 0.35); c.fill();
    c.fillRect(x - 22, base - h * 0.42, 16, 8);
    c.beginPath(); c.roundRect ? c.roundRect(x + 13, base - h * 0.8, 9, h * 0.4, 5) : c.rect(x + 13, base - h * 0.8, 9, h * 0.4); c.fill();
    c.fillRect(x + 6, base - h * 0.47, 16, 8);
  };
  cactus(70, 440, 70); cactus(330, 455, 90); cactus(205, 430, 45);
  // Heat shimmer and a pair of vultures.
  c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = 1.2;
  for (let i = 0; i < 2; i++) { const y = 395 + i * 16; c.beginPath(); for (let x = 0; x <= BW; x += 8) c.lineTo(x, y + Math.sin(x / 12 + i) * 1.5); c.stroke(); }
  c.strokeStyle = 'rgba(80,50,40,0.5)'; c.lineWidth = 2;
  for (let i = 0; i < 2; i++) { const x = 90 + r() * 200, y = 150 + r() * 80; c.beginPath(); c.moveTo(x - 9, y); c.quadraticCurveTo(x - 4, y - 6, x, y); c.quadraticCurveTo(x + 4, y - 6, x + 9, y); c.stroke(); }
}

function paintSnow(c) {
  const BW = 400, BH = 600, r = seeded(67);
  const sky = c.createLinearGradient(0, 0, 0, BH);
  sky.addColorStop(0, '#9cc7ec'); sky.addColorStop(0.6, '#d9ecfb'); sky.addColorStop(1, '#f3f8ff');
  c.fillStyle = sky; c.fillRect(0, 0, BW, BH);
  // Big mountains with snowy tops, two layers.
  const peaks = (pts, base, rock, snowLine) => {
    c.fillStyle = rock; c.beginPath(); c.moveTo(0, base);
    for (const [x, y] of pts) c.lineTo(x, y);
    c.lineTo(BW, base); c.lineTo(BW, BH); c.lineTo(0, BH); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.92)';
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, y] = pts[i], [px, py] = pts[i - 1], [nx, ny] = pts[i + 1];
      if (y > pts[i - 1][1] || y > pts[i + 1][1]) continue; // only the peaks
      const k = snowLine;
      c.beginPath(); c.moveTo(x, y);
      c.lineTo(x + (px - x) * k, y + (py - y) * k);
      c.lineTo(x + (px - x) * k * 0.6 + 6, y + (py - y) * k * 0.8);
      c.lineTo(x, y + (py - y) * k * 0.55 + 8);
      c.lineTo(x + (nx - x) * k * 0.6 - 4, y + (ny - y) * k * 0.85);
      c.lineTo(x + (nx - x) * k, y + (ny - y) * k);
      c.fill();
    }
  };
  peaks([[0, 330], [70, 210], [140, 300], [230, 150], [320, 280], [400, 200]], 360, 'rgba(140,160,195,0.6)', 0.35);
  peaks([[0, 420], [90, 300], [170, 390], [260, 280], [360, 400], [400, 360]], 440, 'rgba(150,170,205,0.6)', 0.3);
  // Snowy pine trees.
  const pine = (x, base, h) => {
    c.fillStyle = 'rgba(40,85,80,0.8)';
    for (let k = 0; k < 3; k++) { const w = h * (0.5 - k * 0.12), y = base - k * h * 0.28; c.beginPath(); c.moveTo(x - w, y); c.lineTo(x, y - h * 0.42); c.lineTo(x + w, y); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.9)';
    for (let k = 0; k < 3; k++) { const w = h * (0.5 - k * 0.12), y = base - k * h * 0.28; c.beginPath(); c.moveTo(x - w * 0.55, y - h * 0.2); c.lineTo(x, y - h * 0.42); c.lineTo(x + w * 0.55, y - h * 0.2); c.fill(); }
  };
  pine(40, 470, 70); pine(95, 480, 55); pine(300, 475, 80); pine(365, 470, 60);
  // Snow drifts at the bottom and snow in the air.
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(0, BH);
  for (let x = 0; x <= BW; x += 10) c.lineTo(x, 480 + Math.sin(x / 50) * 10);
  c.lineTo(BW, BH); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 50; i++) { c.beginPath(); c.arc(r() * BW, r() * 460, 1 + r() * 2, 0, Math.PI * 2); c.fill(); }
}

function paintVolcano(c) {
  const BW = 400, BH = 600, r = seeded(83);
  const sky = c.createLinearGradient(0, 0, 0, BH);
  sky.addColorStop(0, '#2a1218'); sky.addColorStop(0.5, '#5c1f1a'); sky.addColorStop(1, '#a3401c');
  c.fillStyle = sky; c.fillRect(0, 0, BW, BH);
  // Ash clouds.
  c.fillStyle = 'rgba(40,25,30,0.55)';
  for (const [x, y, s] of [[60, 60, 50], [130, 40, 60], [250, 70, 55], [340, 45, 60], [190, 100, 40]]) { c.beginPath(); c.arc(x, y, s, 0, Math.PI * 2); c.fill(); }
  // The volcano, glowing at the top, a plume of smoke and lava running down.
  const glow = c.createRadialGradient(200, 230, 0, 200, 230, 140);
  glow.addColorStop(0, 'rgba(255,170,60,0.7)'); glow.addColorStop(1, 'rgba(255,90,30,0)');
  c.fillStyle = glow; c.beginPath(); c.arc(200, 230, 140, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(30,18,20,0.85)';
  c.beginPath(); c.moveTo(-20, 470); c.lineTo(165, 235); c.lineTo(235, 235); c.lineTo(420, 470); c.lineTo(420, BH); c.lineTo(-20, BH); c.fill();
  c.strokeStyle = 'rgba(255,120,40,0.85)'; c.lineWidth = 5; c.lineCap = 'round';
  for (const [x0, bend, x1] of [[185, 150, 120], [215, 250, 280], [200, 205, 215]]) {
    c.beginPath(); c.moveTo(x0, 240); c.quadraticCurveTo(bend, 330, x1, 440); c.stroke();
  }
  c.fillStyle = 'rgba(255,190,80,0.95)'; c.beginPath(); c.ellipse(200, 236, 36, 7, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(70,50,55,0.6)';
  for (let k = 0; k < 7; k++) { c.beginPath(); c.arc(200 + Math.sin(k) * 18 + k * 6, 200 - k * 26, 22 + k * 5, 0, Math.PI * 2); c.fill(); }
  // Embers in the air.
  for (let i = 0; i < 30; i++) {
    c.fillStyle = `rgba(255,${150 + Math.floor(r() * 80)},60,${0.5 + r() * 0.5})`;
    c.beginPath(); c.arc(r() * BW, 120 + r() * 380, 1 + r() * 1.8, 0, Math.PI * 2); c.fill();
  }
}

// ----- More detail on each place (painted once, over the base picture) -----

const blob = (c, x, y, rx, ry, color) => { c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); };
function cloud(c, x, y, s, color) {
  c.fillStyle = color; c.beginPath();
  c.ellipse(x, y, 34 * s, 14 * s, 0, 0, Math.PI * 2); c.ellipse(x - 22 * s, y + 4 * s, 20 * s, 11 * s, 0, 0, Math.PI * 2);
  c.ellipse(x + 24 * s, y + 3 * s, 22 * s, 12 * s, 0, 0, Math.PI * 2); c.ellipse(x + 4 * s, y - 10 * s, 20 * s, 14 * s, 0, 0, Math.PI * 2);
  c.fill();
}

function forestMore(c) {
  const r = seeded(101);
  // Hazy hills far behind the trees.
  c.fillStyle = 'rgba(150,200,175,0.35)'; c.beginPath(); c.moveTo(0, 360);
  for (let x = 0; x <= 400; x += 10) c.lineTo(x, 300 + Math.sin(x / 60) * 18 + Math.sin(x / 23) * 6);
  c.lineTo(400, 600); c.lineTo(0, 600); c.fill();
  // A near layer of darker trunks with bark lines.
  for (const x of [18, 128, 236, 372]) {
    c.fillStyle = 'rgba(70,55,45,0.22)'; c.fillRect(x - 9, 250, 18, 350);
    c.strokeStyle = 'rgba(40,30,25,0.12)'; c.lineWidth = 1.5;
    for (let y = 270; y < 600; y += 26) { c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x - 2, y + 10); c.stroke(); c.beginPath(); c.moveTo(x + 5, y + 12); c.lineTo(x + 2, y + 22); c.stroke(); }
    blob(c, x, 245, 46, 32, 'rgba(50,120,70,0.28)'); blob(c, x - 26, 262, 30, 22, 'rgba(60,135,80,0.25)'); blob(c, x + 28, 260, 32, 22, 'rgba(45,110,65,0.25)');
  }
  // Ground-level things are kept faint, so nobody takes them for part of the stage.
  c.globalAlpha = 0.25;
  // Bushes, ferns, flowers and mushrooms along the bottom.
  for (let x = -10; x < 420; x += 38) blob(c, x + r() * 10, 470 + r() * 12, 26 + r() * 10, 16 + r() * 6, `rgba(${60 + r() * 30},${140 + r() * 30},${70 + r() * 20},0.75)`);
  c.strokeStyle = 'rgba(70,150,80,0.8)'; c.lineWidth = 2;
  for (let i = 0; i < 10; i++) { const x = r() * 400, y = 470 + r() * 20; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + k * 6, y - 14, x + k * 10, y - 18 - Math.abs(k) * -2); c.stroke(); } }
  for (let i = 0; i < 14; i++) {
    const x = r() * 400, y = 468 + r() * 26, col = ['#ff8fb1', '#ffd43b', '#ffffff', '#b197fc'][i % 4];
    c.fillStyle = col; for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; c.beginPath(); c.arc(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 2.2, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#ffb703'; c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill();
  }
  for (const [x, y, s] of [[60, 482, 1], [300, 478, 1.2], [340, 486, 0.8]]) {
    c.fillStyle = '#f4ead5'; c.fillRect(x - 2.5 * s, y - 8 * s, 5 * s, 9 * s);
    c.fillStyle = '#e8574a'; c.beginPath(); c.ellipse(x, y - 8 * s, 9 * s, 6 * s, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#fff'; for (const dx of [-4, 1, 4]) { c.beginPath(); c.arc(x + dx * s, y - 11 * s + Math.abs(dx) * 0.4 * s, 1.3 * s, 0, Math.PI * 2); c.fill(); }
  }
}

function caveMore(c) {
  const r = seeded(113);
  // Stalactites with a pale edge, and stalagmites rising from below.
  for (let x = 8; x < 400; x += 26 + r() * 22) {
    const len = 30 + r() * 80, w = 12 + r() * 12;
    c.fillStyle = '#211a2e'; c.beginPath(); c.moveTo(x - w / 2, 0); c.lineTo(x, len); c.lineTo(x + w / 2, 0); c.fill();
    c.fillStyle = 'rgba(160,150,200,0.25)'; c.beginPath(); c.moveTo(x - w / 2 + 2, 0); c.lineTo(x - 1, len - 6); c.lineTo(x - w / 4, 0); c.fill();
  }
  for (let x = 20; x < 400; x += 46 + r() * 30) {
    const h = 30 + r() * 60, w = 16 + r() * 14;
    c.fillStyle = 'rgba(60,48,78,0.85)'; c.beginPath(); c.moveTo(x - w / 2, 600); c.lineTo(x, 470 - h); c.lineTo(x + w / 2, 600); c.fill();
  }
  // A thin underground waterfall catching the light.
  const fall = c.createLinearGradient(0, 40, 0, 420);
  fall.addColorStop(0, 'rgba(140,210,255,0.0)'); fall.addColorStop(0.3, 'rgba(140,210,255,0.35)'); fall.addColorStop(1, 'rgba(140,210,255,0.05)');
  c.fillStyle = fall; c.fillRect(332, 40, 10, 380);
  c.globalAlpha = 0.5;
  // Glowing mushrooms on the ledges.
  for (const [x, y, hue] of [[60, 455, 170], [78, 462, 190], [250, 450, 280], [268, 458, 300], [180, 470, 170]]) {
    const gl = c.createRadialGradient(x, y - 6, 0, x, y - 6, 22);
    gl.addColorStop(0, `hsla(${hue},90%,70%,0.45)`); gl.addColorStop(1, `hsla(${hue},90%,70%,0)`);
    c.fillStyle = gl; c.beginPath(); c.arc(x, y - 6, 22, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#d9d2e9'; c.fillRect(x - 1.5, y - 6, 3, 8);
    c.fillStyle = `hsl(${hue},85%,72%)`; c.beginPath(); c.ellipse(x, y - 6, 7, 4.5, 0, Math.PI, 0); c.fill();
  }
  // Old mine timbers in the gloom.
  c.fillStyle = 'rgba(90,65,45,0.45)';
  c.fillRect(150, 250, 8, 170); c.fillRect(232, 250, 8, 170); c.fillRect(142, 244, 106, 10);
  c.fillStyle = 'rgba(255,200,120,0.6)'; c.beginPath(); c.arc(195, 270, 5, 0, Math.PI * 2); c.fill(); // a lantern
  const lamp = c.createRadialGradient(195, 270, 0, 195, 270, 60);
  lamp.addColorStop(0, 'rgba(255,200,120,0.3)'); lamp.addColorStop(1, 'rgba(255,200,120,0)');
  c.fillStyle = lamp; c.beginPath(); c.arc(195, 270, 60, 0, Math.PI * 2); c.fill();
}

function ruinsMore(c) {
  const r = seeded(127);
  cloud(c, 80, 90, 1, 'rgba(255,240,220,0.65)'); cloud(c, 330, 140, 0.8, 'rgba(255,235,210,0.55)'); cloud(c, 200, 60, 0.6, 'rgba(255,245,230,0.5)');
  // Temple details: steps, a dark doorway, carved bands.
  c.fillStyle = 'rgba(140,90,65,0.35)'; c.fillRect(220, 280, 20, 22);
  c.strokeStyle = 'rgba(120,75,55,0.35)'; c.lineWidth = 1.5;
  for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(170 - k * 22, 312 + k * 22); c.lineTo(290 + k * 22, 312 + k * 22); c.stroke(); }
  for (let k = 0; k < 9; k++) { c.fillStyle = 'rgba(150,100,70,0.3)'; c.fillRect(214, 304 + k * 14, 32, 6); } // the stair up the middle
  c.globalAlpha = 0.35;
  // Fallen column pieces and blocks in the grass.
  for (const [x, y, rot] of [[90, 470, 0.15], [300, 478, -0.2]]) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.fillStyle = 'rgba(165,120,85,0.75)'; c.fillRect(-30, -11, 60, 22);
    c.fillStyle = 'rgba(130,90,60,0.6)'; for (let k = -24; k <= 24; k += 8) c.fillRect(k, -11, 2, 22);
    c.fillStyle = 'rgba(185,140,100,0.8)'; c.beginPath(); c.ellipse(30, 0, 5, 11, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  for (const [x, y] of [[200, 482], [215, 476], [360, 470]]) { c.fillStyle = 'rgba(160,115,80,0.7)'; c.fillRect(x - 9, y - 9, 18, 14); c.fillStyle = 'rgba(120,80,55,0.4)'; c.fillRect(x - 9, y + 2, 18, 3); }
  // Grass tufts and little flowers.
  c.strokeStyle = 'rgba(90,150,70,0.8)'; c.lineWidth = 2;
  for (let i = 0; i < 16; i++) { const x = r() * 400, y = 480 + r() * 15; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + k * 5, y - 10 - r() * 6); c.stroke(); } }
  // Dust in the low sunlight.
  c.fillStyle = 'rgba(255,240,200,0.6)';
  for (let i = 0; i < 26; i++) { c.beginPath(); c.arc(220 + r() * 170, 160 + r() * 200, 0.8 + r() * 1.2, 0, Math.PI * 2); c.fill(); }
}

function desertMore(c) {
  const r = seeded(139);
  cloud(c, 90, 110, 0.7, 'rgba(255,255,255,0.55)'); cloud(c, 230, 70, 0.5, 'rgba(255,255,255,0.45)');
  // A far oasis: palms and a glint of water.
  blob(c, 250, 392, 34, 5, 'rgba(110,190,220,0.7)');
  for (const [x, h, lean] of [[232, 46, -0.15], [262, 38, 0.2]]) {
    c.strokeStyle = 'rgba(120,85,55,0.8)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, 392); c.quadraticCurveTo(x + lean * 20, 392 - h / 2, x + lean * 30, 392 - h); c.stroke();
    c.fillStyle = 'rgba(60,140,80,0.85)';
    for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.55; c.save(); c.translate(x + lean * 30, 392 - h); c.rotate(a); c.beginPath(); c.ellipse(11, 0, 12, 3.2, 0.25, 0, Math.PI * 2); c.fill(); c.restore(); }
  }
  // Ripples on the dunes.
  c.strokeStyle = 'rgba(200,150,90,0.35)'; c.lineWidth = 1.5;
  for (let i = 0; i < 14; i++) { const x = r() * 380, y = 430 + r() * 60; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 15, y - 4, x + 30, y); c.stroke(); }
  c.globalAlpha = 0.45;
  // Rocks and a bleached skull of some old beast (a cartoon one).
  for (const [x, y, s] of [[40, 480, 1], [150, 470, 0.7], [370, 485, 1.2]]) { blob(c, x, y, 14 * s, 8 * s, 'rgba(170,120,80,0.85)'); blob(c, x - 3 * s, y - 3 * s, 7 * s, 3 * s, 'rgba(220,175,120,0.6)'); }
  c.fillStyle = 'rgba(250,240,220,0.9)'; c.beginPath(); c.ellipse(275, 480, 9, 7, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(250,240,220,0.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(268, 476); c.quadraticCurveTo(258, 466, 262, 458); c.moveTo(282, 476); c.quadraticCurveTo(292, 466, 288, 458); c.stroke();
  c.fillStyle = 'rgba(90,60,40,0.7)'; c.beginPath(); c.arc(272, 479, 1.6, 0, Math.PI * 2); c.arc(278, 479, 1.6, 0, Math.PI * 2); c.fill();
}

function snowMore(c) {
  const r = seeded(151);
  cloud(c, 110, 80, 0.9, 'rgba(255,255,255,0.75)'); cloud(c, 310, 120, 0.7, 'rgba(255,255,255,0.65)');
  // A far line of little pines on the slope.
  for (let x = 0; x < 400; x += 12) {
    const y = 445 + Math.sin(x / 40) * 6, h = 14 + r() * 10;
    c.fillStyle = 'rgba(70,110,110,0.6)'; c.beginPath(); c.moveTo(x - 5, y); c.lineTo(x, y - h); c.lineTo(x + 5, y); c.fill();
  }
  c.globalAlpha = 0.55;
  // A small cabin with a warm window and chimney smoke.
  c.fillStyle = 'rgba(120,80,55,0.95)'; c.fillRect(205, 442, 40, 26);
  c.fillStyle = 'rgba(255,255,255,0.95)'; c.beginPath(); c.moveTo(198, 444); c.lineTo(225, 424); c.lineTo(252, 444); c.fill();
  c.fillStyle = 'rgba(255,205,110,0.95)'; c.fillRect(214, 450, 9, 8);
  c.fillStyle = 'rgba(80,55,40,0.9)'; c.fillRect(230, 452, 9, 16); c.fillRect(238, 422, 6, 14);
  c.fillStyle = 'rgba(230,235,245,0.6)'; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(243 + k * 5, 414 - k * 10, 4 + k * 2, 0, Math.PI * 2); c.fill(); }
  // Sparkles on the snow.
  c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 1.2;
  for (let i = 0; i < 18; i++) { const x = r() * 400, y = 470 + r() * 40, s = 2 + r() * 2.5; c.beginPath(); c.moveTo(x - s, y); c.lineTo(x + s, y); c.moveTo(x, y - s); c.lineTo(x, y + s); c.stroke(); }
}

function volcanoMore(c) {
  const r = seeded(163);
  // Jagged black spires on both sides (faint: they are far off, not part of the stage).
  c.globalAlpha = 0.45;
  c.fillStyle = 'rgba(20,12,14,0.9)';
  for (const [x, w, h] of [[10, 40, 160], [50, 30, 110], [350, 44, 180], [390, 30, 120], [300, 26, 90]]) { c.beginPath(); c.moveTo(x - w / 2, 600); c.lineTo(x - w / 6, 470 - h); c.lineTo(x + w / 6, 470 - h + 12); c.lineTo(x + w / 2, 600); c.fill(); }
  c.globalAlpha = 0.35;
  // Glowing cracks on the spires and pools of lava below.
  c.strokeStyle = 'rgba(255,110,40,0.7)'; c.lineWidth = 1.6;
  for (const [x, y] of [[12, 380], [352, 360], [48, 420], [300, 430]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 4, y + 18); c.lineTo(x - 2, y + 34); c.stroke(); }
  for (const [x, y, w] of [[110, 470, 40], [280, 476, 34]]) {
    const pool = c.createRadialGradient(x, y, 0, x, y, w);
    pool.addColorStop(0, 'rgba(255,220,120,0.95)'); pool.addColorStop(0.5, 'rgba(255,120,40,0.85)'); pool.addColorStop(1, 'rgba(160,40,20,0)');
    c.fillStyle = pool; c.beginPath(); c.ellipse(x, y, w, w * 0.25, 0, 0, Math.PI * 2); c.fill();
  }
  // Lightning in the ash cloud.
  c.strokeStyle = 'rgba(255,240,200,0.7)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(300, 40); c.lineTo(288, 70); c.lineTo(300, 74); c.lineTo(284, 110); c.stroke();
  // Falling rocks flung from the crater.
  for (let i = 0; i < 6; i++) blob(c, 140 + r() * 120, 130 + r() * 80, 3 + r() * 2, 3 + r() * 2, 'rgba(40,25,25,0.9)');
}

const PAINT = {
  forest: (c) => { paintForest(c); forestMore(c); c.globalAlpha = 1; },
  cave: (c) => { paintCave(c); caveMore(c); c.globalAlpha = 1; },
  ruins: (c) => { paintRuins(c); ruinsMore(c); c.globalAlpha = 1; },
  desert: (c) => { paintDesert(c); desertMore(c); c.globalAlpha = 1; },
  snow: (c) => { paintSnow(c); snowMore(c); c.globalAlpha = 1; },
  volcano: (c) => { paintVolcano(c); volcanoMore(c); c.globalAlpha = 1; },
};

/** A little motion over the scenery: snow falling on the mountain, embers rising on the volcano. */
function sceneryMotion(ctx, g, t) {
  const BW = g.w * CELL, BH = g.vh * CELL;
  if (g.theme === 'forest') {
    // Leaves drifting down, and two butterflies.
    for (let i = 0; i < 9; i++) {
      const speed = 14 + (i % 3) * 5, y = (i * 83 + t * speed) % BH, x = (i * 151.3) % BW + Math.sin(t * 1.2 + i) * 18;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2 + i) * 0.9);
      ctx.fillStyle = ['rgba(120,190,90,0.55)', 'rgba(230,180,70,0.55)', 'rgba(90,160,80,0.55)'][i % 3];
      ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    for (let i = 0; i < 2; i++) {
      const x = ((t * 22 + i * 230) % (BW + 60)) - 30, y = BH * 0.55 + Math.sin(t * 1.7 + i * 2) * 30 - i * 40;
      const flap = Math.abs(Math.sin(t * 12 + i)) * 0.8 + 0.2;
      ctx.fillStyle = i ? 'rgba(255,170,210,0.65)' : 'rgba(255,220,90,0.65)';
      ctx.beginPath(); ctx.ellipse(x - 4 * flap, y, 4 * flap, 5, -0.4, 0, Math.PI * 2); ctx.ellipse(x + 4 * flap, y, 4 * flap, 5, 0.4, 0, Math.PI * 2); ctx.fill();
    }
  } else if (g.theme === 'cave') { // crystals breathing, and drips from the stalactites
    ctx.fillStyle = `rgba(150,220,255,${0.04 + Math.sin(t * 1.5) * 0.03})`;
    ctx.fillRect(0, 0, BW, BH);
    for (let i = 0; i < 5; i++) {
      const period = 2.2 + i * 0.4, k = ((t + i * 0.9) % period) / period, x = ((i * 97 + 40) % BW);
      ctx.fillStyle = `rgba(170,220,255,${0.8 - k * 0.5})`;
      ctx.beginPath(); ctx.ellipse(x, 40 + k * k * BH * 0.8, 1.6, 3, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else if (g.theme === 'ruins') { // birds crossing the evening sky
    ctx.strokeStyle = 'rgba(90,60,50,0.6)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const x = ((t * (16 + i * 4) + i * 170) % (BW + 80)) - 40, y = 70 + i * 34 + Math.sin(t + i) * 6, f = Math.sin(t * 7 + i) * 4;
      ctx.beginPath(); ctx.moveTo(x - 8, y - f); ctx.quadraticCurveTo(x - 4, y - 5, x, y); ctx.quadraticCurveTo(x + 4, y - 5, x + 8, y - f); ctx.stroke();
    }
  } else if (g.theme === 'desert') { // a tumbleweed rolling by
    const x = ((t * 40) % (BW + 120)) - 60, y = BH * 0.78 - Math.abs(Math.sin(t * 3)) * 10;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 3);
    ctx.strokeStyle = 'rgba(150,110,60,0.8)'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.ellipse(0, 0, 11, 6, (k * Math.PI) / 6, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  } else if (g.theme === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 26; i++) {
      const sx = (i * 97.3) % BW, speed = 18 + (i % 5) * 6;
      const y = (i * 53 + t * speed) % BH, x = sx + Math.sin(t * 0.8 + i) * 12;
      ctx.beginPath(); ctx.arc(x, y, 1.6 + (i % 3) * 0.8, 0, Math.PI * 2); ctx.fill();
    }
  } else if (g.theme === 'volcano') {
    for (let i = 0; i < 18; i++) {
      const speed = 22 + (i % 4) * 8, y = BH - ((i * 71 + t * speed) % BH), x = (i * 131.7) % BW + Math.sin(t * 1.3 + i) * 8;
      ctx.fillStyle = `rgba(255,${140 + (i % 4) * 25},60,${0.35 + (y / BH) * 0.5})`;
      ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 3) * 0.7, 0, Math.PI * 2); ctx.fill();
    }
    // Smoke puffing up out of the crater.
    for (let i = 0; i < 5; i++) {
      const k = ((t * 0.18 + i / 5) % 1), x = BW * 0.5 + Math.sin(t * 0.7 + i) * 14 + k * 30, y = BH * 0.38 - k * BH * 0.35;
      ctx.fillStyle = `rgba(80,60,65,${0.35 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(x, y, 14 + k * 30, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = `rgba(255,90,30,${0.05 + Math.sin(t * 2) * 0.03})`; // the heat pulsing
    ctx.fillRect(0, 0, BW, BH);
  }
}
const sceneryCache = {};
/** The scenery behind the board, painted once (at double resolution, for sharp phone screens). */
export function scenery(theme) {
  if (REAL) return realBackground(theme);
  if (!sceneryCache[theme] && typeof document !== 'undefined') {
    const cv = document.createElement('canvas');
    cv.width = 960; cv.height = 1440; // painted in 400 × 600 units (a 2 : 3 board), sharp up to 2.4× that
    const c = cv.getContext('2d');
    c.scale(2.4, 2.4);
    PAINT[theme](c);
    sceneryCache[theme] = cv;
  }
  return sceneryCache[theme];
}

/** The whole board. `fx` holds short-lived effects (booms, sparkles) from main.js. */
export function drawBoard(ctx, g, t, colors, fx) {
  // Scenery (the place on Poko's journey), or plain sky.
  const bg = g.theme && PAINT[g.theme] ? scenery(g.theme) : null;
  if (bg) {
    colors = { ...colors, ...THEME_COLORS[g.theme] };
    ctx.drawImage(bg, 0, 0, g.w * CELL, g.vh * CELL);
    // A soft veil over the scenery so the blocks, rock and Poko stand out in front of it.
    ctx.fillStyle = HAZE[g.theme];
    if (REAL) ctx.globalAlpha = 0.55; // the realistic scenery is already soft and hazy
    ctx.fillRect(0, 0, g.w * CELL, g.vh * CELL);
    ctx.globalAlpha = 1;
    sceneryMotion(ctx, g, t);
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, g.vh * CELL);
    sky.addColorStop(0, colors.skyTop);
    sky.addColorStop(1, colors.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.w * CELL, g.vh * CELL);
  }

  // The view glides after Poko on stages taller than the screen.
  const target = viewTop(g);
  if (g.camY === undefined || Math.abs(g.camY - target) > 8) g.camY = target;
  g.camY += (target - g.camY) * 0.08;
  if (Math.abs(target - g.camY) < 0.01) g.camY = target;
  const cam = g.camY;
  ctx.save();
  ctx.translate(0, -cam * CELL);

  // The rock: in the realistic look, one picture of the whole stage's rock (painted once).
  const real = REAL && g.theme && typeof document !== 'undefined';
  if (real) {
    ctx.drawImage(realTerrain(g), 0, 0, g.w * CELL, g.h * CELL);
  }
  for (let y = Math.max(0, Math.floor(cam)); y < Math.min(g.h, Math.ceil(cam) + g.vh + 1); y++) {
    for (let x = 0; x < g.w; x++) {
      const c = at(g, x, y);
      if (c === ROCK) { if (!real) drawRock(ctx, g, x, y, colors); }
      else if (c === BLOCK) drawBlock(ctx, x * CELL, y * CELL, BLOCK_COLORS[g.colors[y * g.w + x]]);
    }
  }
  if (real) drawRealDoor(ctx, g.exit.x, g.exit.y, t); else drawDoor(ctx, g.exit.x, g.exit.y, t);
  for (const s of g.stars) {
    if (s.got) continue;
    const pulse = 1 + Math.sin(t * 4 + s.x) * 0.08;
    const sx = s.x * CELL + CELL / 2, sy = s.y * CELL + CELL / 2 + Math.sin(t * 3 + s.y) * 2;
    if (real) drawGoldStar(ctx, sx, sy, 13 * pulse, t + s.x); else drawStar(ctx, sx, sy, 13 * pulse);
  }

  // The falling piece and its landing spot.
  if (g.piece && g.status === 'play') {
    const d = dropDistance(g);
    const cells = pieceCells(g.piece);
    const bomb = g.piece.kind === 'bomb';
    const color = BLOCK_COLORS[PIECE_COLOR[g.piece.kind]];
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 2;
    const onPoko = landsOnWalker(g); // the landing spot turns red when it would squash Poko
    ctx.strokeStyle = onPoko ? '#ff4d4d' : colors.ghost;
    ctx.lineWidth = onPoko ? 3 : 2;
    for (const [x, y] of cells) {
      if (y + d < 0) continue;
      roundRect(ctx, x * CELL + 3, (y + d) * CELL + 3, CELL - 6, CELL - 6, 8);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    if (bomb) { // show what it will clear
      const [bx, by] = cells[0];
      ctx.fillStyle = 'rgba(255,80,80,0.16)';
      ctx.fillRect((bx - 1) * CELL, (by + d) * CELL, CELL * 3, CELL * 3);
    }
    for (const [x, y] of cells) {
      if (bomb) drawBomb(ctx, x * CELL, y * CELL, t);
      else drawBlock(ctx, x * CELL, y * CELL, color);
    }
  }

  // Poko, part-way through his move.
  const w = g.walker;
  const p = g.time < START_DELAY ? 1 : Math.min(1, g.walkT / walkerInterval(g));
  let wx = w.fromX + (w.x - w.fromX) * p, wy = w.fromY + (w.y - w.fromY) * p;
  if (w.act === 'climb') wy = w.fromY - Math.min(1, p * 1.6); // up first, then across
  if (w.act === 'climb') wx = w.fromX + (w.x - w.fromX) * Math.max(0, (p - 0.35) / 0.65);
  const danger = waterTop(g) < w.y + 2.2;
  let mood = g.status === 'won' ? 'won' : g.status === 'lost' ? 'lost' : g.time < START_DELAY || w.act === 'turn' ? 'idle' : danger ? 'scared' : w.act;
  if (g.status === 'play' && w.act === 'fall') mood = 'fall';
  // A block about to come down on him: he panics (the same test as the red landing spot).
  const tripped = g.status === 'play' && w.act === 'trip' && g.tripT > 0;
  const gap = w.act === 'fall' || tripped ? -1 : crushGap(g);
  const overhead = gap >= 0;
  const close = overhead && gap <= 2; // nearly on him
  if (overhead) mood = close ? 'panic2' : 'panic';
  const hop = g.status === 'won' ? Math.abs(Math.sin(t * 9)) * 10 : 0;
  const px = wx * CELL + CELL / 2, py = (wy + 1) * CELL;
  if (g.reason === 'crushed') {
    // Flattened under the block, with stars spinning round.
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1.4, 0.32);
    ctx.translate(-px, -py);
    drawPoko(ctx, px, py, w.dir, t, 'lost', CELL * 1.15);
    ctx.restore();
    for (let k = 0; k < 3; k++) {
      const a = t * 5 + (k * Math.PI * 2) / 3;
      drawStar(ctx, px + Math.cos(a) * 15, py - 13 + Math.sin(a) * 4, 4.5);
    }
  } else {
    if (tripped) drawTripped(ctx, px, py, w.dir, t, TRIP - g.tripT);
    else {
      if (REAL && w.act !== 'fall') { // a soft shadow at his feet grounds him in the scene
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.beginPath(); ctx.ellipse(px, py - 1, 13, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      }
      drawPoko(ctx, px, py - hop, w.dir, t, mood, CELL * 1.15);
    }
  }
  if (overhead) { // a red "!" bubble popping over his head ("!!", bigger and faster when close)
    const r = close ? 15 : 12;
    const bx = wx * CELL + CELL / 2 + 17, byy = wy * CELL - 10;
    const pop = 1 + Math.abs(Math.sin(t * (close ? 16 : 10))) * (close ? 0.25 : 0.15);
    ctx.save();
    ctx.translate(bx + (close ? Math.sin(t * 50) * 1.5 : 0), byy);
    ctx.scale(pop, pop);
    ctx.fillStyle = close ? '#ff2d2d' : '#ff5c5c';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.moveTo(-r * 0.55, r * 0.65);
    ctx.lineTo(-r * 1.0, r * 1.3);
    ctx.lineTo(-r * 0.1, r * 0.9);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${close ? 19 : 17}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(close ? '!!' : '!', 0, 1);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
    // Little shock lines either side of his head.
    ctx.strokeStyle = '#ff4d4d';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    const hx = wx * CELL + CELL / 2, hy = wy * CELL + 4;
    const wob = Math.sin(t * 30) * 1.5;
    for (const k of [-1, 1]) {
      for (const [dy, len] of [[-6, 7], [2, 6]]) {
        ctx.beginPath();
        ctx.moveTo(hx + k * 16, hy + dy + wob);
        ctx.lineTo(hx + k * (16 + len), hy + dy - 3 + wob);
        ctx.stroke();
      }
    }
  } else if (g.time < START_DELAY && g.status === 'play') { // "♪" before he sets off
    ctx.fillStyle = colors.text;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('♪', wx * CELL + CELL / 2 + 14, wy * CELL - 2 + Math.sin(t * 6) * 3);
  }

  drawMagma(ctx, g, t, danger, cam);

  for (const e of fx) {
    const a = Math.max(0, 1 - e.age / e.life);
    ctx.globalAlpha = a;
    if (e.type === 'boom') {
      ctx.fillStyle = '#ffd43b';
      ctx.beginPath();
      ctx.arc(e.x * CELL + CELL / 2, e.y * CELL + CELL / 2, CELL * (0.6 + e.age * 4), 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'spark') {
      drawStar(ctx, e.x, e.y, 6, e.color || '#ffd43b');
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  drawMagmaGauge(ctx, g, t, danger, cam);
  if (g.exit.y < cam - 0.5) drawDoorAbove(ctx, g, t);
}

/** Off the top of the view: a small arrow and door so you know where Poko is heading. */
function drawDoorAbove(ctx, g, t) {
  const x = g.exit.x * CELL + CELL / 2, y = 14 + Math.sin(t * 5) * 3;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, x - 17, y - 10, 34, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x - 7, y + 2);
  ctx.lineTo(x + 7, y + 2);
  ctx.fill();
  ctx.fillStyle = '#c47a3a';
  roundRect(ctx, x - 5, y + 4, 10, 13, 3);
  ctx.fill();
}

/**
 * Magma rising from the bottom: a glowing, bubbling surface over a hot gradient, a heat haze
 * above it, a gauge on the left edge showing how close it is to Poko, and a red pulse round
 * the board when it is nearly at his feet.
 */
function drawMagma(ctx, g, t, danger, cam) {
  const BW = g.w * CELL, BH = g.h * CELL;
  const top = waterTop(g) * CELL;
  const surf = (x) => top + Math.sin(x / 22 + t * 2.4) * 3 + Math.sin(x / 9 - t * 3.1) * 1.2;
  if (top < BH) {
    // Heat glow above the surface.
    const haze = ctx.createLinearGradient(0, top - CELL * 1.2, 0, top);
    haze.addColorStop(0, 'rgba(255,120,30,0)');
    haze.addColorStop(1, `rgba(255,120,30,${0.28 + Math.sin(t * 4) * 0.06})`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, top - CELL * 1.2, BW, CELL * 1.2);
    // The magma itself.
    const body = ctx.createLinearGradient(0, top, 0, BH);
    body.addColorStop(0, 'rgba(255,190,40,0.95)');
    body.addColorStop(0.12, 'rgba(255,100,20,0.92)');
    body.addColorStop(1, 'rgba(170,25,10,0.95)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, BH);
    for (let x = 0; x <= BW; x += 8) ctx.lineTo(x, surf(x));
    ctx.lineTo(BW, BH);
    ctx.fill();
    if (REAL && typeof document !== 'undefined') {
      // Molten rock: dark crust and glowing cracks, drifting slowly, brightest at the surface.
      const pat = ctx.createPattern(realLava(), 'repeat');
      if (pat && pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix().translate((t * 9) % 256, (top * 0.5) % 128));
      ctx.save();
      ctx.beginPath(); ctx.moveTo(0, BH);
      for (let x = 0; x <= BW; x += 8) ctx.lineTo(x, surf(x));
      ctx.lineTo(BW, BH); ctx.clip();
      ctx.globalAlpha = 0.85; ctx.fillStyle = pat; ctx.fillRect(0, top - 6, BW, BH - top + 6);
      ctx.globalAlpha = 1;
      const hot = ctx.createLinearGradient(0, top, 0, top + CELL * 1.5);
      hot.addColorStop(0, 'rgba(255,200,80,0.55)'); hot.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.fillStyle = hot; ctx.fillRect(0, top - 6, BW, CELL * 1.6);
      ctx.restore();
    }
    // Dark crust patches drifting across.
    ctx.fillStyle = 'rgba(90,20,10,0.35)';
    for (let k = 0; k < 4; k++) {
      const cx = ((k * 113 + t * 12) % (BW + 60)) - 30;
      const cy = top + 10 + ((k * 37) % 30);
      if (cy < BH) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, 14, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Bubbles that swell and pop on the surface.
    for (let k = 0; k < 6; k++) {
      const period = 1.3 + (k % 3) * 0.4;
      const ph = ((t + k * 0.53) % period) / period;
      const bx = ((k * 67 + Math.floor((t + k * 0.53) / period) * 41) % (BW - 20)) + 10;
      const by = surf(bx);
      ctx.fillStyle = ph < 0.8 ? 'rgba(255,215,90,0.95)' : 'rgba(255,240,180,0.7)';
      ctx.beginPath();
      if (ph < 0.8) ctx.arc(bx, by, 2 + ph * 5, Math.PI, 0); // swelling dome
      else {
        for (const d of [-1, 1]) { // popped: two little drops flying off
          const dx = bx + d * (4 + (ph - 0.8) * 30), dy = by - 4 - (ph - 0.8) * 20;
          ctx.moveTo(dx + 1.8, dy);
          ctx.arc(dx, dy, 1.8, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    }
    // Bright glowing rim.
    ctx.strokeStyle = '#fff3b0';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ffb000';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let x = 0; x <= BW; x += 8) ctx.lineTo(x, surf(x));
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

}

/** Gauge on the left edge of the screen: magma level against Poko's middle (where it gets him). */
function drawMagmaGauge(ctx, g, t, danger, cam) {
  const BW = g.w * CELL, BH = g.vh * CELL;
  const top = (waterTop(g) - cam) * CELL;
  const limit = (g.walker.y + 0.5 - cam) * CELL;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, 6, BH);
  ctx.fillStyle = '#ff6a14';
  if (top < BH) ctx.fillRect(0, Math.max(0, top), 6, BH - Math.max(0, top));
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); // a little arrow at Poko's level
  ctx.moveTo(6, limit);
  ctx.lineTo(13, limit - 5);
  ctx.lineTo(13, limit + 5);
  ctx.fill();

  // Red pulse round the edges when it is close.
  if (danger && g.status === 'play') {
    ctx.strokeStyle = `rgba(255,40,30,${0.25 + 0.25 * Math.sin(t * 9)})`;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, BW - 10, BH - 10);
  }
}
