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

  if (visitorId) send({ event:"visit", visitorId:visitorId }, true);

  window.SevenMetrics = Object.freeze({
    trackAccountVisit:function (accessToken) {
      if (accessToken) send({ event:"visit", visitorId:visitorId }, true, accessToken);
    }
  });
})();
