import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mime = new Map([[".css", "text/css; charset=utf-8"], [".html", "text/html; charset=utf-8"], [".js", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".svg", "image/svg+xml"], [".webp", "image/webp"], [".png", "image/png"], [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"]]);
const browserCandidates = [
  process.env.CHROME_BIN,
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/microsoft-edge",
].filter(Boolean);
const browserPath = browserCandidates.find(candidate => fs.existsSync(candidate));
if (!browserPath) throw new Error("Headless Chrome or Edge was not found; set CHROME_BIN to its executable.");

const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  if (url.pathname.startsWith("/api/")) {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ page: 1, results: [], total_pages: 1, total_results: 0, id: 0, name: "", title: "", genres: [], credits: { cast: [], crew: [] }, content_ratings: { results: [] }, videos: { results: [] }, recommendations: { results: [] }, similar: { results: [] }, images: { posters: [], backdrops: [] }, release_dates: { results: [] }, external_ids: {} }));
    return;
  }
  const relative = decodeURIComponent(url.pathname === "/" ? "index.html" : url.pathname.replace(/^\//, ""));
  const filePath = path.resolve(webRoot, relative);
  if (!filePath.startsWith(`${webRoot}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": mime.get(path.extname(filePath).toLowerCase()) || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(contents);
  });
});

const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "seven-browser-smoke-"));
let browser;
let socket;
let nextId = 0;
let sessionId;
const pending = new Map();
const cssResponses = new Map();
const consoleErrors = [];

function cdpSend(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}`));
      }
    }, 10000).unref();
  });
}

async function connectCdp(wsUrl) {
  socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result || {});
      return;
    }
    if (message.method === "Network.responseReceived" && message.params.type === "Stylesheet") {
      const { response } = message.params;
      cssResponses.set(response.url, { status: response.status, contentType: response.mimeType });
    }
    if (message.method === "Runtime.exceptionThrown") consoleErrors.push(message.params.exceptionDetails.text || "uncaught browser exception");
    if (message.method === "Log.entryAdded" && message.params.entry.level === "error") consoleErrors.push(`${message.params.entry.text}${message.params.entry.url ? ` (${message.params.entry.url})` : ""}`);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      consoleErrors.push(message.params.args.map(arg => arg.value || arg.description || "").join(" "));
    }
    if (message.method === "Fetch.requestPaused") {
      const { requestId, request } = message.params;
      const command = request.url.startsWith("https://cinesrc.st/")
        ? cdpSend("Fetch.fulfillRequest", { requestId, responseCode:200, responseHeaders:[{ name:"Content-Type", value:"text/html; charset=utf-8" }], body:Buffer.from("<!doctype html><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><style>html,body{margin:0;width:100%;height:100%;background:#000}</style><title>Player smoke stub</title>").toString("base64") })
        : cdpSend("Fetch.continueRequest", { requestId });
      command.catch(error => consoleErrors.push(`Player request interception failed: ${error.message}`));
    }
  });
}

