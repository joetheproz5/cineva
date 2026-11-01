(() => {
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  const error = params.has("error") || params.has("error_code");
  const provider = sessionStorage.getItem("seven.oauth.provider") === "discord" ? "discord" : "google";
  sessionStorage.removeItem("seven.oauth.provider");
  history.replaceState(history.state, "", location.pathname);
  if (code || error) {
    try { sessionStorage.setItem("seven.social.oauth.callback", JSON.stringify({ provider, code:code || "", error })); }
    catch { location.replace(new URL("./?auth=login", location.href).href); return; }
  }
  location.replace(new URL("./", location.href).href);
})();
