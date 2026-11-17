// The realistic look: textures made from noise, painted once and reused.
//
//   realBackground(theme)   the far scenery for a place (sky, clouds, hills, its landmarks)
//   realTerrain(g)          the stage's rock with its soil, strata, grass/snow/sand edges and
//                           shading - rock never changes during a stage, so it is painted once
//   realCrate(color)        a falling block: a wooden crate stained in the piece's colour
//   realStone()             a stage's own breakable block: cracked stone bricks
//   realLava()              a tile of molten rock, scrolled under the surface
//
// Everything is painted into off-screen canvases (cached), so a frame only copies pictures.
import { ROCK, at } from './game.js';

const CELL = 40;
const TEX = 1.5; // texture pixels per board unit (sharp enough on phones, quick to paint)

// ----- Noise -----
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
function makeNoise(seed) {
  const r = rng(seed), N = 256, p = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) p[i] = r();
  const sm = (t) => t * t * (3 - 2 * t);
  const v = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const i0 = ((yi & 255) << 8), i1 = (((yi + 1) & 255) << 8), x0 = xi & 255, x1 = (xi + 1) & 255;
    const a = p[i0 + x0], b = p[i0 + x1], c = p[i1 + x0], d = p[i1 + x1];
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y, oct = 3) => { let s = 0, amp = 0.5, f = 1, n = 0; for (let o = 0; o < oct; o++) { s += v(x * f, y * f) * amp; n += amp; amp *= 0.5; f *= 2.03; } return s / n; };
}
const N1 = makeNoise(7), N2 = makeNoise(19), N3 = makeNoise(41);
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// ----- Materials for each place -----
// rock: two colours the soil/stone varies between; speck: flecks of a third; lip: what covers
// open ground (grass, snow, sand...), with its colour range; strata: how banded it is.
const MATERIAL = {
  forest: { rock: ['#5c4130', '#8a6446'], speck: '#a39a8c', lip: 'grass', lipCol: ['#3f7f2e', '#7cc04f'], strata: 0.6 },
  cave: { rock: ['#3e3a4c', '#6a6480'], speck: '#9fd4ff', lip: 'stone', lipCol: ['#8c87a0', '#b9b4cc'], strata: 0.3 },
  ruins: { rock: ['#9a7650', '#c9a273'], speck: '#e8d2a8', lip: 'moss', lipCol: ['#55823a', '#8fb35a'], strata: 0.2, bricks: true },
  desert: { rock: ['#7e4a24', '#b87a44'], speck: '#e2b884', lip: 'sand', lipCol: ['#d9ae6a', '#f0cf92'], strata: 0.9 },
  snow: { rock: ['#3e4a62', '#6d7c98'], speck: '#d8e4f5', lip: 'snow', lipCol: ['#dfe9f7', '#ffffff'], strata: 0.4 },
  volcano: { rock: ['#2a2224', '#4e4144'], speck: '#ff7a2a', lip: 'ember', lipCol: ['#7a2c14', '#ff8a2e'], strata: 0.3, glowCracks: true },
};

