(() => {
  "use strict";

  const output = document.getElementById("splash-test-output");
  const spec = window.SplashSpec.full.exit;
  const curve = [0.5, 0, 0.75, 0];
  const frameStepMs = 1000 / 60;
  const result = {
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    sampleRangeMs: [2300, 2900],
    sampleRateHz: 60,
    frameSamples: [],
    scaleChecks: [],
  };
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  function bezier(value, [x1, y1, x2, y2]) {
    const curveAt = (t, a, b) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
    let low = 0;
    let high = 1;
    for (let i = 0; i < 24; i += 1) {
      const middle = (low + high) / 2;
      if (curveAt(middle, x1, x2) < value) low = middle;
      else high = middle;
    }
    return curveAt((low + high) / 2, y1, y2);
  }

  try {
    const handle = window.SEVENSplash.createOverlay({ version:"full", scale:1, debug:true });
    window.__splashTestHandle = handle;
    document.body.appendChild(handle.element);
    handle.debugSeek(0);
    const composition = handle.element.querySelector(".splash-composition");
    const wordmark = handle.element.querySelector(".splash-wordmark");
    const baseWidth = wordmark.getBoundingClientRect().width;
    assert(baseWidth > 0, "The SVG wordmark must have a measurable base width.");

    for (let frame = 0; frame <= 36; frame += 1) {
      const timeMs = frame === 36 ? 2900 : 2300 + frame * frameStepMs;
      handle.debugSeek(timeMs);
      const opacity = Number(composition.style.opacity);
      const scale = wordmark.getBoundingClientRect().width / baseWidth;
      result.frameSamples.push({ timeMs:Number(timeMs.toFixed(2)), opacity:Number(opacity.toFixed(5)), scale:Number(scale.toFixed(5)) });
    }

    let maxOpacityStep = 0;
    let monotonic = true;
    for (let index = 1; index < result.frameSamples.length; index += 1) {
      const delta = result.frameSamples[index].opacity - result.frameSamples[index - 1].opacity;
      maxOpacityStep = Math.max(maxOpacityStep, Math.abs(delta));
      if (delta > 0.00001) monotonic = false;
    }
    result.maxFrameOpacityDelta = Number(maxOpacityStep.toFixed(5));
    result.opacityIsMonotonic = monotonic;
    assert(maxOpacityStep <= 0.08, `Opacity changed ${maxOpacityStep.toFixed(5)} in one frame; limit is 0.08.`);
    assert(monotonic, "Splash opacity increased during the exit sample.");

    for (const timeMs of [2550, 2650, 2750]) {
      const progress = Math.max(0, Math.min(1, (timeMs - 2400) / spec.splashFadeDuration));
      const expected = spec.fromScale + (spec.toScale - spec.fromScale) * bezier(progress, curve);
      handle.debugSeek(timeMs);
      const rendered = wordmark.getBoundingClientRect().width / baseWidth;
      const tolerance = expected * 0.01;
      result.scaleChecks.push({ timeMs, renderedRatio:Number(rendered.toFixed(5)), expectedRatio:Number(expected.toFixed(5)), tolerance:Number(tolerance.toFixed(5)), pass:Math.abs(rendered - expected) <= tolerance });
      assert(Math.abs(rendered - expected) <= tolerance, `Scale at ${timeMs} ms was ${rendered.toFixed(5)}, expected ${expected.toFixed(5)} ±1%.`);
    }

    result.status = "PASS";
    document.documentElement.dataset.testStatus = "passed";
    output.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    result.status = "FAIL";
    result.error = error.message;
    document.documentElement.dataset.testStatus = "failed";
    output.textContent = JSON.stringify(result, null, 2);
    throw error;
  }
})();
