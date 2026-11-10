(() => {
  "use strict";

  const links = [...document.querySelectorAll("link[data-seven-style]")];
  const loaded = links.map(link => new Promise(resolve => {
    let settled = false;
    const activate = () => {
      if (settled) return;
      settled = true;
      link.media = "all";
      resolve();
    };
    link.addEventListener("load", activate, { once:true });
    link.addEventListener("error", activate, { once:true });
    if (link.sheet) {
      try { if (link.sheet.cssRules.length) activate(); } catch { /* Wait for the stylesheet load event. */ }
    }
    if (!settled && performance.getEntriesByName(link.href).some(entry => entry.responseEnd > 0)) activate();
  }));

  window.SEVENStylesReady = Promise.all(loaded).then(() => new Promise(resolve => {
    requestAnimationFrame(() => {
      document.documentElement.classList.add("seven-styles-ready");
      resolve();
    });
  }));
})();
