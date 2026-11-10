(() => {
  "use strict";

  const spec = window.SplashSpec;
  if (!spec) return;
  const svgNs = "http://www.w3.org/2000/svg";
  const xlinkNs = "http://www.w3.org/1999/xlink";
  const reducedQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let overlaySequence = 0;
  let wordmarkPathPromise = null;
  let startupAudioPlayer = null;

  const clamp01 = value => Math.max(0, Math.min(1, value));
  const lerp = (from, to, amount) => from + (to - from) * amount;
  const easeOut = value => 1 - Math.pow(1 - clamp01(value), 3);
  function cubicBezier(value, x1, y1, x2, y2) {
    const x = clamp01(value);
    if (x === 0 || x === 1) return x;
    const curve = (t, a, b) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
    let low = 0;
    let high = 1;
    for (let i = 0; i < 9; i += 1) {
      const middle = (low + high) / 2;
      if (curve(middle, x1, x2) < x) low = middle;
      else high = middle;
    }
    return curve((low + high) / 2, y1, y2);
  }
  function bezierValues(value, fallback) {
    const match = String(value || "").match(/cubic-bezier\(\s*([^)]*)\s*\)/i);
    if (!match) return fallback;
    const values = match[1].split(",").map(Number);
    return values.length === 4 && values.every(Number.isFinite) ? values : fallback;
  }
  function inOutPulse(time, pulse) {
    if (time < pulse.start || time > pulse.end || pulse.end <= pulse.start) return 0;
    if (time <= pulse.peak) {
      const p = clamp01((time - pulse.start) / Math.max(1, pulse.peak - pulse.start));
      return 0.5 - 0.5 * Math.cos(Math.PI * p);
    }
    const p = clamp01((time - pulse.peak) / Math.max(1, pulse.end - pulse.peak));
    return 0.5 + 0.5 * Math.cos(Math.PI * p);
  }
  function currentDateKey() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function reducedMotionRequested() {
    let nativeAnimationsEnabled = true;
    try {
      if (typeof window.SEVENNative?.areAnimationsEnabled === "function") {
        nativeAnimationsEnabled = window.SEVENNative.areAnimationsEnabled() !== false;
      }
    } catch { /* Fall back to the platform reduced-motion media query. */ }
    return Boolean(reducedQuery?.matches || !nativeAnimationsEnabled || window.SEVEN_NATIVE_ANIMATION_SCALE === 0 || window.SEVEN_REDUCED_MOTION === true);
  }
  function loadWordmarkPath() {
    if (!wordmarkPathPromise) {
      const assetUrl = spec.pathUrl.split("#")[0];
      wordmarkPathPromise = fetch(assetUrl, { cache:"force-cache" })
        .then(response => { if (!response.ok) throw Error("Wordmark asset is unavailable."); return response.text(); })
        .then(source => {
          const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
          if (parsed.querySelector("parsererror")) return null;
          return parsed.getElementById("seven-wordmark-shape")?.getAttribute("d") || null;
        })
        .catch(() => null);
    }
    return wordmarkPathPromise;
  }
  function validVersion(version) {
    return version === "short" ? "short" : "full";
  }
  function resolveLaunchOptions({ enabled = true } = {}) {
    const params = new URLSearchParams(window.location.search);
    const debug = params.get("splashDebug") === "1";
    if (!debug && !enabled) return null;
    if (!debug) {
      const navigation = performance.getEntriesByType?.("navigation")?.[0];
      if (navigation?.type === "back_forward" || document.visibilityState === "hidden" || document.wasDiscarded) return null;
    }
    let version;
    if (debug) {
      version = validVersion(params.get("splashVersion"));
    } else {
      let previous = null;
      try { previous = JSON.parse(localStorage.getItem(spec.storageKey) || "null"); } catch { /* Treat unavailable storage as a first launch. */ }
      version = previous?.date === currentDateKey() ? "short" : "full";
      try { localStorage.setItem(spec.storageKey, JSON.stringify({ date: currentDateKey(), version })); } catch { /* The splash remains usable when storage is unavailable. */ }
    }
    const requestedScale = debug ? Number(params.get("splashScale")) : 1;
    const scale = requestedScale === 0.25 ? 0.25 : 1;
    const debugNumber = (name, fallback) => {
      if (!debug || params.get(name) === null) return fallback;
      const value = Number(params.get(name));
      return Number.isFinite(value) && value >= 0 ? value : fallback;
    };
    return {
      version,
      scale,
      reducedMotion: reducedMotionRequested(),
      debug,
      sliceStaggerMs: debugNumber("splashSliceStagger", spec.sliceReveal.staggerMs),
      sliceDurationMs: debugNumber("splashSliceDuration", spec.sliceReveal.durationMs),
      glintStartMs: debugNumber("splashGlintStart", spec[version].glint.start),
      glintDurationMs: debugNumber("splashGlintDuration", spec[version].glint.duration),
    };
  }
  function svgElement(name, attributes = {}) {
    const node = document.createElementNS(svgNs, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  }
  function setHref(node, href) {
    node.setAttribute("href", href);
    node.setAttributeNS(xlinkNs, "xlink:href", href);
  }
  function addPathUse(parent, attributes = {}) {
    const use = svgElement("use", attributes);
    setHref(use, spec.pathUrl);
    parent.appendChild(use);
    return use;
  }
  function createOverlay({ version = "full", scale = 1, reducedMotion = false, debug = false, sliceStaggerMs, sliceDurationMs, glintStartMs, glintDurationMs } = {}, callbacks = {}) {
    const actualVersion = reducedMotion ? "reducedMotion" : validVersion(version);
    const timeline = actualVersion === "reducedMotion" ? spec.reducedMotion : spec[actualVersion];
    const sliceSpec = timeline.slices ? {
      ...timeline.slices,
      delay: debug && Number.isFinite(Number(sliceStaggerMs)) ? Math.max(0, Number(sliceStaggerMs)) : timeline.slices.delay,
      duration: debug && Number.isFinite(Number(sliceDurationMs)) ? Math.max(1, Number(sliceDurationMs)) : timeline.slices.duration,
    } : null;
    const glintSpec = timeline.glint ? {
      ...timeline.glint,
      start: debug && Number.isFinite(Number(glintStartMs)) ? Math.max(0, Number(glintStartMs)) : timeline.glint.start,
      duration: debug && Number.isFinite(Number(glintDurationMs)) ? Math.max(1, Number(glintDurationMs)) : timeline.glint.duration,
    } : null;
    const revealEnd = sliceSpec
      ? sliceSpec.start + sliceSpec.duration + sliceSpec.delay * (sliceSpec.count - 1) / 2
      : Infinity;
    const exitSpec = timeline.exit || {};
    const defaultExitDuration = timeline.exit?.duration || spec.reducedMotion.exit;
    const exitPhases = {
      duration: defaultExitDuration,
      splashFadeDuration: exitSpec.splashFadeDuration || defaultExitDuration,
      screenDelay: exitSpec.screenDelay || 0,
      screenFadeDuration: exitSpec.screenFadeDuration || defaultExitDuration,
      fromScale: exitSpec.fromScale,
      toScale: exitSpec.toScale || 1,
      easing: exitSpec.easing || "cubic-bezier(0.5,0,0.75,0)",
      screenEasing: exitSpec.screenEasing || "cubic-bezier(0.22,1,0.36,1)",
      curve: bezierValues(exitSpec.easing, [0.5, 0, 0.75, 0]),
    };
    const sequenceId = `seven-splash-${++overlaySequence}`;
    const localPathId = `${sequenceId}-wordmark-path`;
    const root = document.createElement("div");
    root.className = "seven-intro";
    root.setAttribute("aria-hidden", "true");
    root.setAttribute("role", "presentation");
    root.dataset.splashVersion = actualVersion;
    root.dataset.splashScale = String(scale);

    const composition = document.createElement("div");
    composition.className = "splash-composition";
    const glow = document.createElement("div");
    glow.className = "splash-glow";
    const streak = document.createElement("div");
    streak.className = "splash-streak";
    const streakCore = document.createElement("div");
    streakCore.className = "splash-streak-core";
    const mark = svgElement("svg", {
      class: "splash-wordmark",
      viewBox: `0 0 ${spec.layout.wordmarkViewBoxWidth} ${spec.layout.wordmarkViewBoxHeight}`,
      preserveAspectRatio: "xMidYMid meet",
      "aria-hidden": "true",
      focusable: "false",
    });
    const defs = svgElement("defs");
    const markClipId = `${sequenceId}-mark`;
    const markClip = svgElement("clipPath", { id: markClipId, clipPathUnits: "userSpaceOnUse" });
    addPathUse(markClip);
    defs.appendChild(markClip);

    const sliceClips = [];
    const sliceGroup = svgElement("g", { class: "splash-slices" });
    if (actualVersion !== "reducedMotion") {
      const sliceWidth = spec.layout.wordmarkViewBoxWidth / sliceSpec.count;
      for (let index = 0; index < sliceSpec.count; index += 1) {
        const clipId = `${sequenceId}-slice-${index}`;
        const clip = svgElement("clipPath", { id: clipId, clipPathUnits: "userSpaceOnUse" });
        const rect = svgElement("rect", { x: 0, y: 0, width: 0, height: 0 });
        rect.style.display = "none";
        clip.appendChild(rect);
        defs.appendChild(clip);
        const group = svgElement("g", { "clip-path": `url(#${clipId})` });
        addPathUse(group, { fill: spec.colors.accent });
        sliceGroup.appendChild(group);
        sliceClips.push({ rect, index });
      }
    }

    const settledMark = svgElement("g", { class: "splash-settled-wordmark", display: "none" });
    addPathUse(settledMark, { fill: spec.colors.accent });

    const reducedMark = svgElement("g", { class: "splash-reduced-wordmark", opacity: 0 });
    addPathUse(reducedMark, { fill: spec.colors.accent });
    const glintGradientId = `${sequenceId}-glint-gradient`;
    const glintWidth = spec.layout.wordmarkViewBoxWidth * (glintSpec?.widthFactor || 0.18);
    const glintSkew = glintSpec?.skewDegrees || -20;
    const glintSkewExtent = Math.tan(Math.abs(glintSkew) * Math.PI / 180) * spec.layout.wordmarkViewBoxHeight;
    const glintTravel = spec.layout.wordmarkViewBoxWidth + glintWidth + glintSkewExtent;
    const gradient = svgElement("linearGradient", {
      id: glintGradientId,
      gradientUnits: "userSpaceOnUse",
      x1: -glintWidth,
      y1: 0,
      x2: 0,
      y2: 0,
    });
    gradient.appendChild(svgElement("stop", { offset: 0, "stop-color": spec.colors.glint, "stop-opacity": 0 }));
    gradient.appendChild(svgElement("stop", { offset: 0.5, "stop-color": spec.colors.glint, "stop-opacity": spec.colors.glintAlpha }));
    gradient.appendChild(svgElement("stop", { offset: 1, "stop-color": spec.colors.glint, "stop-opacity": 0 }));
    defs.appendChild(gradient);
    const glint = svgElement("rect", {
      class: "splash-glint",
      x: -glintWidth,
      y: 0,
      width: glintWidth,
      height: spec.layout.wordmarkViewBoxHeight,
      fill: `url(#${glintGradientId})`,
      transform: `skewX(${glintSkew})`,
    });
    const glintClipGroup = svgElement("g", { class: "splash-glint-clip", "clip-path": `url(#${markClipId})` });
    glintClipGroup.appendChild(glint);
    mark.append(defs, sliceGroup, settledMark, reducedMark, glintClipGroup);
    const content = document.createElement("div");
    content.className = "splash-content";
    content.append(streak, streakCore, mark);
    composition.append(glow, content);
    root.appendChild(composition);

    let startTimestamp = null;
    let raf = 0;
    let entryComplete = false;
    let exiting = false;
    let destroyed = false;
    let firstFrameAudioNotified = false;
    let currentTime = 0;
    let currentScale = 1;
    let exitStartTime = 0;
    let exitStartTimeline = 0;
    let exitStartScale = 1;
    let activeExitPhases = { ...exitPhases };
    let onEntryComplete = callbacks.onEntryComplete || (() => {});
    loadWordmarkPath().then(pathData => {
      if (!pathData || destroyed) return;
      const path = svgElement("path", { id:localPathId, fill:spec.colors.accent, "fill-rule":"evenodd" });
      path.setAttribute("d", pathData);
      defs.appendChild(path);
      mark.querySelectorAll("use").forEach(use => setHref(use, `#${localPathId}`));
    });

    function measure() {
      const width = Math.max(1, window.innerWidth || document.documentElement.clientWidth);
      const height = Math.max(1, window.innerHeight || document.documentElement.clientHeight);
      return { width, height };
    }
    function wordmarkWidth() {
      const { width, height } = measure();
      return Math.max(spec.layout.wordmarkWidthMin, Math.min(spec.layout.wordmarkWidthMax, spec.layout.wordmarkWidthFactor * Math.min(width, spec.layout.wordmarkHeightFactor * height)));
    }
    function setGeometry(time) {
      const width = wordmarkWidth();
      const widthStyle = `${width}px`;
      if (mark.style.width !== widthStyle) mark.style.width = widthStyle;
      if (actualVersion === "reducedMotion") return;
      let streakWidthRatio;
      if (actualVersion === "short") {
        const extension = clamp01(time / Math.max(1, timeline.streak.full));
        streakWidthRatio = lerp(timeline.line.maxWidth, spec.layout.streakWidthMax, cubicBezier(extension, 0.16, 1, 0.3, 1));
      } else if (time < timeline.line.growthEnd) {
        streakWidthRatio = timeline.line.maxWidth * clamp01((time - timeline.line.start) / Math.max(1, timeline.line.growthEnd - timeline.line.start));
      } else {
        const extension = clamp01((time - timeline.streak.start) / Math.max(1, timeline.streak.full - timeline.streak.start));
        streakWidthRatio = lerp(timeline.line.maxWidth, spec.layout.streakWidthMax, cubicBezier(extension, 0.16, 1, 0.3, 1));
      }
      const viewportWidth = measure().width;
      const maxStreakWidth = viewportWidth * spec.layout.streakWidthMax;
      const streakScale = Math.max(0, streakWidthRatio / spec.layout.streakWidthMax);
      streak.style.width = `${maxStreakWidth}px`;
      streakCore.style.width = `${maxStreakWidth}px`;
      const streakTransform = `translate(-50%, -50%) scaleX(${streakScale})`;
      streak.style.transform = streakTransform;
      streakCore.style.transform = streakTransform;
      if (glintSpec) {
        const linearProgress = clamp01((time - glintSpec.start) / Math.max(1, glintSpec.duration));
        const progress = cubicBezier(linearProgress, 0.45, 0, 0.2, 1);
        const alpha = Math.min(1, progress / spec.glintFadeFraction, (1 - progress) / spec.glintFadeFraction);
        glint.setAttribute("transform", `translate(${progress * glintTravel} 0) skewX(${glintSkew})`);
        glint.setAttribute("opacity", String(clamp01(alpha)));
      }
    }
    function glowAlpha(time) {
      if (actualVersion === "reducedMotion") return 0;
      const baseAlpha = timeline.glow.baseAlpha;
      const baseProgress = actualVersion === "short" ? timeline.glow.initialMultiplier : easeOut(clamp01((time - timeline.glow.start) / Math.max(1, timeline.glow.end - timeline.glow.start)));
      return baseAlpha * baseProgress + timeline.glowPulse.amplitude * inOutPulse(time, timeline.glowPulse);
    }
    function streakAlpha(time) {
      if (actualVersion === "reducedMotion") return 0;
      if (actualVersion === "short") {
        if (time <= timeline.streak.peak) return lerp(timeline.streak.startAlpha, 1, easeOut(time / Math.max(1, timeline.streak.peak)));
        if (time <= timeline.streak.fade) return lerp(1, 0.25, clamp01((time - timeline.streak.peak) / Math.max(1, timeline.streak.fade - timeline.streak.peak)));
        if (time <= timeline.streak.settle) return lerp(0.25, timeline.streak.finalAlpha, clamp01((time - timeline.streak.fade) / Math.max(1, timeline.streak.settle - timeline.streak.fade)));
        return timeline.streak.finalAlpha;
      }
      if (time < timeline.streak.start) return easeOut(clamp01((time - timeline.line.start) / Math.max(1, timeline.line.end - timeline.line.start)));
      if (time <= timeline.streak.peak) return lerp(timeline.streak.startAlpha, 1, easeOut((time - timeline.streak.start) / Math.max(1, timeline.streak.peak - timeline.streak.start)));
      if (time <= timeline.streak.fade) return lerp(1, 0.25, clamp01((time - timeline.streak.peak) / Math.max(1, timeline.streak.fade - timeline.streak.peak)));
      if (time <= timeline.streak.settle) return lerp(0.25, timeline.streak.finalAlpha, clamp01((time - timeline.streak.fade) / Math.max(1, timeline.streak.settle - timeline.streak.fade)));
      return timeline.streak.finalAlpha;
    }
    function pushScale(time) {
      if (actualVersion === "reducedMotion") return 1;
      const p = cubicBezier(clamp01((time - timeline.push.start) / Math.max(1, timeline.push.end - timeline.push.start)), ...timeline.push.curve);
      return lerp(timeline.push.from, timeline.push.to, p);
    }
    function updateSliceReveal(time, scaleFactor, cssWidth) {
      if (!sliceSpec) return;
      const settled = time >= revealEnd;
      sliceGroup.style.display = settled ? "none" : "";
      settledMark.style.display = settled ? "inline" : "none";
      if (settled) return;

      const viewWidth = spec.layout.wordmarkViewBoxWidth;
      const viewHeight = spec.layout.wordmarkViewBoxHeight;
      const pixelsPerUnit = cssWidth * scaleFactor * Math.max(0.25, window.devicePixelRatio || 1) / viewWidth;
      const devicePixel = 1 / pixelsPerUnit;
      const sliceWidth = viewWidth / sliceSpec.count;
      for (const { rect, index } of sliceClips) {
        const center = (sliceSpec.count - 1) / 2;
        const delay = sliceSpec.delay * Math.abs(index - center);
        const progress = clamp01((time - sliceSpec.start - delay) / sliceSpec.duration);
        rect.style.display = progress > 0 ? "block" : "none";
        if (progress <= 0) continue;

        const height = viewHeight * cubicBezier(progress, 0.22, 1, 0.36, 1);
        const leftEdge = Math.round(index * sliceWidth * pixelsPerUnit) / pixelsPerUnit;
        const rightEdge = Math.round((index + 1) * sliceWidth * pixelsPerUnit) / pixelsPerUnit;
        const top = Math.floor(((viewHeight - height) / 2) * pixelsPerUnit) / pixelsPerUnit;
        const bottom = Math.ceil(((viewHeight + height) / 2) * pixelsPerUnit) / pixelsPerUnit;
        rect.setAttribute("x", String(leftEdge - devicePixel));
        rect.setAttribute("y", String(top));
        rect.setAttribute("width", String(rightEdge - leftEdge + devicePixel * 2));
        rect.setAttribute("height", String(bottom - top));
      }
    }
    function applyComposition(time, exitPreview = false) {
      let opacity = "1";
      if (exiting || exitPreview) {
        const phases = exitPreview ? exitPhases : activeExitPhases;
        const startTime = exitPreview ? timeline.entryEnd : exitStartTimeline;
        const elapsed = Math.max(0, time - startTime);
        const progress = clamp01(elapsed / Math.max(1, phases.splashFadeDuration));
        const easedExit = cubicBezier(progress, ...phases.curve);
        const fromScale = phases.fromScale ?? exitStartScale;
        currentScale = lerp(fromScale, phases.toScale, easedExit);
        opacity = String(1 - easedExit);
      } else {
        currentScale = pushScale(time);
      }
      composition.style.transform = `scale(${currentScale})`;
      composition.style.opacity = opacity;
    }
    function render(time, exitPreview = false) {
      currentTime = Math.max(0, exitPreview || exiting ? time : Math.min(time, timeline.entryEnd));
      if (debug) root.dataset.timelineMs = String(Math.round(currentTime));
      applyComposition(currentTime, exitPreview);
      const cssWidth = wordmarkWidth();
      setGeometry(currentTime);
      glow.style.setProperty("--splash-glow-alpha", String(glowAlpha(currentTime)));
      streak.style.opacity = String(streakAlpha(currentTime));
      streakCore.style.opacity = String(streakAlpha(currentTime));
      updateSliceReveal(currentTime, currentScale, cssWidth);

      if (actualVersion === "reducedMotion") {
        reducedMark.setAttribute("opacity", String(clamp01(currentTime / spec.reducedMotion.fadeIn)));
        return;
      }
    }
    function notifyNativeStartupSound() {
      if (window.__SEVEN_STARTUP_SOUND_ENABLED__ === false) return;
      try {
        if (localStorage.getItem(spec.soundStorageKey) === "false") return;
      } catch { /* Sound defaults to enabled when browser storage is unavailable. */ }
      try {
        if (typeof window.SEVENNative?.playSplashSting === "function") {
          window.SEVENNative.playSplashSting();
        } else if (window.webkit?.messageHandlers?.sevenSplashAudio) {
          window.webkit.messageHandlers.sevenSplashAudio.postMessage("play");
        } else if (window.chrome?.webview) {
          window.chrome.webview.postMessage({ type: "playSplashSting" });
        } else if (window.SEVEN_AUDIO_UNLOCKED === true || window.navigator.userActivation?.hasBeenActive === true) {
          const anotherTrackIsPlaying = [...document.querySelectorAll("audio,video")].some(media => !media.paused && !media.ended && media.volume > 0);
          if (!anotherTrackIsPlaying) {
            startupAudioPlayer = new Audio(spec.soundAssetUrl);
            startupAudioPlayer.volume = 0.251;
            startupAudioPlayer.play().catch(() => { startupAudioPlayer = null; });
          }
        }
      } catch { /* A missing asset or host bridge leaves the ident silent. */ }
    }
    function tick(timestamp) {
      raf = 0;
      if (destroyed) return;
      if (startTimestamp === null) startTimestamp = timestamp;
      const elapsed = Math.max(0, (timestamp - startTimestamp) * scale);
      const frameTime = exiting ? exitStartTimeline + Math.max(0, (timestamp - exitStartTime) * scale) : elapsed;
      render(frameTime);
      if (!firstFrameAudioNotified) {
        firstFrameAudioNotified = true;
        requestAnimationFrame(() => { if (!destroyed) notifyNativeStartupSound(); });
      }
      if (!exiting && elapsed >= timeline.entryEnd && !entryComplete) {
        entryComplete = true;
        onEntryComplete();
      }
      if (exiting) {
        if (frameTime - exitStartTimeline >= activeExitPhases.duration) {
          callbacks.onExitComplete?.();
          return;
        }
        raf = requestAnimationFrame(tick);
      } else if (!entryComplete) {
        raf = requestAnimationFrame(tick);
      }
    }
    function start() {
      if (destroyed || raf || startTimestamp !== null) return;
      raf = requestAnimationFrame(tick);
    }
    function finish() {
      if (destroyed || exiting) return;
      cancelAnimationFrame(raf);
      raf = 0;
      if (startTimestamp === null) startTimestamp = performance.now();
      render(timeline.entryEnd);
      entryComplete = true;
      onEntryComplete();
    }
    function exit({ skip = false } = {}) {
      if (destroyed || exiting) return;
      exiting = true;
      if (debug) root.dataset.phase = "exit";
      cancelAnimationFrame(raf);
      raf = 0;
      exitStartScale = currentScale;
      const factor = skip ? spec.skipExitFactor : 1;
      activeExitPhases = {
        ...exitPhases,
        duration: exitPhases.duration * factor,
        splashFadeDuration: exitPhases.splashFadeDuration * factor,
        screenDelay: exitPhases.screenDelay * factor,
        screenFadeDuration: exitPhases.screenFadeDuration * factor,
        fromScale: skip ? exitStartScale : (exitPhases.fromScale ?? exitStartScale),
      };
      exitStartTime = performance.now();
      exitStartTimeline = currentTime;
      callbacks.onExitStart?.({
        ...activeExitPhases,
        timeScale: scale,
        screenDelayWallMs: activeExitPhases.screenDelay / Math.max(0.01, scale),
        screenFadeWallMs: activeExitPhases.screenFadeDuration / Math.max(0.01, scale),
      });
      raf = requestAnimationFrame(tick);
    }
    function debugSeek(time) {
      if (!debug || destroyed) return false;
      const target = Math.max(0, Number(time) || 0);
      if (target > timeline.entryEnd) {
        exitStartScale = pushScale(timeline.entryEnd);
        exitStartTimeline = timeline.entryEnd;
        activeExitPhases = { ...exitPhases, fromScale: exitPhases.fromScale ?? exitStartScale };
        render(target, true);
        root.dataset.phase = "exit";
        root.dataset.exitProgress = String(clamp01((target - timeline.entryEnd) / exitPhases.duration));
      } else {
        render(target);
        root.dataset.phase = "entry";
        delete root.dataset.exitProgress;
      }
      return true;
    }
    function trySkip() {
      if (destroyed || exiting || startTimestamp === null) return;
      const elapsed = (performance.now() - startTimestamp) * scale;
      if (elapsed >= spec.skipAfter) callbacks.onSkip?.();
    }
    function onResize() {
      if (destroyed) return;
      const cssWidth = wordmarkWidth();
      setGeometry(currentTime);
      updateSliceReveal(currentTime, currentScale, cssWidth);
    }
    const onPointer = () => trySkip();
    const onKey = event => { if (!event.defaultPrevented && !event.repeat) trySkip(); };
    root.addEventListener("pointerdown", onPointer, { passive: true });
    root.addEventListener("click", onPointer, { passive: true });
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onResize, { passive: true });
    window.visualViewport?.addEventListener("resize", onResize, { passive: true });
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      root.removeEventListener("pointerdown", onPointer);
      root.removeEventListener("click", onPointer);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      root.remove();
    }

    return { element: root, start, finish, exit, destroy, debugSeek: debug ? debugSeek : null, get version() { return actualVersion; } };
  }
  function mountDebugControls(onReplay) {
    if (new URLSearchParams(window.location.search).get("splashDebug") !== "1" || new URLSearchParams(window.location.search).get("splashClean") === "1") return null;
    const panel = document.createElement("aside");
    panel.className = "splash-debug";
    panel.setAttribute("aria-label", "SEVEN splash preview controls");
    panel.innerHTML = `<label>Version <select data-splash-version aria-label="Splash version"><option value="full">Full</option><option value="short">Short</option></select></label><label>Speed <select data-splash-scale aria-label="Splash speed"><option value="1">1×</option><option value="0.25">0.25×</option></select></label><label>Stagger ms <input data-splash-stagger aria-label="Slice stagger in milliseconds" type="number" min="0" max="300" step="5"></label><label>Slice ms <input data-splash-slice-duration aria-label="Slice duration in milliseconds" type="number" min="1" max="900" step="10"></label><label>Glint start ms <input data-splash-glint-start aria-label="Glint start in milliseconds" type="number" min="0" max="5000" step="25"></label><label>Glint duration ms <input data-splash-glint-duration aria-label="Glint duration in milliseconds" type="number" min="1" max="2000" step="25"></label><button type="button" data-splash-replay>Replay</button>`;
    panel.querySelector("[data-splash-version]").value = validVersion(new URLSearchParams(window.location.search).get("splashVersion"));
    panel.querySelector("[data-splash-scale]").value = Number(new URLSearchParams(window.location.search).get("splashScale")) === 0.25 ? "0.25" : "1";
    panel.querySelector("[data-splash-stagger]").value = Number(new URLSearchParams(window.location.search).get("splashSliceStagger")) || spec.sliceReveal.staggerMs;
    panel.querySelector("[data-splash-slice-duration]").value = Number(new URLSearchParams(window.location.search).get("splashSliceDuration")) || spec.sliceReveal.durationMs;
    panel.querySelector("[data-splash-glint-start]").value = Number(new URLSearchParams(window.location.search).get("splashGlintStart")) || spec.full.glint.start;
    panel.querySelector("[data-splash-glint-duration]").value = Number(new URLSearchParams(window.location.search).get("splashGlintDuration")) || spec.full.glint.duration;
    panel.querySelector("[data-splash-version]").addEventListener("change", event => {
      const glint = spec[validVersion(event.target.value)].glint;
      panel.querySelector("[data-splash-glint-start]").value = glint.start;
      panel.querySelector("[data-splash-glint-duration]").value = glint.duration;
    });
    panel.querySelector("[data-splash-replay]").addEventListener("click", () => {
      onReplay?.({
        version: panel.querySelector("[data-splash-version]").value,
        scale: Number(panel.querySelector("[data-splash-scale]").value) || 1,
        sliceStaggerMs: Math.max(0, Number(panel.querySelector("[data-splash-stagger]").value) || 0),
        sliceDurationMs: Math.max(1, Number(panel.querySelector("[data-splash-slice-duration]").value) || 1),
        glintStartMs: Math.max(0, Number(panel.querySelector("[data-splash-glint-start]").value) || 0),
        glintDurationMs: Math.max(1, Number(panel.querySelector("[data-splash-glint-duration]").value) || 1),
      });
    });
    document.body.appendChild(panel);
    return panel;
  }

  window.SEVENSplash = Object.freeze({ resolveLaunchOptions, createOverlay, mountDebugControls, reducedMotionRequested });
})();
