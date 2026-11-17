// Drawing the stage: rock, blocks, the falling piece and where it will land, Poko, the door,
// stars and the water. Everything is in board units: one cell is CELL wide.
import { W, H, ROCK, BLOCK, at, pieceCells, dropDistance, landsOnWalker, crushGap, walkerInterval, waterTop, viewTop, START_DELAY, SHAPES, PIECE_COLOR, TRIP } from './game.js';

export const CELL = 40;
export const BLOCK_COLORS = ['#9aa3b5', '#ff6b8b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#748ffc', '#b197fc', '#f783ac', '#63e6be', '#ff8787'];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

export function drawBlock(ctx, x, y, color, size = CELL, alpha = 1) {
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

// ----- Scenery: Poko explores a forest, then a cave, then old ruins, five stages each -----

export const THEMES = ['forest', 'cave', 'ruins'];
/** The scenery for stage n (hand-made stages 1–5 are the forest), or for a weekly challenge. */
export const themeOf = (n, week) => (week !== undefined ? THEMES[week % 3] : THEMES[Math.floor((n - 1) / 5) % 3]);

// Each place has its own rock and edge colours (the edge is grass in the forest, a pale stone
// lip in the cave, moss on the ruins' sandstone).
const THEME_COLORS = {
  forest: { rock: '#7a5a40', rockDot: '#5e4430', grass: '#5cbf4a' },
  cave: { rock: '#5d566b', rockDot: '#463f56', grass: '#a29bb8', ghost: 'rgba(255,255,255,0.6)', text: '#eef3ff' },
  ruins: { rock: '#b48f63', rockDot: '#8f6e48', grass: '#6aa84f' },
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

const PAINT = { forest: paintForest, cave: paintCave, ruins: paintRuins };
const sceneryCache = {};
/** The scenery behind the board, painted once (at double resolution, for sharp phone screens). */
export function scenery(theme) {
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
  // Scenery (forest, cave or ruins), or plain sky.
  const bg = g.theme && PAINT[g.theme] ? scenery(g.theme) : null;
  if (bg) {
    colors = { ...colors, ...THEME_COLORS[g.theme] };
    ctx.drawImage(bg, 0, 0, g.w * CELL, g.vh * CELL);
    if (g.theme === 'cave') { // crystals breathing
      ctx.fillStyle = `rgba(150,220,255,${0.04 + Math.sin(t * 1.5) * 0.03})`;
      ctx.fillRect(0, 0, g.w * CELL, g.vh * CELL);
    }
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

  for (let y = Math.max(0, Math.floor(cam)); y < Math.min(g.h, Math.ceil(cam) + g.vh + 1); y++) {
    for (let x = 0; x < g.w; x++) {
      const c = at(g, x, y);
      if (c === ROCK) drawRock(ctx, g, x, y, colors);
      else if (c === BLOCK) drawBlock(ctx, x * CELL, y * CELL, BLOCK_COLORS[g.colors[y * g.w + x]]);
    }
  }
  drawDoor(ctx, g.exit.x, g.exit.y, t);
  for (const s of g.stars) {
    if (s.got) continue;
    const pulse = 1 + Math.sin(t * 4 + s.x) * 0.08;
    drawStar(ctx, s.x * CELL + CELL / 2, s.y * CELL + CELL / 2 + Math.sin(t * 3 + s.y) * 2, 13 * pulse);
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
    else drawPoko(ctx, px, py - hop, w.dir, t, mood, CELL * 1.15);
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
