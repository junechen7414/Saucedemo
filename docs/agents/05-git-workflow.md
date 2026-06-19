# Git 工作流程

> 本文件說明 Git 分支策略、Commit 訊息規範，以及建立 PR 時的 label 處理。

## 分支策略：Trunk-based（main 小步快跑）

預設**直接在 `main` 上小步提交並推送** —— CI/CD（GitHub Actions）會在 push 到 `main` 與 PR 時執行檢查，因此「只是想跑測試」不需要為此開 PR。

- `main` 沒有 branch protection；若不小心把 `main` 推壞了，優先 **fix-forward**（補一個修正 commit）或 `git revert`。
- **只有高風險變更才開 branch + PR**：CI workflow 本身的修改、大型功能、跨模組重構、依賴大版本升級 —— 任何你希望 CI 在進入 `main` 之前先驗證、或需要他人 review 的變更。
- 推送前請先在本地確認測試通過（`green locally = green in CI`）。

> 簡言之：日常小修小改走 `main`；風險大、想先讓 CI/review 把關的，才開分支走 PR。

## 分支命名規範（需要開分支時）

### 格式

```
類別/任務簡述
```

### 常用前綴

- `feature/` - 新功能開發
- `bugfix/` - 錯誤修復
- `hotfix/` - 緊急修復
- `refactor/` - 程式碼重構
- `docs/` - 文件更新
- `test/` - 測試相關
- `chore/` - 建置/工具/雜項

### 命名規則

- ✅ 全小寫
- ✅ 使用 `-` 分隔單字
- ✅ 使用 `/` 分層
- ✅ 從最新的 `main` 切出，保持短命（short-lived）
- ❌ 避免使用空格或特殊字元

### 範例

```bash
feature/add-login-page
bugfix/fix-checkout-error
refactor/improve-page-objects
docs/update-readme
```

## Commit 訊息規範

遵循 **Conventional Commits** 規範。

### 格式

```
<type>(<scope>): <subject>
```

### 常用類型

| Type | 說明 | 範例 |
|------|------|------|
| `feat` | 新功能 | `feat(auth): add login functionality` |
| `fix` | 錯誤修復 | `fix(cart): resolve checkout calculation error` |
| `docs` | 文件更新 | `docs(readme): update installation guide` |
| `style` | 程式碼格式 | `style: format code with biome` |
| `refactor` | 重構 | `refactor(pages): simplify page object structure` |
| `test` | 測試 | `test(api): add product API tests` |
| `chore` | 雜項 | `chore: update dependencies` |

### 撰寫原則

- ✅ 使用祈使句（如 `add` 而非 `added`）
- ✅ 第一個字母小寫
- ✅ 不要在結尾加句號
- ✅ 簡潔明瞭，說明「做了什麼」而非「為什麼」

### 範例

```bash
# 好的範例
feat(login): add remember me checkbox
fix(api): handle timeout error correctly
docs(agents): split into modular files

# 避免的範例
Added login feature  # 非祈使句
Fix bug.  # 不夠具體
updated readme  # 缺少 type
```

## 建立 Pull Request（高風險變更時）

> 日常小改直接走 `main`；以下流程用於需要 CI/review 把關的高風險變更。

### 使用 BOB IDE 的 Slash Command

如果您在 BOB IDE 或支援的 shell 環境中工作，可以使用 `/create-pr` slash command 快速建立 PR：

1. 確保已推送分支到遠端
2. 切換到 **Advanced** mode
3. 使用指令：`/create-pr`
4. BOB 會自動：
   - 分析 commit 歷史
   - 生成 PR 標題和描述
   - 建立 Pull Request
5. **重要**：建立 PR 後，請根據變更類型加上適當的 labels（參考下方「為 PR 加上 Labels（工具方式）」）

### 手動建立 PR

如果不在 BOB IDE 環境中，或 `/create-pr` command 不可用，請使用以下方式：

#### 方式一：透過 Git 推送訊息中的連結

推送分支後，Git 會在終端機輸出中提供建立 PR 的連結：

```
remote: Create a pull request for 'feature/your-branch' on GitHub by visiting:
remote:      https://github.com/junechen7414/Playwright-TS/pull/new/feature/your-branch
```

直接點擊或複製該連結到瀏覽器即可建立 PR。

#### 方式二：透過 GitHub 網頁介面

1. 前往專案的 GitHub 頁面
2. 點擊 **Pull requests** 標籤
3. 點擊 **New pull request** 按鈕
4. 選擇您的分支
5. 填寫 PR 標題和描述
6. 選擇適當的 labels（參考下方「查詢 GitHub Labels」章節）
7. 點擊 **Create pull request**

### PR 標題和描述建議

#### 標題格式
遵循 Conventional Commits 格式：
- 範例：`feat(auth): add login functionality`
- 範例：`docs(git): 更新 Git 工作流程說明`

#### 描述內容
**應該包含：**
- ✅ 變更的目的和背景
- ✅ 主要功能或改進說明
- ✅ 相關 issue 連結（使用 `Closes #123`）
- ✅ 破壞性變更說明（使用 `BREAKING CHANGE`）

