# 儲存庫指南

## 專案結構與模組配置

本儲存庫目前以需求為主。`報修需求筆記.txt` 定義了報修登記示範系統、欄位、角色及 Supabase 規則。後續交付物請依類型整理：

- `web/` — 表單、報修清單介面及應用程式碼。
- `supabase/` — SQL 遷移、資料庫結構、種子資料及 RLS 政策。
- `tests/` — 與網頁原始碼結構對應的自動化測試。
- `docs/` — Word 操作說明及相關文件。
- `slides/` 與 `data/` — 提案簡報及 Excel 欄位／範例資料。
- `assets/` — 共用圖片及其他靜態素材。

請勿提交 Office 鎖定檔、相依套件資料夾，或真實的員工與地點資料。

## 建置、測試與開發指令

目前尚未建立建置或測試工具。初始化網頁應用程式時，請在 `web/package.json` 提供以下指令：

- `npm install` — 安裝鎖定版本的專案相依套件。
- `npm run dev` — 啟動本機開發伺服器。
- `npm run build` — 產生正式環境建置成果。
- `npm test` — 執行自動化測試套件。
- `npm run lint` — 檢查格式及靜態分析規則。

請從 `web/` 執行上述指令。Supabase 變更應保存為具版本紀錄的 SQL，不可只在控制台手動修改。

## 程式碼風格與命名規範

檔案統一採用 UTF-8；JavaScript、TypeScript、JSON、CSS 與 YAML 使用兩個空格縮排。元件使用 `PascalCase`，函式與變數使用 `camelCase`，其他檔名使用 `kebab-case`，例如 `RepairForm.tsx` 與 `repair-list.ts`。SQL 識別字使用 `snake_case`。首次建立網頁專案時，應加入格式化及程式碼檢查工具，並在提交前執行。

## 測試指南

測試可放在模組旁並命名為 `*.test.ts(x)`，或置於 `tests/` 中的對應路徑。測試範圍應涵蓋表單驗證、時間戳記、欄位允許值及清單呈現。Supabase 測試必須證明匿名使用者可以新增及讀取，但不能更新或刪除。測試資料僅可使用虛構內容。

## 提交與合併請求指南

此目錄沒有可用的 Git 歷史，因此請採用簡潔的 Conventional Commits，例如 `feat: add repair form` 或 `docs: update operator guide`。每次提交應聚焦單一變更。合併請求須說明使用者可見的變更、列出驗證指令、連結相關需求或議題，並為介面或 Office 文件變更附上截圖。資料庫結構或 RLS 變更須特別註明；若已確定未決需求，也應同步更新 `報修需求筆記.txt`。

## 安全性與設定

Supabase URL 與公開金鑰應存放於本機環境檔，儲存庫中只提交 `.env.example`。禁止提交 service-role 金鑰。前端連線前必須啟用 RLS，且每項政策都應與其遷移檔一併審查。
