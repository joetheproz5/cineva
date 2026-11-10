(() => {
  "use strict";

  const output = document.getElementById("splash-test-output");
  const result = { viewport: `${window.innerWidth}×${window.innerHeight}`, tolerance: "±1% of target ratio", measurements: [] };
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  function bezier(value, [x1, y1, x2, y2]) {
    const curve = (t, a, b) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
    let low = 0;
    let high = 1;
    for (let i = 0; i < 20; i += 1) {
      const middle = (low + high) / 2;
      if (curve(middle, x1, x2) < value) low = middle;
      else high = middle;
    }
    return curve((low + high) / 2, y1, y2);
  }

  (async () => {
    try {
      const handle = window.SEVENSplash.createOverlay({ version:"full", scale:1, debug:true });
      window.__splashTestHandle = handle;
      document.body.appendChild(handle.element);
      handle.debugSeek(0);
      const mark = handle.element.querySelector(".splash-wordmark");
      const baseWidth = mark.getBoundingClientRect().width;
      assert(baseWidth > 0, "The SVG wordmark must have a measurable base width.");

      const targets = [
        { time:1300, ratio:1.03 },
        { time:2400, ratio:1.05 },
        { time:2700, ratio:1.05 + (1.18 - 1.05) * bezier(300 / window.SplashSpec.full.exit.splashFadeDuration, [0.5, 0, 0.75, 0]) },
      ];
      for (const target of targets) {
        handle.debugSeek(target.time);
        const width = mark.getBoundingClientRect().width;
        const ratio = width / baseWidth;
        const tolerance = target.ratio * 0.01;
        result.measurements.push({
          timeMs:target.time,
          widthPx:Number(width.toFixed(2)),
          ratio:Number(ratio.toFixed(5)),
          expectedRatio:Number(target.ratio.toFixed(5)),
          tolerance:Number(tolerance.toFixed(5)),
          pass:Math.abs(ratio - target.ratio) <= tolerance,
        });
        assert(Math.abs(ratio - target.ratio) <= tolerance, `${target.time} ms width ratio ${ratio.toFixed(5)} is outside ±1% of ${target.ratio.toFixed(5)}.`);
      }
      result.baseWidthPx = Number(baseWidth.toFixed(2));
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
})();
