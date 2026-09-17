# VC Issuer 第二階段實作報告

> 執行日期：2026-09-17  
> Service version：`0.2.0`  
> 工作分支：本機 `feature/vc`；未 commit、未 push、未 merge 遠端分支

## 1. 本次完成

- 以 SHA-256 digest 與 constant-time comparison 保護 issue/revoke endpoints。
- 實作 W3C Bitstring Status List v1.0，最小清單長度為
  131,072 entries / 16 KiB。
- 狀態 index 使用 cryptographic random allocation，以 atomic exclusive
  files 防止同一台主機上的重複分配。
- 新 Product VC 含 `BitstringStatusListEntry`，status list 本身也是一張
  以 `eddsa-jcs-2022` 簽章的 VC。
- Verifier 先驗 Product VC proof，再驗 Status List VC proof 與指定 bit；
  狀態取得或驗章失敗時 fail closed。
- 新增不可逆、idempotent 的 credential revocation API。
- 新增 `DidWebProvider`，以及 `/.well-known/did.json` 與
  `/contexts/product-v1.jsonld` 公開路由。
- application context URL 從 `PUBLIC_BASE_URL` 推導，避免 VC 內簽的
  URL 與真正發布路由不同。
- 新增 API key generator、環境設定、操作文件與 phase-2 plan。

## 2. 主要新增檔案

- `src/auth/api-key-auth.ts`
- `src/identity/did-web-provider.ts`
- `src/status/bitstring.ts`
- `src/status/status-list-store.ts`
- `src/status/status-list-service.ts`
- `src/vc/data-integrity-signer.ts`
- `scripts/generate-api-key.ts`
- `tests/config.test.ts`
- `tests/status-list.test.ts`
- `tests/status-security.test.ts`

## 3. API 變更

### 新增

- `GET /status/v1/revocation`
- `GET /contexts/product-v1.jsonld`
- `GET /.well-known/did.json`（`did:web` mode）
- `POST /api/v1/credentials/:id/revoke`（Bearer）

### 改為受保護

- `POST /api/v1/credentials/issue`

### 保持公開

- `POST /api/v1/credentials/verify`
- `GET /api/v1/credentials/:id`
- health/readiness/context/status/DID routes

## 4. 實際驗證證據

```text
npm run check             PASS
npm test                  PASS: 7 files, 30 tests
npm run build             PASS
```

30 項測試包含原有 19 項第一階段回歸，並新增：

- 缺 token 與錯 token 回傳相同 HTTP 401/error shape；
- signed Product VC 含狀態 entry；
- signed status-list VC 與 16 KiB 解壓後長度；
- left-most bit ordering 與最後一個 index；
- allocation collision/restart 仍不重複；
- status-list payload 竄改後 fail closed；
- 撤銷前通過、撤銷後 `CREDENTIAL_REVOKED`、重複撤銷
  `alreadyRevoked: true`；
- `did:key` mode 不發布假 `did:web`；`did:web` document 內無
  `secretKeyMultibase`；
- HTTPS public origin 與 configured `did:web` 必須精確對應。

### Compiled-server HTTP E2E

實際啟動 `node dist/src/server.js` 於 `127.0.0.1:3101`，以獨立
PowerShell client 完成：

```json
{
  "UnauthorizedStatus": 401,
  "CredentialId": "urn:uuid:897c6032-b504-4642-bc3b-3e500ed68ba5",
  "Issuer": "did:key:z6MkfhbHKJpUGMVe8JYhGj3ZmpxF62UpbGizFfS9ub43gRPL",
  "StatusIndex": "52038",
  "BeforeVerified": true,
  "BeforeStatusProof": "passed",
  "RevokeStatus": "revoked",
  "AfterVerified": false,
  "AfterError": "CREDENTIAL_REVOKED",
  "StatusListType": "BitstringStatusListCredential",
  "StatusListProof": "eddsa-jcs-2022",
  "ContextPublished": true
}
```

測試完成後 listener 已停止，臨時 credential/status state 已刪除。

## 5. 已證明、部分證明、未證明

### 已證明

- 單機 service 能授權簽發、發布 signed status list、撤銷與
  fail-closed 驗證。
- Product proof 與 status-list proof 皆為真實 Ed25519 Data Integrity proof。
- status index 不以簽發順序遞增，且本機重啟不重用已分配位置。
- `did:web` 應用程式介面、DID document 與 context route 可在本機測試。

### 部分證明

- file-based status store 使用 atomic exclusive create，適合單機、低並發示範；
  不代表 network filesystem 或 multi-region transaction 安全。
- API key digest 不保存 plaintext，但尚未有 OAuth/OIDC、獨立角色與
  operator lifecycle。

### 未證明／尚未實作

- 正式 database、audit event store、backup/restore、rate limiting、multi-replica。
- 新舊 key 同時驗證、key rotation/deactivation/compromise runbook。
- 真實 DNS、TLS、CDN/cache 與外部 `did:web` resolver 驗收。
- 遠端 `dev`、branch protection、CI 與 PR 治理。
- SGS、商品真偽、法規合規或 Product VC claim 的獨立查核。

