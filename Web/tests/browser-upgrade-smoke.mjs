import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const repoRoot = process.cwd();
const webRoot = path.join(repoRoot, "Web");
const previousFiles = new Map(["index.html", "app.js", "service-worker.js"].map(name => [name, execFileSync("git", ["show", `HEAD:Web/${name}`], { cwd:repoRoot })]));
const currentIndexHtml = fs.readFileSync(path.join(webRoot, "index.html"), "utf8");
const currentWatchCssHref = currentIndexHtml.match(/href="([^"]*watch-page\.css[^"]*)"/)?.[1];
const currentWatchCssRequest = currentWatchCssHref ? new URL(currentWatchCssHref, "http://seven.invalid/").pathname + new URL(currentWatchCssHref, "http://seven.invalid/").search : null;
const currentServiceWorker = fs.readFileSync(path.join(webRoot, "service-worker.js"), "utf8");
const previousCacheVersion = previousFiles.get("service-worker.js").toString("utf8").match(/const VERSION = "([^"]+)"/)?.[1];
const currentCacheVersion = currentServiceWorker.match(/const VERSION = "([^"]+)"/)?.[1];
if (!previousCacheVersion || !currentCacheVersion || !currentWatchCssRequest || previousCacheVersion === currentCacheVersion) throw new Error("The prior and current service-worker cache versions and the current watch-page stylesheet URL must exist and differ.");
const contentTypes = new Map([[".css", "text/css; charset=utf-8"], [".html", "text/html; charset=utf-8"], [".js", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".svg", "image/svg+xml"], [".webp", "image/webp"], [".png", "image/png"], [".jpg", "image/jpeg"]]);
const browserPath = [process.env.CHROME_BIN, process.env.CHROME_PATH, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean).find(candidate => fs.existsSync(candidate));
if (!browserPath) throw new Error("Headless Chrome or Edge was not found; set CHROME_BIN to its executable.");

let servePreviousShell = true;
const stylesheetResponses = new Map();
const browserErrors = [];
const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  if (url.pathname.startsWith("/api/")) {
    response.writeHead(200, { "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store" });
    response.end(JSON.stringify({ page:1, results:[], total_pages:1, total_results:0, id:0, name:"", title:"", genres:[], credits:{ cast:[], crew:[] }, content_ratings:{ results:[] }, videos:{ results:[] }, recommendations:{ results:[] }, similar:{ results:[] }, images:{ posters:[], backdrops:[] }, release_dates:{ results:[] }, external_ids:{} }));
    return;
  }
  const relative = decodeURIComponent(url.pathname === "/" ? "index.html" : url.pathname.replace(/^\//, ""));
  const previous = servePreviousShell ? previousFiles.get(relative) : null;
  if (previous) {
    response.writeHead(200, { "Content-Type":contentTypes.get(path.extname(relative)) || "application/octet-stream", "Cache-Control":"no-store" });
    response.end(previous);
    return;
  }
  const correctedPreviousIcon = servePreviousShell && relative === "assets/discord-symbol.svg" ? path.join(webRoot, "assets", "icons", "discord-symbol.svg") : null;
  const filePath = correctedPreviousIcon || path.resolve(webRoot, relative);
  if (!filePath.startsWith(`${webRoot}${path.sep}`)) { response.writeHead(403).end("Forbidden"); return; }
  fs.readFile(filePath, (error, content) => {
    if (error) { response.writeHead(404, { "Content-Type":"text/plain; charset=utf-8" }).end("Not found"); return; }
    response.writeHead(200, { "Content-Type":contentTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream", "Cache-Control":"no-store" });
    response.end(content);
  });
});

const profileRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "seven-upgrade-profile-"));
let browser, socket, sessionId, nextId = 0;
const pending = new Map();
function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`Timed out waiting for ${method}`)); } }, 10000).unref();
  });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise:true, returnByValue:true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
}

