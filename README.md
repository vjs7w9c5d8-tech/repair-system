雲端任務測試

[報修欄位表](文件/報修欄位表.xlsx)

## 報修登記網頁

首頁為根目錄 `index.html`，使用純 HTML/CSS/JavaScript，透過 CDN 載入 supabase-js v2，不需要建置。

- GitHub Pages 預期網址：https://vjs7w9c5d8-tech.github.io/repair-system/
- Pages 設定：Deploy from a branch → `main` → `/ (root)`。
- 在 Supabase 執行 `supabase/schema.sql`，設定資料表、欄位授權及 RLS。
- `config.js` 的 `supabaseUrl` 已設定為 `https://lnimvlaxyozckrypjbbs.supabase.co`。這是 Supabase Project URL，與 GitHub Pages 發佈網址不同；未設定時頁面會顯示提示並停用送出。
- `supabasePublishableKey` 已填入提供的公開金鑰；禁止換成 secret 或 service-role 金鑰。

新增僅傳送 `reporter_name`、`location`、`category`、`description`、`urgency`，由資料庫產生 `status`、`created_at`、`id`。清單依 `created_at` 降冪取最近 20 筆，時間以台北時區顯示。公開示範請只使用虛構資料。

## 開發與驗證

在儲存庫根目錄執行 `npm ci`，再執行 `npm run dev`，瀏覽 `http://localhost:8000`。

`npm run lint` 檢查格式與 JavaScript 語法；`npm test` 使用 Playwright 與本機 Chromium（可用 `CHROMIUM_PATH` 指定執行檔），以模擬 API 檢查手機版、必填驗證、資料欄位、排序查詢、成功／錯誤訊息及 HTML 注入防護。測試不會寫入真實資料庫。實際資料庫連線及 RLS 仍需在 Project URL 設定完成後驗證。
