// Running on a browser-game site (CrazyGames, itch.io) instead of our own page.
//
// The portal builds (scripts/build-portal.mjs) set window.POKO_PORTAL before the game loads.
// On our own site and in the phone app it is unset, and everything here does nothing.
//
// CrazyGames wants to know when the player is actually playing (gameplayStart / gameplayStop)
// and forbids an in-game full-screen button (the site has its own). Its SDK is loaded by the
// CrazyGames build only. Ads through its SDK come later, at its "Full Launch" stage.

export const PORTAL = (typeof window !== 'undefined' && window.POKO_PORTAL) || null;
export const ON_CRAZYGAMES = PORTAL === 'crazygames';

const sdk = () => (ON_CRAZYGAMES ? window.CrazyGames?.SDK : null);
let ready = false;
let playing = false;

/** Start the portal's SDK (if any). Never throws; the game runs the same without it. */
export async function initPortal() {
  const s = sdk();
  if (!s) return;
  try {
    await s.init();
    ready = s.environment !== 'disabled';
  } catch { ready = false; }
}

/** Tell the portal whether the player is in active play right now (called every frame). */
export function setPlaying(on) {
  if (on === playing) return;
  playing = on;
  if (!ready) return;
  try { on ? sdk().game.gameplayStart() : sdk().game.gameplayStop(); } catch { /* ignore */ }
}

/** A moment of joy (a stage cleared with all three stars): CrazyGames may celebrate it. */
export function happytime() {
  if (!ready) return;
  try { sdk().game.happytime(); } catch { /* ignore */ }
}
