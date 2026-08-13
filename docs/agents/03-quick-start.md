# 快速開始

> 本文件說明如何執行測試與常用腳本

## 測試執行

### UI 測試（SauceDemo）

```bash
pnpm playwright test --project=ui-staging
```

### API 測試（Spring Boot）

```bash
pnpm run test:e2e
```

### 完整 CI/CD 流程

執行容器重啟 + 測試的完整流程：

```bash
pnpm run test:e2e:ci
```

或使用腳本：

```bash
# Windows
.\scripts\test-e2e-ci.ps1

# Linux/macOS
bash scripts/test-e2e-ci.sh
```

## 重要腳本說明

| 指令 | 說明 |
|------|------|
| `pnpm run compose-up` | 啟動測試環境（Spring Boot + Oracle DB） |
| `pnpm run compose-down` | 停止並刪除測試環境 |
| `pnpm run compose-restart` | 重啟測試環境 |
| `pnpm run test:e2e` | 執行 API E2E 測試 |
| `pnpm run test:e2e:ci` | 完整 CI/CD 測試流程（容器重啟） |
| `pnpm run api-spec:update` | 從跑起來的容器（`/v3/api-docs`）更新 API 型別定義 |
| `pnpm run api-spec:update:file` | 同上，但改讀版控裡的 `docs/swagger.json` 快照（離線用） |
| `pnpm run biome:fix` | 自動修復程式碼格式問題 |

## 測試報告

測試完成後，可以查看 HTML 報告：

```bash
# 開啟測試報告
pnpm playwright show-report
```

報告位置：
- **本地開發**: `playwright-report/2024-05-20_14-30-00/`
- **CI 環境**: `playwright-report/`

## 相關文件

- [環境準備](./02-environment-setup.md)
- [測試策略](./10-testing-strategies.md)
- [CI/CD 整合](./11-cicd-integration.md)