(() => {
  const accent = "#e0010b";
  const accentRgb = "224,1,11";
  const bg0 = "#020203";
  const hot = "rgba(255,255,255,0.9)";
  const sliceReveal = Object.freeze({ staggerMs: 55, durationMs: 380 });

  const spec = Object.freeze({
    version: 1,
    colors: Object.freeze({
      accent,
      accentRgb,
      bg0,
      hot,
      glint: "#ffffff",
      glintAlpha: 0.4,
      glowX: "50%",
      glowY: "48%",
      glowRadius: "48%",
      streakHorizontal: `linear-gradient(90deg, transparent 0%, rgba(${accentRgb}, 0) 35%, rgba(${accentRgb}, 0.36) 45%, rgba(${accentRgb}, 0.52) 50%, rgba(${accentRgb}, 0.36) 55%, transparent 65%)`,
      streakFalloff: `linear-gradient(180deg, rgba(${accentRgb}, 0) 0%, rgba(${accentRgb}, 0.12) 24%, rgba(${accentRgb}, 0.52) 50%, rgba(${accentRgb}, 0.12) 76%, rgba(${accentRgb}, 0) 100%)`,
    }),
    layout: Object.freeze({
      wordmarkWidthMin: 220,
      wordmarkWidthMax: 640,
      wordmarkWidthFactor: 0.6,
      wordmarkHeightFactor: 1.6,
      wordmarkViewBoxWidth: 1544,
      wordmarkViewBoxHeight: 407,
      streakHeight: 24,
      lineHeight: 2,
      streakWidthMax: 1.18,
    }),
    sliceReveal,
    glintFadeFraction: 0.1,
    full: Object.freeze({
      duration: 2850,
      entryEnd: 2400,
      glow: Object.freeze({ start: 0, end: 400, baseAlpha: 0.24 }),
      glowPulse: Object.freeze({ start: 800, peak: 1000, end: 1500, amplitude: 0.25 }),
      line: Object.freeze({ start: 300, end: 700, growthEnd: 600, maxWidth: 0.12 }),
      streak: Object.freeze({ start: 600, peak: 1000, full: 1100, fade: 1500, settle: 2000, finalAlpha: 0.15, startAlpha: 0.75 }),
      slices: Object.freeze({ start: 1000, count: 7, duration: sliceReveal.durationMs, delay: sliceReveal.staggerMs }),
      glint: Object.freeze({ start: 1450, duration: 550, widthFactor: 0.18, skewDegrees: -20 }),
      push: Object.freeze({ start: 0, end: 2400, from: 1, to: 1.05, curve: Object.freeze([0.35, 0, 0.65, 1]) }),
      exit: Object.freeze({ duration: 500, splashFadeDuration: 350, screenDelay: 150, screenFadeDuration: 350, fromScale: 1.05, toScale: 1.18, easing: "cubic-bezier(0.5,0,0.75,0)", screenEasing: "cubic-bezier(0.22,1,0.36,1)" }),
    }),
    short: Object.freeze({
      duration: 1800,
      entryEnd: 1400,
      glow: Object.freeze({ start: 0, end: 0, baseAlpha: 0.24, initialMultiplier: 0.6 }),
      glowPulse: Object.freeze({ start: 0, peak: 350, end: 850, amplitude: 0.25 }),
      line: Object.freeze({ start: 0, end: 0, growthEnd: 0, maxWidth: 0.12, initialAlpha: 0.6 }),
      streak: Object.freeze({ start: 0, peak: 350, full: 300, fade: 850, settle: 1400, finalAlpha: 0.15, startAlpha: 0.6 }),
      slices: Object.freeze({ start: 350, count: 7, duration: sliceReveal.durationMs, delay: sliceReveal.staggerMs }),
      glint: Object.freeze({ start: 900, duration: 400, widthFactor: 0.18, skewDegrees: -20 }),
      push: Object.freeze({ start: 0, end: 1400, from: 1, to: 1.05, curve: Object.freeze([0.35, 0, 0.65, 1]) }),
      exit: Object.freeze({ duration: 400, toScale: 1.18, easing: "cubic-bezier(0.5,0,0.75,0)" }),
    }),
    reducedMotion: Object.freeze({ duration: 900, entryEnd: 700, fadeIn: 200, hold: 500, exit: 200 }),
    skipAfter: 600,
    skipExitFactor: 0.6,
    readyTimeout: 5000,
    storageKey: "seven.startup.splash.v2",
    soundStorageKey: "seven.startup.sound",
    soundAssetUrl: "assets/splash_sting.mp3",
    pathUrl: window.SEVEN_SPLASH_PATH || "assets/seven-wordmark.svg#seven-wordmark-shape",
  });

  Object.defineProperty(window, "SplashSpec", { value: spec, configurable: false, enumerable: true });
  const root = document.documentElement;
  root.style.backgroundColor = bg0;
  root.style.colorScheme = "dark";
  root.style.setProperty("--splash-bg0", bg0);
  root.style.setProperty("--splash-accent", accent);
  root.style.setProperty("--splash-accent-rgb", accentRgb);
  root.style.setProperty("--splash-hot", hot);
  root.style.setProperty("--splash-glint", spec.colors.glint);
  root.style.setProperty("--splash-glint-alpha", String(spec.colors.glintAlpha));
  root.style.setProperty("--splash-glow-x", spec.colors.glowX);
  root.style.setProperty("--splash-glow-y", spec.colors.glowY);
  root.style.setProperty("--splash-glow-radius", spec.colors.glowRadius);
  root.style.setProperty("--splash-streak-horizontal", spec.colors.streakHorizontal);
  root.style.setProperty("--splash-streak-falloff", spec.colors.streakFalloff);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg0);
})();
