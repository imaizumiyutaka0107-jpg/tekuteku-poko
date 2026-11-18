// Ads, kept behind one small door so the game never cares which ad network is used.
//
//   initAds()            once at start: asks for consent where the law needs it, then loads ads
//   rewardedReady()      is a "watch a video to continue" ad available right now?
//   showRewarded()       show it; resolves true if the player watched to the end
//   betweenStages(n)     after clearing stage n: now and then shows a full-screen ad
//
// In the phone app this talks to Google AdMob (plugin @capacitor-community/admob).
// In the browser no ad is ever shown, so the web version plays exactly as before.
// For testing the flow in a browser, open the game with ?adtest: a pretend 3-second "ad" is shown.

// ---- Settings ------------------------------------------------------------------------------
// TESTING = true uses Google's sample ad units, which always show a "Test Ad" and pay nothing.
// Before release: set TESTING = false and put the real ad unit IDs from the AdMob account below
// (and the real App ID in android/app/src/main/AndroidManifest.xml).
const TESTING = true;
const UNITS = TESTING
  ? { rewarded: 'ca-app-pub-3940256099942544/5224354917', interstitial: 'ca-app-pub-3940256099942544/1033173712' }
  : { rewarded: 'ca-app-pub-XXXXXXXXXXXXXXXX/RRRRRRRRRR', interstitial: 'ca-app-pub-XXXXXXXXXXXXXXXX/IIIIIIIIII' };
const FIRST_AD_AFTER = 5;   // no full-screen ads while learning: never after stages 1-5
const EVERY = 3;            // then one every 3 cleared stages
const MIN_GAP_MS = 120000;  // and never two within 2 minutes

// ---------------------------------------------------------------------------------------------
const TEST = typeof location !== 'undefined' && /[?&]adtest\b/.test(location.search);
const native = () => typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
const admob = () => (native() ? window.Capacitor?.Plugins?.AdMob : null);

let ready = false;            // AdMob initialised
let rewardedLoaded = false;
let interstitialLoaded = false;
let clears = 0;
let lastFull = 0;

export async function initAds() {
  const A = admob();
  if (!A) return;
  try {
    // Consent (Europe, UK and some US states need it). Shows Google's own form only where required.
    try {
      const info = await A.requestConsentInfo();
      if (info?.isConsentFormAvailable && info.status === 'REQUIRED') await A.showConsentForm();
    } catch { /* no consent service: carry on with the default (non-personalised where required) */ }
    await A.initialize({ initializeForTesting: TESTING });
    ready = true;
    loadRewarded();
    loadInterstitial();
  } catch { ready = false; }
}

async function loadRewarded() {
  if (!ready) return;
  rewardedLoaded = false;
  try { await admob().prepareRewardVideoAd({ adId: UNITS.rewarded, isTesting: TESTING }); rewardedLoaded = true; }
  catch { setTimeout(loadRewarded, 60000); } // no ad right now (offline, no fill): try again later
}

async function loadInterstitial() {
  if (!ready) return;
  interstitialLoaded = false;
  try { await admob().prepareInterstitial({ adId: UNITS.interstitial, isTesting: TESTING }); interstitialLoaded = true; }
  catch { setTimeout(loadInterstitial, 60000); }
}

export function rewardedReady() {
  if (TEST) return true;
  return ready && rewardedLoaded;
}

export async function showRewarded() {
  if (TEST) return pretendAd();
  const A = admob();
  if (!A || !rewardedLoaded) return false;
  rewardedLoaded = false;
  // The reward arrives as an event; the promise of showRewardVideoAd settles when the ad closes.
  let earned = false;
  const sub = await A.addListener('onRewardedVideoAdReward', () => { earned = true; });
  try { const item = await A.showRewardVideoAd(); if (item && item.amount !== undefined) earned = true; }
  catch { /* failed to show */ }
  sub?.remove?.();
  loadRewarded();
  lastFull = Date.now(); // a video just played: hold off the next full-screen ad
  return earned;
}

/** Call when the player leaves a cleared stage n for the next one. Resolves when it is fine to go on. */
export async function betweenStages(n) {
  if (n <= FIRST_AD_AFTER) return;
  clears++;
  if (clears % EVERY !== 0 || Date.now() - lastFull < MIN_GAP_MS) return;
  if (TEST) { await pretendAd(); lastFull = Date.now(); return; }
  const A = admob();
  if (!A || !interstitialLoaded) return;
  interstitialLoaded = false;
  try { await A.showInterstitial(); lastFull = Date.now(); } catch { /* skip */ }
  loadInterstitial();
}

/** A stand-in for testing: a dark screen with a countdown, then the reward. */
function pretendAd() {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:50;background:#000c;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font:700 20px system-ui,sans-serif';
    let left = 3;
    el.innerHTML = `<div>📺 TEST AD</div><div class="n">${left}</div>`;
    document.body.append(el);
    const tick = setInterval(() => {
      left--;
      el.querySelector('.n').textContent = left;
      if (left <= 0) { clearInterval(tick); el.remove(); resolve(true); }
    }, 1000);
  });
}
