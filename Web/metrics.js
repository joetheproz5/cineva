(function () {
  "use strict";

  var storageKey = "seven.daily-visit.v1";
  var visitorId = "";
  var visited = false;
  function allowed() { return window.SevenPrivacy?.analyticsAllowed() === true; }
  function visitor() {
    if (!allowed()) return "";
    var today = new Date().toISOString().slice(0, 10);
  try {
    var saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved && saved.day === today && /^[a-f0-9]{32}$/i.test(saved.id || "")) {
      visitorId = saved.id;
    } else if (window.crypto && crypto.getRandomValues) {
      visitorId = Array.from(crypto.getRandomValues(new Uint8Array(16)), function (byte) {
        return byte.toString(16).padStart(2, "0");
      }).join("");
      localStorage.setItem(storageKey, JSON.stringify({ day:today, id:visitorId }));
    }
  } catch {
    // If browser storage is unavailable, skip this privacy-preserving unique-visit count.
  }
    return visitorId;
  }

  function send(payload, keepalive, accessToken) {
    if (!allowed()) return;
    var body = JSON.stringify(payload);
    var headers = { "Content-Type":"text/plain;charset=UTF-8" };
    if (accessToken) headers.Authorization = "Bearer " + accessToken;
    fetch("/api/metrics/event", {
      method:"POST",
      credentials:"same-origin",
      keepalive:Boolean(keepalive),
      cache:"no-store",
      headers:headers,
      body:body
    }).then(function (response) {
      if (!response.ok) console.warn("SEVEN analytics request failed with HTTP " + response.status + ".");
    }).catch(function () {
      console.warn("SEVEN analytics request did not reach the server.");
    });
  }

  function visit() { if (allowed() && !visited && visitor()) { visited = true; send({ event:"visit", visitorId:visitorId }, true); } }

  window.SevenMetrics = Object.freeze({
    trackAccountVisit:function (accessToken) {
      if (allowed() && accessToken && visitor()) send({ event:"visit", visitorId:visitorId }, true, accessToken);
    }
  });
  window.addEventListener('seven:privacy-change', function () { if (allowed()) visit(); else { visitorId = ""; visited = false; } });
  // Older/static download pages load only this module. Bootstrap the same self-hosted
  // choices UI there; missing/failed privacy assets still leave analytics disabled.
  if (!window.SevenPrivacy && document.currentScript?.src) {
    var base = document.currentScript.src, style = document.createElement('link'), script = document.createElement('script');
    style.rel = 'stylesheet'; style.href = new URL('privacy.css?v=1', base).href;
    script.src = new URL('privacy.js?v=1', base).href; script.onload = visit;
    document.head.append(style, script);
    var footer = document.querySelector('footer');
    if (footer && !footer.querySelector('[data-privacy-settings]')) { var link = document.createElement('a'); link.href = new URL('privacy.html', base).href; link.dataset.privacySettings = ''; link.className = 'seven-privacy-entry'; link.textContent = 'Privacy choices'; footer.append(link); }
  }
  visit();
})();
