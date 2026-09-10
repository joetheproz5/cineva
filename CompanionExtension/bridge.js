async function applyPopupGuardState() {
  const { enabled = true } = await chrome.storage.local.get("enabled");
  window.dispatchEvent(new CustomEvent("seven-popup-guard-state", { detail:{ enabled } }));
}

chrome.runtime.onMessage.addListener(message => {
  if (message?.type === "SEVEN_POPUP_GUARD") window.dispatchEvent(new CustomEvent("seven-popup-guard-state", { detail:{ enabled:message.enabled !== false } }));
});

void applyPopupGuardState();
