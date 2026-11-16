// The weekly challenge, version 1. FROZEN like v1.js: players compare times on these exact
// stages, so a week's stage and its blocks must never change (tests/weekly-fingerprints.json).
//
// Each week (Monday 00:00 UTC to the next) everyone in the world gets the same stage AND the
// same blocks in the same order, so the only difference between two players is how well they
// play: fastest clear wins.
import { generateWith, pieceWeights, mulberry32 } from './v1.js';

const WEEK = 7 * 24 * 3600 * 1000;
const MONDAY = Date.UTC(1970, 0, 5); // weeks start on Mondays, 00:00 UTC
/** Difficulty: as hard as this stage number (a climb of about 4 rows, mostly friendly shapes). */
const LEVEL = 40;

/** The week a moment falls in, counted from 1970 (week 2966 starts Monday 9 Nov 2026). */
export const weekOf = (ms = Date.now()) => Math.floor((ms - MONDAY) / WEEK);
export const weekStart = (week) => MONDAY + week * WEEK;
export const weekEnd = (week) => weekStart(week + 1);

/** This week's stage: made like stage LEVEL but from the week's own seed. */
export function weeklyStage(week) {
  return { ...generateWith(LEVEL, (week * 104729 + 99991) | 0), weights: pieceWeights(LEVEL) };
}

/** The week's blocks, in order: a fresh copy of the same sequence for every try. */
export const weeklyBlocks = (week) => mulberry32((week * 31337 + 7) | 0);
