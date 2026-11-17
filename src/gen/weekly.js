// The weekly challenge, by week. FROZEN like the stage makers: a week's stage and its blocks
// must never change once players can reach it (tests/weekly-fingerprints.json).
//
// Weeks before WIDE_FROM use weekly-v1 (10 × 15 stages); from WIDE_FROM (the week of Monday 23
// Nov 2026) the stage comes from v3 on the 12 × 18 board. The blocks are drawn the same way.
import * as w1 from './weekly-v1.js';
import { generateWith } from './v3.js';
import { pieceWeights } from './v1.js';

export const { weekOf, weekStart, weekEnd, weeklyBlocks } = w1;
export const WIDE_FROM = 2968;
const LEVEL = 40;

/** This week's stage. */
export function weeklyStage(week) {
  if (week < WIDE_FROM) return w1.weeklyStage(week);
  return { ...generateWith(LEVEL, (week * 104729 + 99991) | 0), weights: pieceWeights(LEVEL) };
}
