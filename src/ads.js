// Ads, kept behind one small door so the game never cares which ad network is used.
//
//   rewardedReady()   is a "watch a video to continue" ad available right now?
//   showRewarded()    show it; resolves true if the player watched to the end
//
// In the phone app this will talk to Google AdMob (once the AdMob account and its plugin are
// set up). Until then - and in the browser - no ad is ever offered, so the game plays as now.
// For testing the flow, open the game with ?adtest: a pretend 3-second "ad" is shown instead.

const TEST = typeof location !== 'undefined' && /[?&]adtest\b/.test(location.search);
const admob = () => (typeof window !== 'undefined' ? window.Capacitor?.Plugins?.AdMob : null);

export function rewardedReady() {
  if (TEST) return true;
  return !!admob() && rewardedLoaded;
}

let rewardedLoaded = false;
// (Filled in with the AdMob plugin: prepareRewardVideoAd on start and after each showing,
// setting rewardedLoaded when it is ready.)

export function showRewarded() {
  if (TEST) return pretendAd();
  return Promise.resolve(false);
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
