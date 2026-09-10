(() => {
  let enabled = true;
  const originalOpen = window.open;

  function blockPopup(event) {
    if (!enabled) return;
    const link = event.target instanceof Element ? event.target.closest('a[target="_blank"], area[target="_blank"]') : null;
    if (!link) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function applyState(nextEnabled) {
    enabled = nextEnabled;
    window.open = enabled ? (() => null) : originalOpen;
  }

  window.addEventListener("seven-popup-guard-state", event => applyState(event.detail?.enabled !== false));
  document.addEventListener("click", blockPopup, true);
  applyState(true);
})();