try {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  browser = spawn(browserPath, ["--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--remote-debugging-port=0", "--remote-allow-origins=*", `--user-data-dir=${profileRoot}`, "about:blank"], { stdio:"ignore", windowsHide:true });
  const activePortPath = path.join(profileRoot, "DevToolsActivePort");
  let devtoolsPort;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (browser.exitCode !== null) throw new Error(`Headless browser exited with code ${browser.exitCode}`);
    if (fs.existsSync(activePortPath)) { devtoolsPort = Number((await fs.promises.readFile(activePortPath, "utf8")).split(/\r?\n/)[0]); break; }
    await delay(100);
  }
  if (!devtoolsPort) throw new Error("Headless browser did not expose its DevTools endpoint.");
  const version = await (await fetch(`http://127.0.0.1:${devtoolsPort}/json/version`)).json();
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once:true }); socket.addEventListener("error", reject, { once:true }); });
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { const entry = pending.get(message.id); pending.delete(message.id); message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result || {}); return; }
    if (message.method === "Network.responseReceived" && message.params.type === "Stylesheet") { const response = message.params.response; stylesheetResponses.set(response.url, { status:response.status, type:response.mimeType }); }
    if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails.text || "uncaught browser exception");
    if (message.method === "Log.entryAdded" && message.params.entry.level === "error") browserErrors.push(message.params.entry.text);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") browserErrors.push(message.params.args.map(arg => arg.value || arg.description || "").join(" "));
  });
  const target = await send("Target.createTarget", { url:"about:blank" });
  sessionId = (await send("Target.attachToTarget", { targetId:target.targetId, flatten:true })).sessionId;
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable"); await send("Log.enable");
  await send("Page.navigate", { url:`http://127.0.0.1:${port}/` });
  const until = async expression => {
    for (let attempt = 0; attempt < 120; attempt += 1) { const value = await evaluate(expression); if (value) return value; await delay(250); }
    const diagnostic = await evaluate(`(async()=>JSON.stringify({url:location.href,ready:document.readyState,controller:navigator.serviceWorker.controller?.scriptURL||null,registrations:(await navigator.serviceWorker.getRegistrations()).map(registration=>({scope:registration.scope,installing:registration.installing?.state,waiting:registration.waiting?.state,active:registration.active?.state,script:registration.active?.scriptURL})),caches:await caches.keys()}))()`);
    throw new Error(`Timed out waiting for ${expression}; browser state: ${diagnostic}; errors: ${browserErrors.join(" | ")}`);
  };
  await until(`document.readyState === "complete" && !!document.querySelector('nav[aria-label="Main navigation"]')`);
  await until(`navigator.serviceWorker.getRegistration().then(registration=>!!registration?.active&&registration.active.state==="activated")`);
  await send("Page.navigate", { url:"about:blank" }); await delay(150);
  await send("Page.navigate", { url:`http://127.0.0.1:${port}/` });
  await until(`!!navigator.serviceWorker.controller && !!document.querySelector('nav[aria-label="Main navigation"]')`);
  const oldState = JSON.parse(await evaluate(`(async()=>JSON.stringify({controller:!!navigator.serviceWorker.controller,caches:await caches.keys()}))()`));
  if (!oldState.controller || !oldState.caches.includes(previousCacheVersion)) throw new Error(`Previous install did not control or cache ${previousCacheVersion}: ${JSON.stringify(oldState)}`);

  servePreviousShell = false;
  await evaluate(`(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();return true})()`);
  await until(`(async()=>{try{return (await caches.keys()).includes(${JSON.stringify(currentCacheVersion)})}catch{return false}})()`);
  await send("Page.navigate", { url:"about:blank" }); await delay(150);
  await send("Page.navigate", { url:`http://127.0.0.1:${port}/` });
  await until(`!!navigator.serviceWorker.controller && !!document.querySelector('nav[aria-label="Main navigation"]') && !!document.querySelector('link[href*="watch-page.css"]')`);
  await delay(1500);
  const newState = JSON.parse(await evaluate(`(async()=>JSON.stringify({nav:!!document.querySelector('nav[aria-label="Main navigation"]'),newCss:!!document.querySelector('link[href*="watch-page.css"]'),stylesReady:document.documentElement.classList.contains('seven-styles-ready'),links:[...document.querySelectorAll('link[rel="stylesheet"]')].map(link=>link.href),tokens:getComputedStyle(document.documentElement).getPropertyValue('--text').trim(),optInNodes:document.querySelectorAll('.tonal,.text-button,.seven-bottom-sheet').length,controller:!!navigator.serviceWorker.controller,caches:await caches.keys(),newCssCached:!!(await caches.open(${JSON.stringify(currentCacheVersion)})).match(location.origin+${JSON.stringify(currentWatchCssRequest)})}))()`));
  const failedStylesheets = [...stylesheetResponses].filter(([url, result]) => (url.endsWith(".css") || url.includes(".css?")) && (result.status !== 200 || !result.type?.toLowerCase().includes("text/css")));
  const unobservedStylesheets = newState.links.filter(url => !stylesheetResponses.has(url));
  if (!newState.nav || !newState.newCss || !newState.stylesReady || !newState.controller || !newState.caches.includes(currentCacheVersion) || !newState.newCssCached || newState.optInNodes !== 0 || failedStylesheets.length || unobservedStylesheets.length || browserErrors.length) {
    throw new Error(JSON.stringify({ newState, failedStylesheets, unobservedStylesheets, browserErrors, oldState }));
  }
  console.log(`Upgrade smoke passed: a prior shell was cached and controlled the page, the update activated ${currentCacheVersion}, the upgraded page is styled and controlled, CSS returned 200 text/css, and no existing DOM opts into the new primitives.`);
  console.log(`Previous install cache keys: ${oldState.caches.join(", ")}`);
} finally {
  try { socket?.close(); } catch { /* already closed */ }
  if (browser && browser.exitCode === null) { browser.kill(); await Promise.race([new Promise(resolve => browser.once("exit", resolve)), delay(1500)]); }
  server.close();
  const tempRoot = path.resolve(os.tmpdir());
  if (profileRoot.startsWith(tempRoot + path.sep) && path.basename(profileRoot).startsWith("seven-upgrade-profile-")) await fs.promises.rm(profileRoot, { recursive:true, force:true });
}