async function evaluate(expression) {
  const result = await cdpSend("Runtime.evaluate", { expression, awaitPromise:true, returnByValue:true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Browser evaluation failed.");
  return result.result?.value;
}

try {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  browser = spawn(browserPath, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
    "--remote-debugging-port=0", "--remote-allow-origins=*", `--user-data-dir=${tempRoot}`,
    "about:blank",
  ], { stdio: "ignore", windowsHide: true });

  const activePort = path.join(tempRoot, "DevToolsActivePort");
  let devtoolsPort;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (browser.exitCode !== null) throw new Error(`Headless browser exited with code ${browser.exitCode}`);
    if (fs.existsSync(activePort)) {
      devtoolsPort = Number((await fs.promises.readFile(activePort, "utf8")).split(/\r?\n/)[0]);
      break;
    }
    await delay(100);
  }
  if (!devtoolsPort) throw new Error("Headless browser did not expose its DevTools endpoint.");
  const version = await (await fetch(`http://127.0.0.1:${devtoolsPort}/json/version`)).json();
  await connectCdp(version.webSocketDebuggerUrl);
  const target = await cdpSend("Target.createTarget", { url: "about:blank" });
  sessionId = (await cdpSend("Target.attachToTarget", { targetId: target.targetId, flatten: true })).sessionId;
  await cdpSend("Page.enable");
  await cdpSend("Runtime.enable");
  await cdpSend("Network.enable");
  await cdpSend("Log.enable");
  await cdpSend("Page.navigate", { url: `http://127.0.0.1:${port}/` });

  let pageState;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await delay(250);
    const result = await cdpSend("Runtime.evaluate", { expression: `JSON.stringify({ready:document.readyState,nav:!!document.querySelector('nav[aria-label="Main navigation"]'),links:[...document.querySelectorAll('link[rel="stylesheet"]')].map(link=>link.href)})`, returnByValue: true });
    try { pageState = JSON.parse(result.result.value); } catch { /* The app is still booting. */ }
    if (pageState?.ready === "complete" && pageState.nav) break;
  }
  await delay(1500);
  const failedCss = [...cssResponses].filter(([url, response]) => url.endsWith(".css") || url.includes(".css?"))
    .filter(([, response]) => response.status !== 200 || !response.contentType?.toLowerCase().includes("text/css"));
  const notSeen = (pageState?.links || []).filter(url => !cssResponses.has(url));
  if (!pageState?.nav) throw new Error("Headless smoke check failed: main navigation is missing.");
  if (failedCss.length || notSeen.length) throw new Error(`Headless smoke check failed for stylesheets: ${JSON.stringify({ failedCss, notSeen, cssResponses:[...cssResponses] })}`);
  if (consoleErrors.length) throw new Error(`Headless smoke check saw console errors: ${consoleErrors.join("\n")}`);
  const rootOverscroll = await evaluate(`({html:getComputedStyle(document.documentElement).overscrollBehaviorY,body:getComputedStyle(document.body).overscrollBehaviorY})`);
  if (rootOverscroll.html !== "none" || rootOverscroll.body !== "none") throw new Error(`Pull-to-refresh prevention is missing from the root scroll surfaces: ${JSON.stringify(rootOverscroll)}`);
  await cdpSend("Emulation.setDeviceMetricsOverride", { width:390, height:844, deviceScaleFactor:1, mobile:true });
  const primitiveCheck = await evaluate(`(async()=>{
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const opener=document.createElement("button");opener.type="button";opener.textContent="Open sheet";document.body.append(opener);opener.focus();
    const makeSheet=()=>{document.body.insertAdjacentHTML("beforeend",'<div class="modal seven-bottom-sheet"><section class="auth-card seven-bottom-sheet-panel" tabindex="-1"><button type="button" id="sheet-first">First</button><button type="button" id="sheet-last">Last</button></section></div>');return document.querySelector(".seven-bottom-sheet")};
    let overlay=makeSheet(),panel=overlay.querySelector(".seven-bottom-sheet-panel");
    window.SEVENBottomSheet.open({overlay,panel,opener,initialFocus:"#sheet-first"});await wait(40);
    const duration=getComputedStyle(panel).transitionDuration;
    const openingOpacity=parseFloat(getComputedStyle(panel).opacity);
    const safePadding=parseFloat(getComputedStyle(panel).paddingBottom)||0;
    document.activeElement.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",shiftKey:true,bubbles:true,cancelable:true}));
    const trapped=document.activeElement.id==="sheet-last";
    document.activeElement.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}));await wait(260);
    const escaped=!document.querySelector(".seven-bottom-sheet")&&document.activeElement===opener;
    overlay=makeSheet();panel=overlay.querySelector(".seven-bottom-sheet-panel");window.SEVENBottomSheet.open({overlay,panel,opener,initialFocus:"#sheet-first"});await wait(40);
    overlay.dispatchEvent(new MouseEvent("click",{bubbles:true}));await wait(260);
    const backdrop=!document.querySelector(".seven-bottom-sheet")&&document.activeElement===opener;
    opener.remove();
    return {trapped,escaped,backdrop,duration,openingOpacity,safePadding};
  })()`);
  if (!primitiveCheck?.trapped || !primitiveCheck?.escaped || !primitiveCheck?.backdrop || !primitiveCheck.duration.includes("0.2") || !(primitiveCheck.openingOpacity > 0 && primitiveCheck.openingOpacity < 1) || primitiveCheck.safePadding < 24) {
    throw new Error(`Shared bottom-sheet smoke check failed: ${JSON.stringify(primitiveCheck)}`);
  }

  await cdpSend("Fetch.enable", { patterns:[{ urlPattern:"https://cinesrc.st/*", requestStage:"Request" }] });
  const watchPageCheck = await evaluate(`(async()=>{
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const until=async test=>{for(let i=0;i<80;i++){if(test())return true;await wait(50)}return false};
    state.user=null;state.account=defaultAccount();state.account.activeProfileId="main";
    state.series={id:901,name:"Smoke Series",overview:"Local smoke fixture",number_of_episodes:2,seasons:[{season_number:1},{season_number:2}]};
    state.selectedSeason=1;state.episodes={episodes:[{episode_number:1,name:"Pilot",overview:"First episode",still_path:null,vote_average:8.1}]};state.episodesSeriesId=901;state.episodesSeason=1;
    state.player={type:"tv",id:901,season:1,episode:1,title:"Pilot",overview:"First episode",posterPath:null,genreIds:[],startAt:0};state.route="player";render();
    const frame=document.querySelector("iframe.player");if(!frame)throw Error("watch smoke could not render iframe");
    const tracked=window.__sevenWatchFrameTracking={node:frame,src:frame.src,loads:0};frame.addEventListener("load",()=>tracked.loads++);
    api=async path=>({episodes:[{episode_number:1,name:"Season "+state.selectedSeason+" pilot",overview:"Season fixture",still_path:null,vote_average:8.2}]});
    partyConnect=async(code,role)=>{party.code=code;party.role=role;party.error="";party.pollError="";party.sendError="";party.members={};party.socket={close(){}}};
    partySend=async()=>true;partyBroadcastState=()=>{};
    await until(()=>tracked.loads>0);await wait(100);
    const stable=()=>document.querySelector("iframe.player")===tracked.node&&tracked.node.src===tracked.src;
    const baselineLoads=tracked.loads;
    document.querySelector("[data-party-modal]")?.click();await wait(30);
    const modalOpened=Boolean(document.querySelector(".party-modal"))&&stable();
    document.querySelector("[data-party-modal-close]")?.click();await until(()=>!document.querySelector(".party-modal"));await wait(30);
    const modalClosed=stable();
    document.querySelector("[data-party-modal]")?.click();await wait(20);
    document.querySelector("[data-party-start-modal]")?.click();await until(()=>Boolean(party.code));await wait(30);
    const hosted=Boolean(party.code)&&party.role==="host"&&Boolean(document.querySelector(".party-panel"))&&stable();
    showPartyModal();await wait(20);document.querySelector("[data-party-modal-close]")?.click();await until(()=>!document.querySelector(".party-modal"));
    party.code=null;party.role=null;party.socket=null;party.error="";
    showPartyModal();await wait(20);
    const joinInput=document.querySelector(".party-join-row input");joinInput.value="SMOKE42";joinInput.dispatchEvent(new Event("input",{bubbles:true}));
    document.querySelector("[data-party-join-modal]")?.click();await until(()=>party.role==="guest");await wait(30);
    const joined=party.role==="guest"&&Boolean(document.querySelector(".party-panel"))&&stable();
    const seasonButton=document.querySelector('[data-player-season="2"]');seasonButton?.click();
    const seasonChanged=await until(()=>state.selectedSeason===2&&document.querySelector('[data-player-season="2"]')?.getAttribute("aria-current")==="true");await wait(60);
    const seasonStable=stable();
    const afterActionsLoads=tracked.loads;
    window.scrollTo(0,0);await wait(30);
    const geometry=()=>{const rect=tracked.node.parentElement.getBoundingClientRect();return {width:rect.width,height:rect.height,ratio:rect.width/rect.height,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,innerHeight:innerHeight,scrollY:scrollY}};
    const hitTest=()=>{const rect=tracked.node.getBoundingClientRect(),hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);return {ok:Boolean(hit&&tracked.node.parentElement.contains(hit)),tag:hit?.tagName||null,className:hit?.className||null}};
    return {src:tracked.src,title:tracked.node.title,baselineLoads,afterActionsLoads,stable:modalOpened&&modalClosed&&hosted&&joined&&seasonChanged&&seasonStable&&stable(),modalOpened,modalClosed,hosted,joined,seasonChanged,seasonStable,identity:document.querySelector("iframe.player")===tracked.node,hitTest:hitTest(),geometry:geometry()};
  })()`);
  if (!watchPageCheck?.stable || !watchPageCheck?.identity || watchPageCheck.title !== "Video player: Pilot" || !watchPageCheck?.hitTest?.ok || watchPageCheck.afterActionsLoads !== watchPageCheck.baselineLoads || Math.abs(watchPageCheck.geometry.ratio - 16 / 9) > .03) {
    throw new Error(`Watch-page iframe smoke check failed: ${JSON.stringify(watchPageCheck)}`);
  }
  const screenshotDir = process.env.SEVEN_SCREENSHOT_DIR ? path.resolve(process.env.SEVEN_SCREENSHOT_DIR) : null;
  if (screenshotDir) await fs.promises.mkdir(screenshotDir, { recursive:true });
  for (const width of [390, 360, 486, 768, 1024, 1440]) {
    const mobile = width < 651, height = width === 390 ? 844 : width === 360 ? 740 : width === 486 ? 830 : width === 768 ? 1024 : width === 1024 ? 768 : 900;
    await cdpSend("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor:1, mobile });
    const sizeAtWidth = await evaluate(`(()=>{const frame=window.__sevenWatchFrameTracking?.node,rect=frame?.parentElement?.getBoundingClientRect();return Boolean(frame&&document.querySelector("iframe.player")===frame&&frame.src===window.__sevenWatchFrameTracking.src&&rect&&Math.abs(rect.width/rect.height-16/9)<.03&&document.documentElement.scrollWidth<=innerWidth+1&&(!${mobile}||Math.abs(rect.width-innerWidth)<1))})()`);
    if (!sizeAtWidth) throw new Error(`Watch-page iframe changed, overflowed, or lost full-bleed 16:9 sizing at ${width}px.`);
    if (screenshotDir) {
      const screenshot = await cdpSend("Page.captureScreenshot", { format:"png", fromSurface:true, captureBeyondViewport:false });
      await fs.promises.writeFile(path.join(screenshotDir, `watch-${width}.png`), Buffer.from(screenshot.data, "base64"));
    }
  }
  await cdpSend("Emulation.clearDeviceMetricsOverride");
  if (consoleErrors.length) throw new Error(`Headless smoke check saw console errors: ${consoleErrors.join("\n")}`);
  console.log(`Headless browser smoke passed: nav present, ${pageState.links.length} stylesheets returned 200 text/css, no console errors; shared bottom sheet keyboard/backdrop/focus checks passed; watch-page iframe identity and src stayed stable (${watchPageCheck.afterActionsLoads} load events) through modal, host/join panel, season switch, and 360/390/486/768/1024/1440px sizing.${screenshotDir ? ` Screenshots: ${screenshotDir}` : ""}`);
} finally {
  try { socket?.close(); } catch { /* already closed */ }
  if (browser && browser.exitCode === null) {
    browser.kill();
    await new Promise(resolve => browser.once("exit", resolve));
  }
  server.close();
  const resolvedTemp = path.resolve(tempRoot);
  const tempBase = path.resolve(os.tmpdir());
  if (resolvedTemp.startsWith(`${tempBase}${path.sep}`) && resolvedTemp.includes("seven-browser-smoke-")) {
    await fs.promises.rm(resolvedTemp, { recursive: true, force: true });
  }
}