/** The stage's rock, painted once: a canvas of the whole stage (g.w × g.h cells). */
const terrainCache = new Map();
export function realTerrain(g) {
  const key = `${g.theme}|${g.w}|${g.h}|${Array.from(g.grid, (c) => (c === ROCK ? 1 : 0)).join('')}`;
  if (terrainCache.has(key)) return terrainCache.get(key);
  const m = MATERIAL[g.theme] || MATERIAL.forest;
  const cs = Math.round(CELL * TEX), W = g.w * cs, H = g.h * cs;
  const cv = canvas(W, H), ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H), d = img.data;
  const rockAt = (cx, cy) => cx < 0 || cx >= g.w || cy >= g.h || (cy >= 0 && at(g, cx, cy) === ROCK);
  const c0 = hex(m.rock[0]), c1 = hex(m.rock[1]), sp = hex(m.speck), l0 = hex(m.lipCol[0]), l1 = hex(m.lipCol[1]);
  for (let cy = 0; cy < g.h; cy++) for (let cx = 0; cx < g.w; cx++) {
    if (!rockAt(cx, cy)) continue;
    const open = !rockAt(cx, cy - 1), openL = !rockAt(cx - 1, cy), openR = !rockAt(cx + 1, cy), openB = cy + 1 < g.h && !rockAt(cx, cy + 1);
    for (let py = 0; py < cs; py++) for (let px = 0; px < cs; px++) {
      const x = cx * cs + px, y = cy * cs + py, wx = x / TEX, wy = y / TEX; // board units
      const strata = (Math.sin(wy / 9 + N1(wx / 60, wy / 60) * 5) * 0.5 + 0.5) * m.strata;
      const grain = N1(wx / 5, wy / 5, 3);
      let t = clamp(strata * 0.6 + grain * 0.7 - 0.15);
      let r = mix(c0[0], c1[0], t), gg = mix(c0[1], c1[1], t), b = mix(c0[2], c1[2], t);
      if (m.bricks) { // dressed stone: courses of blocks with mortar lines
        const row = Math.floor(wy / 13), off = (row % 2) * 11, bx = (wx + off) % 22, by = wy % 13;
        if (bx < 1.2 || by < 1.2) { r *= 0.62; gg *= 0.6; b *= 0.58; }
        else { const k = 0.9 + N2(Math.floor((wx + off) / 22) * 3.1, row * 7.7) * 0.2; r *= k; gg *= k; b *= k; }
      }
      const peb = N2(wx / 7, wy / 7, 2);
      if (peb > 0.74) { const s = (peb - 0.74) / 0.26; r = mix(r, sp[0], s * 0.8); gg = mix(gg, sp[1], s * 0.8); b = mix(b, sp[2], s * 0.8); }
      if (m.glowCracks) { const c = Math.pow(1 - Math.abs(N3(wx / 26, wy / 26, 3) - 0.5) * 2, 34); r = mix(r, 255, c); gg = mix(gg, 110, c); b = mix(b, 30, c); }
      // Light from the upper left; darker toward open sides and the underside.
      const lx = px / cs, ly = py / cs;
      let k = 1;
      if (openL) k *= 0.78 + lx * 0.22;
      if (openR) k *= 0.82 + (1 - lx) * 0.18;
      if (openB) k *= 0.7 + (1 - ly) * 0.3;
      if (!open) k *= 0.95;
      r *= k; gg *= k; b *= k;
      // The covering on open ground: grass blades, snow, sand, moss, embers.
      if (open) {
        const depth = py / TEX; // board units below the top
        const edge = m.lip === 'grass' || m.lip === 'moss' ? 4 + N3(wx / 1.3, 0.5, 2) * 6 : m.lip === 'snow' ? 6 + N3(wx / 8, 0.5, 2) * 4 : 3 + N3(wx / 6, 0.5, 2) * 3;
        if (depth < edge) {
          const v = N1(wx / 1.6, wy / 1.6, 2), shade = 0.75 + (1 - depth / edge) * 0.35;
          r = mix(l0[0], l1[0], v) * shade; gg = mix(l0[1], l1[1], v) * shade; b = mix(l0[2], l1[2], v) * shade;
          if (m.lip === 'ember') { const hot = clamp(1 - depth / edge); r = mix(r, 255, hot * 0.5); gg = mix(gg, 140, hot * 0.4); }
        } else if (depth < edge + 3) { r *= 0.72; gg *= 0.72; b *= 0.72; } // its shadow on the soil
      }
      const i = (y * W + x) * 4;
      d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
    }
    // Blades of grass standing up over the top edge (drawn after, into the cell above).
  }
  ctx.putImageData(img, 0, 0);
  if (m.lip === 'grass' || m.lip === 'moss') {
    const r = rng(17);
    for (let cy = 0; cy < g.h; cy++) for (let cx = 0; cx < g.w; cx++) {
      if (!rockAt(cx, cy) || rockAt(cx, cy - 1)) continue;
      for (let k = 0; k < 9; k++) {
        const x = (cx + r()) * cs, y = cy * cs + 2, h = (2 + r() * 5) * TEX;
        ctx.strokeStyle = `rgba(${60 + r() * 50},${120 + r() * 60},${40 + r() * 30},0.9)`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (r() - 0.5) * 4, y - h / 2, x + (r() - 0.5) * 6, y - h); ctx.stroke();
      }
    }
  } else if (m.lip === 'snow') {
    for (let cy = 0; cy < g.h; cy++) for (let cx = 0; cx < g.w; cx++) {
      if (!rockAt(cx, cy) || rockAt(cx, cy - 1)) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath(); ctx.ellipse((cx + 0.5) * cs, cy * cs + 2, cs * 0.55, 3 * TEX, 0, Math.PI, 0); ctx.fill();
    }
  }
  if (terrainCache.size > 12) terrainCache.delete(terrainCache.keys().next().value);
  terrainCache.set(key, cv);
  return cv;
}

