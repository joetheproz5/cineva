const PROVIDER_HOSTS = new Set(["vidlink.pro", "vidsrc.sbs", "vidking.net", "2embed.online"]);
const RULESET_ID = "popup_navigation";

function isProviderURL(value) {
  try {
    const host = new URL(value).hostname;
    return [...PROVIDER_HOSTS].some(provider => host === provider || host.endsWith(`.${provider}`));
  } catch { return false; }
}

async function updateBadge(enabled) {
  await chrome.action.setBadgeText({ text: enabled ? "ON" : "OFF" });
  await chrome.action.setBadgeBackgroundColor({ color: enabled ? "#b20710" : "#606060" });
}

async function setEnabled(enabled) {
  await chrome.storage.local.set({ enabled });
  await chrome.declarativeNetRequest.updateEnabledRulesets(enabled
    ? { enableRulesetIds:[RULESET_ID], disableRulesetIds:[] }
    : { enableRulesetIds:[], disableRulesetIds:[RULESET_ID] });
  await updateBadge(enabled);
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(tab => chrome.tabs.sendMessage(tab.id, { type:"SEVEN_POPUP_GUARD", enabled }).catch(() => undefined)));
}

chrome.runtime.onInstalled.addListener(async () => {
  const { enabled = true } = await chrome.storage.local.get("enabled");
  await setEnabled(enabled);
});

chrome.runtime.onStartup.addListener(async () => {
  const { enabled = true } = await chrome.storage.local.get("enabled");
  await updateBadge(enabled);
});

chrome.action.onClicked.addListener(async () => {
  const { enabled = true } = await chrome.storage.local.get("enabled");
  await setEnabled(!enabled);
});

chrome.webNavigation.onCreatedNavigationTarget.addListener(async details => {
  const { enabled = true } = await chrome.storage.local.get("enabled");
  if (!enabled || details.tabId === details.sourceTabId) return;
  try {
    const source = await chrome.webNavigation.getFrame({ tabId:details.sourceTabId, frameId:details.sourceFrameId });
    if (isProviderURL(source?.url || "")) await chrome.tabs.remove(details.tabId);
  } catch { /* The navigation may have finished before Chrome returns its source frame. */ }
});
