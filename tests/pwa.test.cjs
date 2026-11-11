const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

test("PWA 子目錄安裝設定、靜態快取、離線重開與禁止離線送出", async () => {
  const root = path.resolve(__dirname, "..");
  let workerVersion = 1;
  const types = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".webmanifest": "application/manifest+json",
    ".png": "image/png",
  };
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (!pathname.startsWith("/repair-system/")) {
      res.writeHead(404).end();
      return;
    }
    const relative = pathname.slice("/repair-system/".length) || "index.html";
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    const body = fs.readFileSync(file);
    res.end(
      relative === "sw.js"
        ? body.toString().replace("}v1", `}v${workerVersion}`)
        : body,
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const sdk = `window.supabase={createClient:()=>({from:()=>({select(){return this},order(){return this},limit:async()=>({data:[]}),insert:async()=>{window.insertCount=(window.insertCount||0)+1;return {error:null}}})})};`;
  try {
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.route("https://cdn.jsdelivr.net/**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: sdk }),
    );
    await page.goto(`${origin}/repair-system/index.html`);
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
    );
    const cdp = await context.newCDPSession(page);
    const parsedManifest = await cdp.send("Page.getAppManifest");
    assert.deepEqual(parsedManifest.errors, []);
    assert.match(parsedManifest.url, /\/repair-system\/manifest.webmanifest$/);
    await cdp.detach();
    const worker = context.serviceWorkers()[0];
    const state = await worker.evaluate(async () => {
      const keys = await caches.keys();
      const cache = await caches.open(keys.find((key) => key.endsWith(":v1")));
      return {
        scope: self.registration.scope,
        urls: (await cache.keys()).map((request) => request.url),
      };
    });
    assert.equal(state.scope, `${origin}/repair-system/`);
    assert.ok(state.urls.includes(`${origin}/repair-system/index.html`));
    assert.ok(
      state.urls.every(
        (url) =>
          url.startsWith(`${origin}/repair-system/`) ||
          url.startsWith("https://cdn.jsdelivr.net/"),
      ),
    );
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, "manifest.webmanifest")),
    );
    assert.equal(
      new URL(
        manifest.start_url,
        `${origin}/repair-system/manifest.webmanifest`,
      ).href,
      `${origin}/repair-system/`,
    );
    assert.equal(manifest.display, "standalone");
    for (const icon of manifest.icons)
      assert.ok(fs.existsSync(path.join(root, icon.src)));
    // 將測試 SDK 放入同一靜態快取；不依賴外部 CDN 或真實資料庫。
    await worker.evaluate(async (body) => {
      const key = (await caches.keys()).find((key) => key.endsWith(":v1"));
      const cache = await caches.open(key);
      await cache.put(
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js",
        new Response(body, {
          headers: { "Content-Type": "application/javascript" },
        }),
      );
    }, sdk);
    await context.setOffline(true);
    await page.goto(`${origin}/repair-system/?source=installed`);
    await page.waitForFunction(
      () => !document.querySelector("#form-fields").disabled,
    );
    assert.match(
      await page.locator("#connection-message").textContent(),
      /目前離線/,
    );
    assert.match(
      await page.locator("#list-message").textContent(),
      /無法取得最新報修/,
    );
    await page.locator('[name="reporter_name"]').fill("虛構同事");
    await page.locator('[name="location"]').fill("虛構辦公室");
    await page.locator('[name="category"]').selectOption("設備");
    await page.locator('[name="description"]').fill("虛構設備故障");
    await page.locator("#submit-button").click();
    assert.match(await page.locator("#form-message").textContent(), /尚未送出/);
    assert.equal(await page.evaluate(() => window.insertCount || 0), 0);
    assert.equal(
      await page.locator('[name="description"]').inputValue(),
      "虛構設備故障",
    );
    const cachedUrls = await worker.evaluate(async () => {
      const keys = await caches.keys();
      return (
        await Promise.all(
          keys.map(async (key) =>
            (await (await caches.open(key)).keys()).map(
              (request) => request.url,
            ),
          ),
        )
      ).flat();
    });
    assert.ok(cachedUrls.every((url) => !url.includes("supabase.co")));
    if (process.env.PWA_SCREENSHOT_PATH) {
      await page.screenshot({
        path: process.env.PWA_SCREENSHOT_PATH,
        fullPage: true,
      });
    }
    await context.setOffline(false);
    await page.waitForFunction(
      () => document.querySelector("#connection-message").hidden,
    );
    await page.locator("#submit-button").click();
    await page.waitForFunction(() =>
      document.querySelector("#form-message").classList.contains("success"),
    );
    assert.equal(await page.evaluate(() => window.insertCount), 1);
    // 模擬下一個部署版本；更新須先等待使用者點擊，不可清空正在填寫的表單。
    await page.locator('[name="description"]').fill("更新前的虛構草稿");
    await page.evaluate(async () => {
      await caches.open("other-app-cache");
    });
    workerVersion = 2;
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration()).update();
    });
    await page.waitForFunction(
      () => !document.querySelector("#update-button").hidden,
    );
    assert.equal(
      await page.locator('[name="description"]').inputValue(),
      "更新前的虛構草稿",
    );
    await Promise.all([
      page.waitForEvent("load"),
      page.locator("#update-button").click(),
    ]);
    const updatedCaches = await page.evaluate(() => caches.keys());
    assert.ok(updatedCaches.some((key) => key.endsWith(":v2")));
    assert.ok(!updatedCaches.some((key) => key.endsWith(":v1")));
    assert.ok(updatedCaches.includes("other-app-cache"));
    assert.equal(await page.locator('[name="description"]').inputValue(), "");
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
