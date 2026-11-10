(() => {
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  const error = params.has("error") || params.has("error_code");
  let provider = "google";
  try {
    provider = sessionStorage.getItem("seven.oauth.provider") === "discord" ? "discord" : "google";
    sessionStorage.removeItem("seven.oauth.provider");
  } catch { }
  history.replaceState(history.state, "", location.pathname);
  if (code || error) {
    const callback = { type:"seven-social-oauth-callback", provider, code:code || "", error };
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(callback, location.origin);
        window.close();
        return;
      } catch { }
    }
    if ("BroadcastChannel" in window) {
      try {
        const channel = new BroadcastChannel("seven.social.oauth");
        channel.postMessage(callback);
        channel.close();
        window.close();
        return;
      } catch { }
    }
    try { sessionStorage.setItem("seven.social.oauth.callback", JSON.stringify({ provider, code:code || "", error })); }
    catch { location.replace(new URL("./?auth=login", location.href).href); return; }
  }
  location.replace(new URL("./", location.href).href);
})();