**不需要包含：**
- ❌ 修改的檔案列表（GitHub 會自動顯示）
- ❌ 測試結果（CI/CD 會自動執行並顯示）
- ❌ 程式碼細節（可在 Files changed 中查看）

#### Labels 選擇
**為 PR 加上適當的 labels**，根據變更性質選擇 1-2 個最相關的：

| 變更類型 | 建議 Label |
|---------|-----------|
| 文件更新 | `documentation` |
| 新功能 | `enhancement` |
| 錯誤修復 | `bugfix` |
| 程式碼重構 | `refactor` |
| 測試相關 | `test` 或 `e2e-test` |
| 依賴更新 | `dependencies` |
| 配置變更 | `config` |
| 破壞性變更 | `breaking-change` |
| 建置/工具 | `chore` |

**範例：**
- 文件更新的 PR → 加上 `documentation` label
- 新增測試的 PR → 加上 `e2e-test` label
- 重構程式碼的 PR → 加上 `refactor` label

### 為 PR 加上 Labels（工具方式）

PR 在 GitHub API 中本質上也是 issue，但各工具加 label 的方式不同：

- **`gh` CLI**（最直接）：

  ```bash
  gh pr edit <PR 號> --add-label "documentation,e2e-test"
  # 或建立 PR 時一併指定
  gh pr create --label documentation --label e2e-test ...
  ```

- **GitHub MCP**：`create_pull_request` / `update_pull_request` **沒有 labels 欄位**，無法直接加。改用 **`issue_write`**（`method: "update"`、`issue_number` 填 **PR 號**、`labels: [...]`）—— 因為 PR 在 API 中也是 issue。流程：先 `create_pull_request` 取得 PR 號 → 再以 `issue_write` 補上 labels。
  > 注意：label 必須**已存在於 repo**（MCP 工具集只有 `get_label`，無法新建 label）。確認某 PR 目前的 labels 用 `pull_request_read`，**不要**用 `get_labels`（它只適用純 issue，傳 PR 號會回 `Could not resolve to an Issue`）。

- **BOB `/create-pr`**：目前**尚未支援自動加 label**，建立後請用上面的 `gh`/MCP 方式或 GitHub 網頁（PR 頁面右側 Labels 區塊）補上。

## 分支清理

### 合併後的清理流程

當 Pull Request 被合併到 `main` 後，應該清理本地和遠端的 feature 分支。

### PowerShell 指令

PowerShell 使用分號 (`;`) 來串接多個指令：

```powershell
# 切換回 main 分支並更新
git checkout main; git pull

# 刪除本地分支
git branch -d <branch-name>

# 刪除遠端分支（如果需要）
git push origin --delete <branch-name>
```

**完整範例**：

```powershell
# 假設要清理 feature/add-login-page 分支
git checkout main; git pull; git branch -d feature/add-login-page

# 如果遠端分支還存在，也一併刪除
git push origin --delete feature/add-login-page
```

### CMD 指令

CMD 使用 `&&` 來串接多個指令：

```cmd
REM 切換回 main 分支並更新
git checkout main && git pull

REM 刪除本地分支
git branch -d <branch-name>

REM 刪除遠端分支（如果需要）
git push origin --delete <branch-name>
```

**完整範例**：

```cmd
REM 假設要清理 feature/add-login-page 分支
git checkout main && git pull && git branch -d feature/add-login-page

REM 如果遠端分支還存在，也一併刪除
git push origin --delete feature/add-login-page
```

### 清理注意事項

- ✅ 確認 PR 已經合併後再刪除分支
- ✅ 使用 `-d` 參數（小寫）進行安全刪除，如果分支未合併會提示警告
- ✅ 如果確定要強制刪除未合併的分支，使用 `-D` 參數（大寫）
- ⚠️ 刪除遠端分支前，確認其他團隊成員不再需要該分支

## 查詢 GitHub Labels

在建立 PR 時需要選擇正確的 label。可透過 PowerShell 查詢目前 repo 上的所有 labels：

```powershell
# 查詢 GitHub repo 的 labels（PowerShell）
(Invoke-RestMethod -Uri "https://api.github.com/repos/junechen7414/Playwright-TS/labels").name
```

**目前可用的 Labels：**

| Label | 用途 |
|-------|------|
| `breaking-change` | API 或行為的破壞性變更 |
| `bugfix` | 修復程式錯誤 |
| `chore` | 建置/工具/CI 配置調整 |
| `config` | 設定檔變更 |
| `dependencies` | 依賴版本更新 |
| `documentation` | 文件更新 |
| `e2e-test` | E2E 測試相關 |
| `enhancement` | 功能增強 |
| `refactor` | 程式碼重構 |

**Agent 建議流程**：建立 PR 時應根據改動性質選擇 1-2 個最相關的 labels。

## 相關文件

- [開發規範](./04-development-standards.md)
- [程式設計原則](./06-coding-principles.md)
