(() => {
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  const error = params.has("error") || params.has("error_code");
  history.replaceState(history.state, "", location.pathname);
  if (code || error) {
    try { sessionStorage.setItem("seven.google.oauth.callback", JSON.stringify({ code:code || "", error })); }
    catch { location.replace("/?auth=login"); return; }
  }
  location.replace("/");
})();
