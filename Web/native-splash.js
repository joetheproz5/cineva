(() => {
  "use strict";

  const spec = window.SplashSpec;
  const splash = window.SEVENSplash;
  if (!spec || !splash) return;

  let handle = null;
  let timelineReady = false;
  let closed = false;

  function postNative(message) {
    try {
      if (window.webkit?.messageHandlers?.sevenSplashNative) {
        window.webkit.messageHandlers.sevenSplashNative.postMessage(message);
      } else if (window.SEVENNative?.onSplashEvent) {
        window.SEVENNative.onSplashEvent(JSON.stringify(message));
      } else if (window.chrome?.webview) {
        window.chrome.webview.postMessage(message);
      }
    } catch { /* The animation remains usable without a native host. */ }
  }

  const options = window.__SEVEN_SPLASH_OPTIONS__ || splash.resolveLaunchOptions();
  if (!options) {
    postNative({ type: "finish" });
    return;
  }

  function exitIfReady() {
    if (timelineReady && window.__SEVEN_SPLASH_READY__ === true && handle && !closed) handle.exit();
  }

  handle = splash.createOverlay(options, {
    onStarted() {
      postNative({ type: "started" });
    },
    onEntryComplete() {
      timelineReady = true;
      exitIfReady();
    },
    onSkip() {
      if (closed || !handle) return;
      closed = true;
      handle.exit({ skip: true });
    },
    onExitStart(phases) {
      postNative({
        type: "exitStart",
        screenDelayWallMs: phases.screenDelayWallMs,
        screenFadeWallMs: phases.screenFadeWallMs,
        screenEasing: phases.screenEasing,
      });
    },
    onExitComplete() {
      closed = true;
      postNative({ type: "finish" });
    },
  });

  document.body.appendChild(handle.element);
  window.SevenNativeSplash = Object.freeze({
    setReady() {
      window.__SEVEN_SPLASH_READY__ = true;
      exitIfReady();
    },
  });
  // The SwiftUI screen is already mounted behind this local splash web view.
  window.__SEVEN_SPLASH_READY__ = true;
  handle.start();
})();