/** A crate stained in a piece's colour (the colour stays strong, so pieces are easy to tell apart). */
const crateCache = new Map();
export function realCrate(color) {
  if (crateCache.has(color)) return crateCache.get(color);
  const S = 64, cv = canvas(S, S), ctx = cv.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
  const tint = hex(color), seed = tint[0] * 3 + tint[1] * 5 + tint[2];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const lx = x / S, ly = y / S;
    const grain = Math.sin((ly * 9 + N1(x / 14 + seed, y / 3, 3) * 2.2) * Math.PI) * 0.5 + 0.5;
    let k = 0.86 + grain * 0.14 + (N2(x / 3 + seed, y / 9) - 0.5) * 0.1;
    const edge = Math.min(lx, ly, 1 - lx, 1 - ly);
    if (edge < 0.1) k *= 0.62; // the frame
    else if (Math.abs(ly - 0.5) < 0.02 || Math.abs(ly - 0.3) < 0.015 || Math.abs(ly - 0.7) < 0.015) k *= 0.72; // planks
    k *= 1 + (0.5 - ly) * 0.3 + (0.5 - lx) * 0.12; // light from above left
    let r = (tint[0] * 0.82 + 120 * 0.18) * k, g = (tint[1] * 0.82 + 82 * 0.18) * k, b = (tint[2] * 0.82 + 48 * 0.18) * k;
    if (edge < 0.1 && (Math.abs(lx - ly) < 0.1 || Math.abs(lx + ly - 1) < 0.1)) { r = 150; g = 155; b = 165; } // metal corners
    if (edge < 0.035) { r *= 0.5; g *= 0.5; b *= 0.5; }
    const i = (y * S + x) * 4;
    d[i] = clamp(r, 0, 255); d[i + 1] = clamp(g, 0, 255); d[i + 2] = clamp(b, 0, 255); d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = 'rgba(40,40,45,0.85)';
  for (const [x, y] of [[8, 8], [56, 8], [8, 56], [56, 56]]) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(6, 6, S - 12, 3); // a catch of light on the top edge
  crateCache.set(color, cv);
  return cv;
}

/** A stage's own breakable block: grey stone bricks with cracks (a bomb clears it). */
let stoneTex = null;
export function realStone() {
  if (stoneTex) return stoneTex;
  const S = 64, cv = canvas(S, S), ctx = cv.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = N1(x / 6, y / 6, 3), crack = Math.pow(1 - Math.abs(N3(x / 16 + 5, y / 16, 3) - 0.5) * 2, 14);
    const row = Math.floor(y / 21.3), mortar = (y % 21.3) < 1.6 || ((x + (row % 2) * 16) % 32) < 1.6;
    let v = 120 + n * 70 - crack * 90;
    if (mortar) v *= 0.55;
    v *= 1 + (0.5 - y / S) * 0.25;
    const i = (y * S + x) * 4; d[i] = v * 0.95; d[i + 1] = v * 0.97; d[i + 2] = v * 1.05; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, S - 2, S - 2);
  return (stoneTex = cv);
}

