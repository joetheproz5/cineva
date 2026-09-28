(function () {
  "use strict";

  var optedOut = navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl === true;
  if (optedOut) return;

  var storageKey = "seven.daily-visit.v1";
  var today = new Date().toISOString().slice(0, 10);
  var visitorId = "";
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

  function send(payload, keepalive, accessToken) {
    var body = JSON.stringify(payload);
    if (keepalive && !accessToken && navigator.sendBeacon) {
      try {
        if (navigator.sendBeacon("/api/metrics/event", new Blob([body], { type:"text/plain;charset=UTF-8" }))) return;
      } catch {}
    }
    var headers = { "Content-Type":"text/plain;charset=UTF-8" };
    if (accessToken) headers.Authorization = "Bearer " + accessToken;
    fetch("/api/metrics/event", {
      method:"POST",
      credentials:"same-origin",
      keepalive:Boolean(keepalive),
      headers:headers,
      body:body
    }).catch(function () {});
  }

  if (visitorId) send({ event:"visit", visitorId:visitorId }, true);

  window.SevenMetrics = Object.freeze({
    trackAccountVisit:function (accessToken) {
      if (accessToken) send({ event:"visit", visitorId:visitorId }, true, accessToken);
    },
    trackDownload:function (platform) {
      if (["mac", "ios", "windows", "android"].indexOf(platform) !== -1) send({ event:"download", platform:platform }, true);
    }
  });
})();
