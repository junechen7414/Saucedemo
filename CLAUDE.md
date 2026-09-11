# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

本專案是一個採用 **Business-Layer Page Object Model** 架構的 **Playwright + TypeScript (ESM)** E2E 測試專案。測試對象有兩個：SauceDemo 網頁 UI，以及在本機容器中執行的 Spring Boot + Oracle DB API 堆疊。

更完整的指引請見 `AGENTS.md` 及其引用、位於 `docs/agents/` 下的模組化文件（皆以繁體中文撰寫）。本檔未涵蓋之處請參閱那些文件。

## 硬性規範

- **一律使用 `pnpm`，不要使用 `npm` 或 `yarn`。**
- **一律使用 `podman`，不要使用 `docker`**（compose 指令透過 `podman compose` 執行）。
- **註解與文件使用繁體中文**，與現有程式碼保持一致。
- **優先使用 `getByRole`** 等以無障礙角色為基礎的 locator，避免 CSS/XPath。
- 格式化與 Lint 使用 **Biome**（tab 縮排、單引號、一律加分號、trailing comma、行寬 100）。`noFloatingPromises` 設為 error —— promise 一律要 `await`。

## 常用指令

```bash
# Lint / 格式化 (Biome)
pnpm biome:check          # 僅檢查
pnpm biome:fix            # 檢查 + 自動修復 + 整理 imports

# 容器堆疊 (Spring Boot app + Oracle DB，透過 podman compose)
pnpm pull-image           # 拉取最新映像檔
pnpm compose-up           # 啟動堆疊 (app 在 localhost:8787，Oracle 在 1521)
pnpm compose-down         # 停止並移除 volumes (-v)
pnpm compose-restart      # down + up —— 執行間用於重置測試隔離狀態

# 測試
pnpm test:e2e             # 執行 Spring Boot API 測試 (tests/api/springboot)
pnpm test:e2e:clean       # 清除產出物後執行 API 測試
pnpm test:e2e:ci          # compose-restart + clean + API 測試 (完整 CI 流程)
pnpm local-test-all       # 清除後執行所有 projects (UI + API)

# 重新產生 API 型別 -> services/schema/api-types.ts
pnpm api-spec:update      # 從跑起來的容器抓 /v3/api-docs（需先 compose-up；CI 走這條）
pnpm api-spec:update:file # 離線：改用版控裡的 docs/swagger.json 快照

# 執行單一測試 / 子集 (直接使用 Playwright CLI)
pnpm exec playwright test tests/api/springboot/order.spec.ts
pnpm exec playwright test -g "應該能建立新訂單"          # 依標題
pnpm exec playwright test --project=springboot-api      # 依 project
pnpm exec playwright show-report playwright-report/<PW_DATE>
```

需要一個含 `ORACLE_TEST_USERNAME` / `ORACLE_TEST_PASSWORD` 的 `.env`（參考 `.env.example`）。執行 API 測試前需先啟動容器堆疊（`pnpm compose-up`），或使用會先重啟堆疊的 `pnpm test:e2e:ci`。

CI job summary 常出現「版控快照 `docs/swagger.json` 與被測 image 的 spec 有差異」—— **那是預期行為**（上游同步快照的 job 排在 dispatch 之後，必定慢一步），型別是從被測容器的 live spec 產生的，不影響測試。四種觸發各自的讀法與唯一該追的異常見 [`docs/agents/13-advanced-techniques.md`](docs/agents/13-advanced-techniques.md#怎麼讀-job-summary-的快照與-live-spec-有差異)。

## 架構

三層架構 —— 測試層使用服務層，服務層封裝 Playwright API。測試應讀起來像商業流程，而非 UI/HTTP 操作。

- **`tests/`** —— 只放測試案例，不含 locator 或原始 HTTP 呼叫。`tests/ui/saucedemo/`（瀏覽器）與 `tests/api/springboot/`（API）。
- **`services/`** —— 可重用的基礎設施：
  - `pages/` —— Page Objects（`{name}-page.ts`，類別 `{Name}Page`）。公開方法為語意化的商業行為（`continueCheckout`、`verifyOrderCompletion`）；locator 保持私有。
  - `components/` —— 可重用 UI 元件（如 `hamburger-menu.ts`），組合進 Page Objects。
  - `apis/` —— `base-api-client.ts` 提供 `ApiRequester`（採組合而非繼承），回傳 `ApiResult<T>`，並提供 `expectOk` / `expectError` 斷言輔助函式；`springboot-api-client.ts` 封裝具體端點。
  - `schema/` —— `api-types.ts` 由被測容器的 `/v3/api-docs` **自動產生**（請勿手動編輯，見 `api-spec:update`）；另有 `constants.ts`、`common-types.ts`。
  - `fixtures/` —— 依賴注入層（見下方）。

### Fixtures 是組合的核心

測試從 chained fixture 匯入 `test`/`expect`，絕不直接建構 Page Objects 或 API clients。Fixtures 以 `mergeTests` 組合：

- `chain-fixtures.fixture.ts` → UI：合併 `page-objects` + `saucedemo-test-data`。
- `springboot-chained.fixture.ts` → API：合併 `springboot-api-objects` + `springboot-test-data`。

範例（API 測試）：`test('...', async ({ springbootApi, existingAccount, newOrderData }) => { ... })`。資料型 fixture 如 `existingAccount`、`existingProduct`、`existingOrder` 會按需建立後端狀態；`updateAccountData` 等則提供 payload。

### Playwright projects (`playwright.config.ts`)

- `ui-setup` —— `*.setup.ts`，對 saucedemo 預先登入（狀態存於 `.auth`）。
- `springboot-api` —— `tests/api/springboot/*.spec.ts`，baseURL 為 `http://localhost:8787/`。
- `ui-staging` —— saucedemo `*.spec.ts`，相依於 `ui-setup`，對線上站點執行。

HTML 報告在本機輸出至 `playwright-report/<PW_DATE>`（加時間戳），在 CI 則輸出至 `playwright-report/`。

### 測試隔離

`globalSetup`（Flyway clean/migrate）目前**已停用**，改採**容器重啟策略**：`compose-restart` 會清除 volumes 並重建資料庫，讓每次執行都從乾淨的 Oracle schema 開始。詳見 `docs/testing/e2e-cleanup-strategy.md`。

## 路徑別名 (tsconfig.json)

`@/*` → 專案根目錄、`@tests/*`、`@fixtures/* → services/fixtures`、`@pages/*`、`@apis/*`、`@schema/*`、`@components/*`、`@config/*`。請使用這些別名取代冗長的相對路徑 import。

## Git 工作流程

Trunk-based：**小型變更直接提交到 `main`**（push 時 CI 會執行）。只有高風險變更才開 `feature/`、`bugfix/`、`refactor/` 等分支加 PR（CI 設定、大型功能、跨模組重構、依賴大版本升級）。Commit 遵循 **Conventional Commits**（`<type>(<scope>): <subject>`，祈使句、字首小寫、結尾不加句號）。PR 一律以 **rebase merge** 合併（與上游 `SpringBoot` 一致）。完整細節與 PR 加 label 步驟見 `docs/agents/05-git-workflow.md`。
