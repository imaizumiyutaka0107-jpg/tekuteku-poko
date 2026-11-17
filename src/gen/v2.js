// Stage maker, version 2. FROZEN once released, like v1.js.
//
// The same as v1 except that the door is always well above Poko's start: in v1 a stage could
// have the door level with the start (or lower), and players on phones found those lost to the
// magma, which reaches Poko's floor early. v2 makes every across-the-screen stage climb at
// least MIN_CLIMB rows (towers already climb 7 or more). The weekly challenge stays on v1.
import { mulberry32, pickClimb, groundStage, towerStage, walksHome, climbOf, stuckAfter, FIRST_TRAP, checkpoints, timing, pieceWeights } from './v1.js';

/** The least climb, in rows from Poko's start up to the door, for stage n. */
export const minClimb = (n) => (n < 21 ? 2 : 3);

/** Stage n (6 and up), made from its number. */
export const generate = (n) => generateWith(n, n * 7919 + 17);

export function generateWith(n, seed) {
  const rand = mulberry32(seed);
  const level = Math.min(1, (n - 6) / 40);
  const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
  // v1 left stages 6–20 to chance (often level); here they climb 2 to 3 rows.
  const want = n >= 21 ? Math.max(minClimb(n), pickClimb(n, rand)) : ri(2, 3);
  let fallback = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const def = want >= 7 ? towerStage(n, rand, want) : groundStage(n, rand, want);
    if (!def || walksHome(def)) continue;
    if (climbOf(def) !== want) continue;
    // Time to react: left alone, Poko must not be stuck for good before FIRST_TRAP seconds.
    if (!def.climbPlan && stuckAfter(def) < FIRST_TRAP) continue;
    const cps = checkpoints(def);
    if (!cps) continue;
    const cap = def.climbPlan ? Infinity : 6 + Math.round(level * 14) + want;
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
