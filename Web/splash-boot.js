(() => {
  "use strict";

  const splash = window.SEVENSplash;
  if (!splash) return;

  if (new URLSearchParams(location.search).get("splashDebug") === "1") {
    window.SEVENSplashBootstrap = { debug:true, options:null, handle:null };
    return;
  }

  let enabled = true;
  try {
    const account = JSON.parse(localStorage.getItem("seven.account.settings") || "null");
    const profile = account?.profiles?.find(item => item.id === account.activeProfileId);
    enabled = (profile?.preferences?.introEnabled ?? account?.preferences?.introEnabled) !== false;
  } catch { /* Keep the launch ident enabled if local settings are unavailable. */ }

  const options = splash.resolveLaunchOptions({ enabled });
  const bootstrap = {
    options,
    handle:null,
    entryComplete:false,
    skipRequested:false,
    callbacks:null,
    attach(callbacks) {
      this.callbacks = callbacks;
      if (this.entryComplete) callbacks.onEntryComplete?.();
      if (this.skipRequested) callbacks.onSkip?.();
    },
  };
  window.SEVENSplashBootstrap = bootstrap;
  if (!options) return;

  const dispatch = (name, value) => bootstrap.callbacks?.[name]?.(value);
  bootstrap.handle = splash.createOverlay(options, {
    onEntryComplete() {
      bootstrap.entryComplete = true;
      dispatch("onEntryComplete");
    },
    onSkip() {
      bootstrap.skipRequested = true;
      dispatch("onSkip");
    },
    onExitStart: phases => dispatch("onExitStart", phases),
    onExitComplete: () => dispatch("onExitComplete"),
  });
  document.body.appendChild(bootstrap.handle.element);
  bootstrap.handle.start();
})();
