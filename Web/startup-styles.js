(() => {
  "use strict";

  const links = [...document.querySelectorAll("link[data-seven-style]")];
  let resolveReady;
  let readySettled = false;
  let exposed = false;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  const expose = () => {
    if (exposed) return;
    exposed = true;
    document.documentElement.classList.add("seven-styles-ready");
    resolveReady();
  };
  const finish = () => {
    if (readySettled) return;
    readySettled = true;
    clearTimeout(deadline);
    links.forEach(link => { link.media = "all"; });
    if (window.requestAnimationFrame) requestAnimationFrame(expose);
    setTimeout(expose, 120);
  };
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
    if (!settled) {
      try { if (performance.getEntriesByName(link.href).some(entry => entry.responseEnd > 0)) activate(); }
      catch { /* The load event or startup deadline will release the screen. */ }
    }
  }));

  const deadline = setTimeout(finish, 2200);
  Promise.all(loaded).then(finish, finish);
  window.SEVENStylesReady = ready;
})();