/** A tile of molten rock: dark crust with bright cracks. */
let lavaTex = null;
export function realLava() {
  if (lavaTex) return lavaTex;
  const W = 256, H = 128, cv = canvas(W, H), ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  // Tileable: blend the noise with itself shifted by the tile size.
  const tile = (f, x, y) => {
    const a = f(x, y), b = f(x - W, y), c = f(x, y - H), e = f(x - W, y - H), u = x / W, v = y / H;
    return mix(mix(a, b, u), mix(c, e, u), v);
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = tile((a, b) => N2(a / 40, b / 40, 4), x, y);
    const crack = Math.pow(1 - Math.abs(tile((a, b) => N3(a / 32, b / 32, 3), x, y) - 0.5) * 2, 6);
    const heat = clamp(crack * 1.2 + (t - 0.5) * 0.6 + 0.12);
    const i = (y * W + x) * 4;
    d[i] = 60 + heat * 195; d[i + 1] = 12 + Math.pow(heat, 1.8) * 180; d[i + 2] = 6 + Math.pow(heat, 4) * 80; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return (lavaTex = cv);
}

// ----- The far scenery for each place -----
// sky: [top, horizon]; ridges: far to near, each { base, amp, scale, color, haze, cap } (cap:
// snow on the peaks); clouds: how many; then a few landmarks drawn over it.
const SCENES = {
  forest: { sky: ['#4f8fd6', '#d9ecf2'], clouds: 0.55, sun: [0.78, 0.12, '#fff3c8'], ridges: [
    { base: 0.42, amp: 0.2, scale: 260, color: '#7b8fae', haze: 0.55 },
    { base: 0.52, amp: 0.14, scale: 170, color: '#4f6e72', haze: 0.4 },
    { base: 0.62, amp: 0.06, scale: 24, color: '#2f5a3a', haze: 0.2, trees: true }] },
  cave: { sky: ['#0d0a14', '#2b2236'], clouds: 0, ridges: [
    { base: 0.25, amp: 0.25, scale: 90, color: '#2c2538', haze: 0.2, ceiling: true },
    { base: 0.62, amp: 0.12, scale: 70, color: '#241e2e', haze: 0.15 }] },
  ruins: { sky: ['#e58a5a', '#ffe1a8'], clouds: 0.35, sun: [0.7, 0.35, '#fff1c4'], ridges: [
    { base: 0.5, amp: 0.1, scale: 220, color: '#b48464', haze: 0.55 },
    { base: 0.6, amp: 0.05, scale: 60, color: '#8a6a4e', haze: 0.35 }] },
  desert: { sky: ['#3f8fd8', '#f6e2b8'], clouds: 0.2, sun: [0.8, 0.12, '#ffffff'], ridges: [
    { base: 0.5, amp: 0.12, scale: 160, color: '#d6a27a', haze: 0.62, mesa: true },
    { base: 0.62, amp: 0.05, scale: 120, color: '#f0cf9c', haze: 0.45, dune: true }] },
  snow: { sky: ['#5b8fd0', '#e9f2fb'], clouds: 0.5, sun: [0.25, 0.1, '#ffffff'], ridges: [
    { base: 0.38, amp: 0.24, scale: 200, color: '#8ea3c4', haze: 0.45, cap: 0.6 },
    { base: 0.5, amp: 0.16, scale: 130, color: '#5f7598', haze: 0.3, cap: 0.4 },
    { base: 0.63, amp: 0.05, scale: 18, color: '#2e4a48', haze: 0.15, trees: true, frost: true }] },
  volcano: { sky: ['#1a0a0e', '#7a2814'], clouds: 0.45, cloudCol: '#3a2228', ridges: [
    { base: 0.36, amp: 0.02, scale: 300, color: '#1c1214', haze: 0.2, volcano: true },
    { base: 0.6, amp: 0.1, scale: 70, color: '#140c0e', haze: 0.1 }] },
};

const bgCache = {};
/** The scenery behind the board for a place (400 × 600 units, painted at 1.2×). */
export function realBackground(theme) {
  if (bgCache[theme] || typeof document === 'undefined') return bgCache[theme];
  const sc = SCENES[theme] || SCENES.forest;
  const W = 480, H = 720, cv = canvas(W, H), ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  const s0 = hex(sc.sky[0]), s1 = hex(sc.sky[1]), cc = hex(sc.cloudCol || '#ffffff');
  const ridges = sc.ridges.map((rg, k) => {
    const col = hex(rg.color), hs = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      let h = rg.base * H + (N1(x / rg.scale + k * 13, k * 7.3, 5) - 0.5) * rg.amp * H * 2;
      if (rg.mesa) { const s = clamp((N2(x / 90 + 4, 2, 2) - 0.5) * 7); h = rg.base * H - s * s * (3 - 2 * s) * rg.amp * H + N3(x / 9, 1, 2) * 5; }
      if (rg.volcano) { const dx = Math.abs(x - W / 2); h = dx < 40 ? H * 0.34 : H * 0.34 + (dx - 40) * 1.05; }
      if (rg.ceiling) h = rg.base * H + (N1(x / rg.scale, 3, 4) - 0.5) * rg.amp * H * 2; // a cave roof (filled above)
      hs[x] = h;
    }
    return { ...rg, col, hs };
  });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = y / H;
    let r = mix(s0[0], s1[0], Math.pow(t, 0.8)), g = mix(s0[1], s1[1], Math.pow(t, 0.8)), b = mix(s0[2], s1[2], Math.pow(t, 0.8));
    if (sc.sun) { const [sx, sy, col] = sc.sun, c = hex(col), e = Math.exp(-((x - W * sx) ** 2 + (y - H * sy) ** 2) / (2 * (W * 0.12) ** 2)); r = mix(r, c[0], e * 0.8); g = mix(g, c[1], e * 0.8); b = mix(b, c[2], e * 0.8); }
    if (sc.clouds) { const cl = clamp((N2(x / 150, y / 55, 5) - (1 - sc.clouds * 0.9)) * 3) * clamp(1.2 - y / (H * 0.45)); r = mix(r, cc[0], cl * 0.85); g = mix(g, cc[1], cl * 0.85); b = mix(b, cc[2], cl * 0.85); }
    for (const rg of ridges) {
      const inside = rg.ceiling ? y < rg.hs[x] : y > rg.hs[x];
      if (!inside) continue;
      const tex = 0.85 + N3(x / (rg.trees ? 3 : 9), y / (rg.trees ? 3 : 9), 3) * 0.3;
      let cr = rg.col[0] * tex, cg = rg.col[1] * tex, cb = rg.col[2] * tex;
      if (rg.cap && y < rg.hs[x] + (H * rg.base - rg.hs[x] + 40) * rg.cap * 0.5) { cr = mix(cr, 240, 0.8); cg = mix(cg, 245, 0.8); cb = mix(cb, 252, 0.8); }
      if (rg.frost) { cr = mix(cr, 230, 0.25); cg = mix(cg, 238, 0.25); cb = mix(cb, 245, 0.25); }
      r = mix(cr, r, rg.haze); g = mix(cg, g, rg.haze); b = mix(cb, b, rg.haze);
    }
    if (rg_trees_edge(ridges, x, y)) { r *= 0.85; g *= 0.85; b *= 0.85; }
    const i = (y * W + x) * 4; d[i] = clamp(r, 0, 255); d[i + 1] = clamp(g, 0, 255); d[i + 2] = clamp(b, 0, 255); d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  landmarks(ctx, theme, W, H);
  bgCache[theme] = cv;
  return cv;
}
function rg_trees_edge(ridges, x, y) { // a jagged top edge for treelines (pointed conifers)
  for (const rg of ridges) if (rg.trees && y > rg.hs[x] - 14 && y <= rg.hs[x]) { const k = ((x % 9) - 4.5) / 4.5; if (y > rg.hs[x] - 14 * (1 - Math.abs(k))) return true; }
  return false;
}

