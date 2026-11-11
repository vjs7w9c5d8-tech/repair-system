const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

test("手機表單、資料庫契約、錯誤處理與安全清單呈現", async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await page.route("https://repair.test/**", async (route) => {
      const filename =
        new URL(route.request().url()).pathname.slice(1) || "index.html";
      const types = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
      };
      await route.fulfill({
        body: fs.readFileSync(path.join(__dirname, "..", filename)),
        contentType: types[path.extname(filename)],
      });
    });
    await page.route("https://cdn.jsdelivr.net/**", (route) =>
      route.fulfill({ body: "", contentType: "application/javascript" }),
    );
    await page.addInitScript(() => {
      window.calls = [];
      window.mode = "success";
      window.supabase = {
        createClient: () => ({
          from(table) {
            window.calls.push({ table });
            return {
              select(columns) {
                window.calls.push({ columns });
                return this;
              },
              order(column, options) {
                window.calls.push({ column, options });
                return this;
              },
              async limit(count) {
                window.calls.push({ count });
                if (window.mode === "list-error")
                  return { error: { message: "測試讀取失敗" } };
                return {
                  data:
                    window.mode === "empty"
                      ? []
                      : [
                          {
                            id: "test",
                            reporter_name: "示範同事",
                            location: "虛構辦公室",
                            category: "設備",
                            description: "<img src=x onerror=alert(1)>",
                            urgency: "高",
                            status: "待處理",
                            created_at: "2026-11-11T00:00:00Z",
                          },
                        ],
                };
              },
              async insert(payload) {
                window.calls.push({ payload });
                await new Promise((resolve) => setTimeout(resolve, 100));
                return {
                  error:
                    window.mode === "insert-error"
                      ? { message: "測試新增失敗" }
                      : null,
                };
              },
            };
          },
        }),
      };
    });
    await page.goto("https://repair.test/");
    await page.locator(".request-card").waitFor();
    assert.equal(await page.locator(".request-card img").count(), 0);
    assert.match(await page.locator("time").textContent(), /08:00/);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const calls = await page.evaluate(() => window.calls);
    assert.ok(calls.some((call) => call.count === 20));
    assert.ok(
      calls.some(
        (call) =>
          call.column === "created_at" && call.options.ascending === false,
      ),
    );
    await page.locator('[name="reporter_name"]').fill("   ");
    await page.locator('[name="location"]').fill("虛構地點");
    await page.locator('[name="category"]').selectOption("網路");
    await page.locator('[name="description"]').fill("虛構網路故障");
    await page.locator("#submit-button").click();
    assert.equal(
      await page.evaluate(
        () => window.calls.filter((call) => call.payload).length,
      ),
      0,
    );
    await page.locator('[name="reporter_name"]').fill(" 示範同事 ");
    await page.locator("#submit-button").click();
    await page.waitForFunction(() =>
      document.querySelector("#form-message").classList.contains("success"),
    );
    const payload = await page.evaluate(
      () => window.calls.find((call) => call.payload).payload,
    );
    assert.deepEqual(Object.keys(payload).sort(), [
      "category",
      "description",
      "location",
      "reporter_name",
      "urgency",
    ]);
    assert.equal(payload.reporter_name, "示範同事");
    assert.equal(await page.locator('[name="reporter_name"]').inputValue(), "");
    await page.evaluate(() => {
      window.mode = "insert-error";
    });
    await page.locator('[name="reporter_name"]').fill("示範同事");
    await page.locator('[name="location"]').fill("虛構地點");
    await page.locator('[name="category"]').selectOption("設備");
    await page.locator('[name="description"]').fill("虛構設備故障");
    await page.locator("#submit-button").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#form-message")
        .textContent.includes("測試新增失敗"),
    );
    assert.equal(
      await page.locator('[name="description"]').inputValue(),
      "虛構設備故障",
    );
    await page.evaluate(() => {
      window.mode = "empty";
    });
    await page.locator("#refresh-button").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#list-message")
        .textContent.includes("目前還沒有"),
    );
    assert.equal(await page.locator(".request-card").count(), 0);
    await page.evaluate(() => {
      window.mode = "list-error";
    });
    await page.locator("#refresh-button").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#list-message")
        .textContent.includes("測試讀取失敗"),
    );
    await page.route("https://repair.test/config.js", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: 'window.REPAIR_CONFIG = {supabaseUrl:"",supabasePublishableKey:"sb_publishable_test"};',
      }),
    );
    await page.reload();
    await page.waitForFunction(() =>
      document
        .querySelector("#form-message")
        .textContent.includes("尚未設定資料庫"),
    );
    assert.equal(await page.locator("#submit-button").isDisabled(), true);
    await page.screenshot({ path: "/tmp/repair-mobile.png", fullPage: true });
  } finally {
    await browser.close();
  }
});
