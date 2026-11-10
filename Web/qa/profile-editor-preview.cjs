// Isolated screenshots for the Create/Edit Profile screen. APIs return fixtures;
// the script never reads or writes the signed-in user's browser storage.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require(process.env.SEVEN_PLAYWRIGHT_PATH || "playwright");
const root = path.resolve(__dirname, "..");
const output = path.join(os.tmpdir(), "seven-profile-editor-preview");
const mime = { ".css":"text/css", ".html":"text/html", ".js":"application/javascript", ".json":"application/json", ".png":"image/png", ".svg":"image/svg+xml", ".webp":"image/webp" };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const file = path.resolve(root, `.${url.pathname === "/" ? "/index.html" : url.pathname}`);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream");
  res.end(fs.readFileSync(file));
});

async function main() {
  fs.mkdirSync(output, { recursive:true });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel:"chrome", headless:true });
  try {
    const viewports = [
      { width:390, height:844, label:"390x844" },
      { width:360, height:740, label:"360x740" },
      { width:768, height:1024, label:"768x1024" },
      { width:1440, height:900, label:"1440x900" }
    ];
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport:{ width:viewport.width, height:viewport.height }, serviceWorkers:"block" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.addInitScript(() => localStorage.setItem("seven.account.settings", JSON.stringify({ preferences:{ introEnabled:false } })));
      await page.route("**/api/**", route => {
        const url = new URL(route.request().url());
        const payload = url.pathname === "/api/account/settings"
          ? { id:"profile-editor-qa", email:"qa@example.test" }
          : { results:[], total_pages:1 };
        return route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(payload) });
      });
      await page.route(url => !url.href.startsWith(origin), route => route.abort());
      await page.goto(origin, { waitUntil:"domcontentloaded" });
      await page.waitForFunction(() => typeof state === "object" && document.querySelector("#app"));
      await page.waitForFunction(() => state.startupReady === true, null, { timeout:30000 });
      async function editor({ name="", edit=false } = {}) {
        await page.evaluate(({ name, edit }) => {
          const avatar = edit ? "assets/avatars/red-panda.png" : undefined;
          const profile = { id:edit ? "existing" : "draft", name, kids:false, ...(avatar ? { avatar } : {}) };
          state.user = { id:"profile-editor-qa", email:"qa@example.test" };
          state.session = { access_token:"fixture", expires_at:Math.floor(Date.now()/1000)+3600, user:state.user };
          state.account = { activeProfileId:null, profiles:[{ id:"main", name:"Main", kids:false, avatar:"assets/avatars/red-panda.png" }, profile], preferences:{ ...DEFAULT_PREFERENCES } };
          state.profileDraft = { ...profile };
          state.profileSettingsReturn = "profiles";
          state.profileSettingsCategory = "profile";
          state.profileEditorIsNew = !edit;
          state.route = "profile-settings";
          render();
        }, { name, edit });
        await page.waitForSelector("[data-profile-editor]");
        await page.waitForTimeout(180);
      }
      async function capture(stateName) {
        const pathName = path.join(output, `profile-${stateName}.png`);
        await page.screenshot({ path:pathName });
        const metrics = await page.locator("[data-profile-editor]").evaluate(el => ({
          title:el.querySelector("h1")?.textContent,
          isNew:state.profileEditorIsNew,
          button:el.querySelector("[type=submit] .profile-editor-submit-label")?.textContent,
          nameValue:el.querySelector("#profile-editor-name")?.value,
          nameStyle:(() => { const style=getComputedStyle(el.querySelector("#profile-editor-name")); return {color:style.color,textFill:style.webkitTextFillColor,opacity:style.opacity,visibility:style.visibility,fontSize:style.fontSize,textAlign:style.textAlign}; })(),
          width:el.getBoundingClientRect().width,
          columnWidth:el.querySelector(".profile-editor-column")?.getBoundingClientRect().width,
          scrollWidth:el.scrollWidth,
          clientWidth:el.clientWidth,
          avatarChoiceCount:el.querySelectorAll(".profile-editor-avatar-choice").length,
          initialChoiceCount:el.querySelectorAll('[data-avatar-choice="initial"]').length,
          selectedAvatar:el.querySelector('.profile-editor-avatar-choice[aria-checked="true"]')?.dataset.avatarChoice || null,
          previewImage:el.querySelector("[data-avatar-preview] img")?.getAttribute("src") || null,
          previewLeft:el.querySelector("[data-avatar-preview]")?.getBoundingClientRect().left,
          pickerLeft:el.querySelector(".profile-editor-avatar-picker")?.getBoundingClientRect().left,
          gridColumns:getComputedStyle(el.querySelector(".profile-editor-avatar-grid")).gridTemplateColumns,
          submitBottom:el.querySelector("[type=submit]").getBoundingClientRect().bottom,
          viewportHeight:innerHeight
        }));
        assert.equal(metrics.scrollWidth <= metrics.clientWidth, true, `horizontal overflow: ${stateName} ${viewport.label}`);
        assert.equal(metrics.avatarChoiceCount, 6, `picker should contain six preset avatars: ${stateName} ${viewport.label}`);
        assert.equal(metrics.initialChoiceCount, 0, `picker should not contain the blank initial tile: ${stateName} ${viewport.label}`);
        assert.equal(metrics.selectedAvatar, metrics.isNew ? "preset-1" : "preset-0", `profile should select the first unused avatar or preserve its existing selection: ${stateName} ${viewport.label}`);
        assert.equal(metrics.previewImage, metrics.isNew ? "assets/avatars/black-cat.webp" : "assets/avatars/red-panda.webp", `preview should show the selected avatar immediately: ${stateName} ${viewport.label}`);
        if (viewport.width >= 700) {
          assert.ok(metrics.columnWidth > 600, `desktop editor should use the wide layout: ${stateName} ${viewport.label}`);
          assert.ok(metrics.pickerLeft > metrics.previewLeft, `desktop picker should sit beside the profile preview: ${stateName} ${viewport.label}`);
        }
        return { file:pathName, metrics };
      }

      await editor();
      const captures = [];
      if (viewport.width < 600) {
        captures.push(await capture(`empty-${viewport.label}`));
        await page.locator("#profile-editor-name").fill("Jamie");
        await page.locator("#profile-editor-name").evaluate(el => el.blur());
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(240);
        captures.push(await capture(`typing-${viewport.label}`));
        await page.locator("#profile-editor-name").fill("Alexandria Worthington");
        await page.locator("#profile-editor-name").evaluate(el => el.blur());
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(240);
        captures.push(await capture(`long-name-${viewport.label}`));
        await page.locator("#profile-editor-name").fill("");
        await page.locator("#profile-editor-name").focus();
        await page.locator("#profile-editor-name").evaluate(el => el.blur());
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(240);
        captures.push(await capture(`error-${viewport.label}`));
        await editor({ name:"Jamie", edit:true });
        captures.push(await capture(`edit-${viewport.label}`));
      } else {
        captures.push(await capture(`empty-${viewport.label}`));
        await editor({ name:"Jamie", edit:true });
        captures.push(await capture(`edit-${viewport.label}`));
      }
      if (viewport.width === 390) {
        await page.locator("#profile-editor-name").focus();
        await page.setViewportSize({ width:390, height:420 });
        await page.waitForTimeout(180);
        const keyboardMetrics = await page.locator("#profile-editor-name").evaluate(input => ({
          inputTop:input.getBoundingClientRect().top,
          inputBottom:input.getBoundingClientRect().bottom,
          buttonBottom:document.querySelector(".profile-editor-submit").getBoundingClientRect().bottom,
          viewportHeight:innerHeight
        }));
        assert.ok(keyboardMetrics.inputTop >= 0 && keyboardMetrics.inputBottom <= keyboardMetrics.viewportHeight, "focused name field should remain in view while the viewport is keyboard-sized");
        assert.ok(keyboardMetrics.buttonBottom <= keyboardMetrics.viewportHeight - 19, "primary action should sit above the keyboard");
        console.log(JSON.stringify({ keyboardViewport:keyboardMetrics }));
      }
      if (viewport.width === 360) {
        await page.locator("#profile-editor-name").fill("Alexandria Worthington");
        const textScaleMetrics = await page.evaluate(() => {
          const baseRootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
          document.documentElement.style.fontSize = `${baseRootFontSize * 1.3}px`;
          window.dispatchEvent(new Event("resize"));
          const input = document.querySelector("#profile-editor-name"), style = getComputedStyle(input), canvas = document.createElement("canvas"), context = canvas.getContext("2d");
          context.font = style.font;
          return { baseRootFontSize, rootFontSize:parseFloat(getComputedStyle(document.documentElement).fontSize), inputFontSize:parseFloat(style.fontSize), inputWidth:input.clientWidth, nameTextWidth:context.measureText(input.value).width, scrollWidth:document.querySelector("[data-profile-editor]").scrollWidth, clientWidth:document.querySelector("[data-profile-editor]").clientWidth };
        });
        assert.ok(textScaleMetrics.scrollWidth <= textScaleMetrics.clientWidth, "profile editor should not overflow horizontally at 1.3x font scale");
        assert.ok(textScaleMetrics.inputFontSize / textScaleMetrics.baseRootFontSize >= 1.2, "profile name input should remain accessible at 1.3x font scale");
        assert.ok(textScaleMetrics.nameTextWidth <= textScaleMetrics.inputWidth, "long profile names should fit at 1.3x font scale");
        console.log(JSON.stringify({ fontScale:textScaleMetrics }));
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(160);
        captures.push(await capture(`font-1.3-${viewport.label}`));
      }
      assert.deepEqual(errors, [], `browser errors at ${viewport.label}`);
      console.log(JSON.stringify({ viewport:viewport.label, captures }));
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
