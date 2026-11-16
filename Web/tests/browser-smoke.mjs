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
  });
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
  console.log(`Headless browser smoke passed: nav present, ${pageState.links.length} stylesheets returned 200 text/css, no console errors.`);
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