/** The things that make each place itself, painted over its sky and hills. */
function landmarks(c, theme, W, H) {
  const r = rng(theme.length * 31 + 7);
  if (theme === 'forest') {
    // Big tree trunks at the sides, with light coming through.
    for (const [x, w] of [[22, 34], [W - 30, 40]]) {
      const tg = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0); tg.addColorStop(0, '#2c2118'); tg.addColorStop(0.5, '#5a4330'); tg.addColorStop(1, '#241a12');
      c.fillStyle = tg; c.fillRect(x - w / 2, 0, w, H);
      c.fillStyle = 'rgba(40,90,40,0.85)'; c.beginPath(); c.ellipse(x, 30, w * 2.4, 70, 0, 0, Math.PI * 2); c.fill();
    }
    shafts(c, W, H, 'rgba(255,245,200,0.16)');
  } else if (theme === 'cave') {
    for (let x = 6; x < W; x += 18 + r() * 26) { const len = 30 + r() * 90, w = 10 + r() * 16; const sg = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0); sg.addColorStop(0, '#120e18'); sg.addColorStop(0.5, '#3a3246'); sg.addColorStop(1, '#0e0b14'); c.fillStyle = sg; c.beginPath(); c.moveTo(x - w / 2, 0); c.lineTo(x, len + 40); c.lineTo(x + w / 2, 0); c.fill(); }
    for (const [x, y, hue] of [[60, 260, 190], [400, 200, 280], [330, 420, 190], [120, 470, 300], [240, 120, 200]]) {
      const gl = c.createRadialGradient(x, y, 0, x, y, 60); gl.addColorStop(0, `hsla(${hue},90%,70%,0.5)`); gl.addColorStop(1, `hsla(${hue},90%,70%,0)`);
      c.fillStyle = gl; c.beginPath(); c.arc(x, y, 60, 0, Math.PI * 2); c.fill();
      for (const [dx, h, a] of [[0, 26, 0], [-8, 16, -0.4], [9, 18, 0.4]]) { c.save(); c.translate(x + dx, y + 8); c.rotate(a); const cg = c.createLinearGradient(-5, 0, 5, 0); cg.addColorStop(0, `hsl(${hue},70%,55%)`); cg.addColorStop(1, `hsl(${hue},90%,85%)`); c.fillStyle = cg; c.beginPath(); c.moveTo(-5, 0); c.lineTo(0, -h); c.lineTo(5, 0); c.fill(); c.restore(); }
    }
  } else if (theme === 'ruins') {
    c.fillStyle = 'rgba(150,100,70,0.55)';
    for (let k = 0; k < 7; k++) c.fillRect(W / 2 - 40 - k * 26, 330 + k * 26, 80 + k * 52, 28);
    c.fillRect(W / 2 - 28, 296, 56, 36);
    for (const [x, h, broken] of [[50, 300, true], [140, 200, false], [W - 50, 330, false], [W - 120, 160, true]]) {
      const cg = c.createLinearGradient(x - 18, 0, x + 18, 0); cg.addColorStop(0, '#8c6a4c'); cg.addColorStop(0.45, '#d8b88e'); cg.addColorStop(1, '#7a5a40');
      c.fillStyle = cg; c.fillRect(x - 16, 640 - h, 32, h);
      c.fillStyle = 'rgba(90,60,40,0.35)'; for (let k = -10; k <= 10; k += 7) c.fillRect(x + k, 640 - h + 6, 2, h - 12);
      if (!broken) { c.fillStyle = '#c9a77c'; c.fillRect(x - 22, 640 - h - 12, 44, 12); }
    }
  } else if (theme === 'desert') {
    for (const [x, base, h] of [[90, 600, 90], [380, 610, 120]]) {
      const cg = c.createLinearGradient(x - 10, 0, x + 10, 0); cg.addColorStop(0, '#2e6a3c'); cg.addColorStop(0.5, '#5fa765'); cg.addColorStop(1, '#2a5c34');
      c.fillStyle = cg; c.fillRect(x - 9, base - h, 18, h); c.fillRect(x - 28, base - h * 0.62, 12, h * 0.3); c.fillRect(x - 28, base - h * 0.36, 22, 10); c.fillRect(x + 16, base - h * 0.8, 12, h * 0.36); c.fillRect(x + 6, base - h * 0.48, 22, 10);
    }
    c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { const y = 470 + i * 12; c.beginPath(); for (let x = 0; x <= W; x += 8) c.lineTo(x, y + Math.sin(x / 12 + i) * 1.5); c.stroke(); }
  } else if (theme === 'snow') {
    c.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 0; i < 70; i++) { c.beginPath(); c.arc(r() * W, r() * H * 0.8, 0.8 + r() * 1.8, 0, Math.PI * 2); c.fill(); }
  } else if (theme === 'volcano') {
    const gl = c.createRadialGradient(W / 2, H * 0.34, 0, W / 2, H * 0.34, 170); gl.addColorStop(0, 'rgba(255,170,60,0.75)'); gl.addColorStop(1, 'rgba(255,80,20,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(W / 2, H * 0.34, 170, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,120,40,0.9)'; c.lineWidth = 6; c.lineCap = 'round';
    for (const [bend, x1] of [[W / 2 - 50, W / 2 - 110], [W / 2 + 40, W / 2 + 100], [W / 2 + 5, W / 2 + 15]]) { c.beginPath(); c.moveTo(W / 2 + (x1 - W / 2) * 0.1, H * 0.35); c.quadraticCurveTo(bend, H * 0.48, x1, H * 0.66); c.stroke(); }
    for (let k = 0; k < 8; k++) { const sg = c.createRadialGradient(W / 2 + k * 8, H * 0.3 - k * 34, 0, W / 2 + k * 8, H * 0.3 - k * 34, 30 + k * 7); sg.addColorStop(0, 'rgba(70,50,55,0.7)'); sg.addColorStop(1, 'rgba(60,40,45,0)'); c.fillStyle = sg; c.beginPath(); c.arc(W / 2 + k * 8, H * 0.3 - k * 34, 30 + k * 7, 0, Math.PI * 2); c.fill(); }
  }
}
function shafts(c, W, H, color) {
  c.globalCompositeOperation = 'screen';
  for (const x of [W * 0.55, W * 0.72, W * 0.86]) { const g = c.createLinearGradient(x, 0, x - 180, H * 0.8); g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 30, 0); c.lineTo(x - 140, H * 0.85); c.lineTo(x - 200, H * 0.85); c.fill(); }
  c.globalCompositeOperation = 'source-over';
}
